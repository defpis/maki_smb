/**
 * File Reader - Chunk file reading
 */
import { SMBClient } from "./client";

export interface FileReaderOptions {
  /** Chunk size, default 64KB */
  chunkSize?: number;
}

export class FileReader {
  private client: SMBClient;
  private handleId: string | null = null;
  private offset = 0n;
  private fileSize = 0n;
  private chunkSize: number;
  private done = false;

  constructor(client: SMBClient, options: FileReaderOptions = {}) {
    this.client = client;
    this.chunkSize = options.chunkSize ?? 64 * 1024;
  }

  /**
   * Open file
   */
  async open(path: string): Promise<void> {
    if (this.handleId) {
      await this.close();
    }
    this.handleId = await this.client.openFile(path);
    this.fileSize = this.client.getFileSize(this.handleId);
    this.offset = 0n;
    this.done = this.fileSize === 0n;
  }

  /**
   * Read next chunk
   */
  async read(): Promise<Buffer> {
    if (!this.handleId) {
      throw new Error("File not opened");
    }

    if (this.done) {
      return Buffer.alloc(0);
    }

    const result = await this.client.readFileChunk(
      this.handleId,
      this.offset,
      this.chunkSize,
    );

    if (result.data.length > 0) {
      this.offset += BigInt(result.data.length);
    }
    if (result.done) {
      this.done = true;
    }

    return result.data;
  }

  /**
   * Read specified bytes
   */
  async readBytes(size: number): Promise<Buffer> {
    if (!this.handleId) {
      throw new Error("File not opened");
    }

    if (this.done) {
      return Buffer.alloc(0);
    }

    const result = await this.client.readFileChunk(
      this.handleId,
      this.offset,
      size,
    );

    if (result.data.length > 0) {
      this.offset += BigInt(result.data.length);
    }
    if (result.done) {
      this.done = true;
    }

    return result.data;
  }

  /**
   * Read all content
   */
  async readAll(): Promise<Buffer> {
    const chunks: Buffer[] = [];
    while (this.hasMore()) {
      const chunk = await this.read();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
    }
    return Buffer.concat(chunks);
  }

  /**
   * Has more data
   */
  hasMore(): boolean {
    return !this.done;
  }

  /**
   * Get file size
   */
  getSize(): bigint {
    return this.fileSize;
  }

  /**
   * Get current offset
   */
  getOffset(): bigint {
    return this.offset;
  }

  /**
   * Seek to offset
   */
  seek(offset: bigint): void {
    if (offset < 0n || offset > this.fileSize) {
      throw new Error(`Invalid offset: ${offset}`);
    }
    this.offset = offset;
    this.done = offset >= this.fileSize;
  }

  /**
   * Close file
   */
  async close(): Promise<void> {
    if (this.handleId) {
      await this.client.closeFile(this.handleId);
      this.handleId = null;
      this.offset = 0n;
      this.fileSize = 0n;
      this.done = false;
    }
  }
}
