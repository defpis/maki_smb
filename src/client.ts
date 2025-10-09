/**
 * SMB Client
 */
import crypto from "crypto";
import { Transport } from "./transport";
import * as smb2 from "./smb2";
import * as ntlm from "./ntlm";

// ==================== Types ====================

export interface Config {
  host: string;
  port: number;
  share: string;
  username: string;
  password: string;
  domain?: string;
}

export type { DirectoryEntry } from "./smb2";

export interface ReadDirectoryResult {
  entries: smb2.DirectoryEntry[];
  done: boolean;
}

export interface ReadFileResult {
  data: Buffer;
  done: boolean;
}

interface HandleInfo {
  fileId: Buffer;
  fileSize: bigint;
}

// ==================== Client ====================

export class SMBClient {
  private config: Config;
  private transport = new Transport();
  private messageId = 0;
  private sessionId = Buffer.alloc(8);
  private treeId = 0;
  private openHandles = new Map<string, HandleInfo>();
  private processId = Buffer.from([
    Math.random() * 256,
    Math.random() * 256,
    Math.random() * 256,
    Math.random() * 256,
  ]);

  constructor(config: Config) {
    this.config = config;
  }

  // ==================== Connection ====================

  async connect(): Promise<void> {
    await this.transport.connect(this.config.host, this.config.port);
    await this.negotiate();
    await this.sessionSetup();
    await this.treeConnect();
  }

  close(): void {
    this.transport.close();
  }

  // ==================== Directory API ====================

  async openDirectory(path: string = ""): Promise<string> {
    const body = smb2.Create.buildRequest(path, { directory: true });
    const resp = await this.send(smb2.Command.CREATE, body);
    const header = smb2.parseHeader(resp);

    if (header.status !== smb2.Status.SUCCESS) {
      throw new Error(`Open directory failed: 0x${header.status.toString(16)}`);
    }

    const { fileId, endOfFile } = smb2.Create.parseResponse(smb2.getBody(resp));
    const handleId = crypto.randomUUID();
    this.openHandles.set(handleId, { fileId, fileSize: endOfFile });

    return handleId;
  }

  async readDirectory(handleId: string): Promise<ReadDirectoryResult> {
    const handle = this.openHandles.get(handleId);
    if (!handle) {
      throw new Error(`Handle not found: ${handleId}`);
    }

    const body = smb2.Query.buildRequest(handle.fileId, "*");
    const resp = await this.send(smb2.Command.QUERY_DIRECTORY, body);
    const header = smb2.parseHeader(resp);

    if (header.status === smb2.Status.NO_MORE_FILES) {
      return { entries: [], done: true };
    }

    if (header.status !== smb2.Status.SUCCESS) {
      throw new Error(`Read directory failed: 0x${header.status.toString(16)}`);
    }

    const entries = smb2.Query.parseResponse(smb2.getBody(resp));
    return { entries, done: false };
  }

  async closeDirectory(handleId: string): Promise<void> {
    await this.closeHandle(handleId);
  }

  async listDirectory(path: string = ""): Promise<smb2.DirectoryEntry[]> {
    const handleId = await this.openDirectory(path);

    try {
      const entries: smb2.DirectoryEntry[] = [];
      while (true) {
        const result = await this.readDirectory(handleId);
        entries.push(...result.entries);
        if (result.done) break;
      }
      return entries;
    } finally {
      await this.closeDirectory(handleId);
    }
  }

  // ==================== File API ====================

  async openFile(path: string): Promise<string> {
    const body = smb2.Create.buildRequest(path, { directory: false });
    const resp = await this.send(smb2.Command.CREATE, body);
    const header = smb2.parseHeader(resp);

    if (header.status !== smb2.Status.SUCCESS) {
      throw new Error(`Open file failed: 0x${header.status.toString(16)}`);
    }

    const { fileId, endOfFile } = smb2.Create.parseResponse(smb2.getBody(resp));
    const handleId = crypto.randomUUID();
    this.openHandles.set(handleId, { fileId, fileSize: endOfFile });

    return handleId;
  }

  getFileSize(handleId: string): bigint {
    const handle = this.openHandles.get(handleId);
    if (!handle) {
      throw new Error(`Handle not found: ${handleId}`);
    }
    return handle.fileSize;
  }

  async readFileChunk(
    handleId: string,
    offset: bigint,
    length: number,
  ): Promise<ReadFileResult> {
    const handle = this.openHandles.get(handleId);
    if (!handle) {
      throw new Error(`Handle not found: ${handleId}`);
    }

    if (offset >= handle.fileSize) {
      return { data: Buffer.alloc(0), done: true };
    }

    const remaining = handle.fileSize - offset;
    const actualLength = Math.min(length, Number(remaining));

    const body = smb2.Read.buildRequest(handle.fileId, offset, actualLength);
    const resp = await this.send(smb2.Command.READ, body);
    const header = smb2.parseHeader(resp);

    if (header.status === smb2.Status.END_OF_FILE) {
      return { data: Buffer.alloc(0), done: true };
    }

    if (header.status !== smb2.Status.SUCCESS) {
      throw new Error(`Read file failed: 0x${header.status.toString(16)}`);
    }

    const data = smb2.Read.parseResponse(smb2.getBody(resp));
    const done = offset + BigInt(data.length) >= handle.fileSize;

    return { data, done };
  }

  async closeFile(handleId: string): Promise<void> {
    await this.closeHandle(handleId);
  }

  async readFile(path: string): Promise<Buffer> {
    const handleId = await this.openFile(path);

    try {
      const chunks: Buffer[] = [];
      let offset = 0n;
      const chunkSize = 64 * 1024;

      while (true) {
        const result = await this.readFileChunk(handleId, offset, chunkSize);
        if (result.data.length > 0) {
          chunks.push(result.data);
          offset += BigInt(result.data.length);
        }
        if (result.done) break;
      }

      return Buffer.concat(chunks);
    } finally {
      await this.closeFile(handleId);
    }
  }

  // ==================== Private ====================

  private async closeHandle(handleId: string): Promise<void> {
    const handle = this.openHandles.get(handleId);
    if (!handle) return;

    const body = smb2.Close.buildRequest(handle.fileId);
    await this.send(smb2.Command.CLOSE, body);
    this.openHandles.delete(handleId);
  }

  private async send(command: number, body: Buffer): Promise<Buffer> {
    const msg = smb2.buildMessage({
      command,
      messageId: this.messageId++,
      sessionId: this.sessionId,
      treeId: this.treeId,
      processId: this.processId,
      body,
    });
    return this.transport.send(msg);
  }

  private async negotiate(): Promise<void> {
    const body = smb2.Negotiate.buildRequest();
    const resp = await this.send(smb2.Command.NEGOTIATE, body);
    const header = smb2.parseHeader(resp);

    if (header.status !== smb2.Status.SUCCESS) {
      throw new Error(`Negotiate failed: 0x${header.status.toString(16)}`);
    }
  }

  private async sessionSetup(): Promise<void> {
    const domain = this.config.domain || "";

    // NTLM Type 1
    const type1 = ntlm.createType1(this.config.host, domain);
    const body1 = smb2.Session.buildRequest(type1);
    const resp1 = await this.send(smb2.Command.SESSION_SETUP, body1);
    const header1 = smb2.parseHeader(resp1);

    if (header1.status !== smb2.Status.MORE_PROCESSING_REQUIRED) {
      throw new Error(
        `Session setup step 1 failed: 0x${header1.status.toString(16)}`,
      );
    }

    this.sessionId = Buffer.from(header1.sessionId);

    // NTLM Type 3
    const respBody1 = smb2.Session.parseResponse(smb2.getBody(resp1));
    const type2 = ntlm.parseType2(Buffer.from(respBody1.securityBuffer));
    const type3 = ntlm.createType3(
      this.config.username,
      this.config.host,
      domain,
      this.config.password,
      type2.challenge,
      type2.flags,
    );
    const body2 = smb2.Session.buildRequest(type3);
    const resp2 = await this.send(smb2.Command.SESSION_SETUP, body2);
    const header2 = smb2.parseHeader(resp2);

    if (header2.status !== smb2.Status.SUCCESS) {
      throw new Error(
        `Session setup step 2 failed: 0x${header2.status.toString(16)}`,
      );
    }
  }

  private async treeConnect(): Promise<void> {
    const path = `\\\\${this.config.host}\\${this.config.share}`;
    const body = smb2.Tree.buildRequest(path);
    const resp = await this.send(smb2.Command.TREE_CONNECT, body);
    const header = smb2.parseHeader(resp);

    if (header.status !== smb2.Status.SUCCESS) {
      throw new Error(`Tree connect failed: 0x${header.status.toString(16)}`);
    }

    this.treeId = header.treeId;
  }
}
