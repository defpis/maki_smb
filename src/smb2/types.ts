/**
 * SMB2 Types
 */

export interface DirectoryEntry {
  fileName: string;
  isDirectory: boolean;
  fileSize: bigint;
  creationTime: Date;
  lastWriteTime: Date;
}

export interface MessageOptions {
  command: number;
  messageId: number;
  sessionId?: Buffer;
  treeId?: number;
  processId: Buffer;
  body: Buffer;
}

export interface ResponseHeader {
  status: number;
  command: number;
  messageId: number;
  treeId: number;
  sessionId: Buffer;
}
