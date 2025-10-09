/**
 * Directory Reader - Batch directory reading
 */
import { SMBClient, DirectoryEntry } from "./client";

export interface DirectoryReaderOptions {
  /** Batch size, default 100 */
  batchSize?: number;
}

export class DirectoryReader {
  private client: SMBClient;
  private handleId: string | null = null;
  private buffer: DirectoryEntry[] = [];
  private done = false;
  private batchSize: number;

  constructor(client: SMBClient, options: DirectoryReaderOptions = {}) {
    this.client = client;
    this.batchSize = options.batchSize ?? 100;
  }

  /**
   * Open directory
   */
  async open(path: string = ""): Promise<void> {
    if (this.handleId) {
      await this.close();
    }
    this.handleId = await this.client.openDirectory(path);
    this.buffer = [];
    this.done = false;
  }

  /**
   * Read entries
   */
  async read(count?: number): Promise<DirectoryEntry[]> {
    if (!this.handleId) {
      throw new Error("Directory not opened");
    }

    const minCount = count ?? this.batchSize;

    while (this.buffer.length < minCount && !this.done) {
      const result = await this.client.readDirectory(this.handleId);
      this.buffer.push(...result.entries);
      if (result.done) {
        this.done = true;
      }
    }

    const n = Math.min(minCount, this.buffer.length);
    return this.buffer.splice(0, n);
  }

  /**
   * Read all entries
   */
  async readAll(): Promise<DirectoryEntry[]> {
    const entries: DirectoryEntry[] = [];
    while (this.hasMore()) {
      const batch = await this.read();
      entries.push(...batch);
    }
    return entries;
  }

  /**
   * Has more entries
   */
  hasMore(): boolean {
    return !this.done || this.buffer.length > 0;
  }

  /**
   * Close directory
   */
  async close(): Promise<void> {
    if (this.handleId) {
      await this.client.closeDirectory(this.handleId);
      this.handleId = null;
      this.buffer = [];
      this.done = false;
    }
  }
}
