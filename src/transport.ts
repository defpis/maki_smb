/**
 * SMB Transport - TCP + NetBIOS framing
 */
import { Socket } from "net";

interface Pending {
  resolve: (buf: Buffer) => void;
  reject: (err: Error) => void;
}

export class Transport {
  private socket = new Socket();
  private pending = new Map<number, Pending>();
  private buffer = Buffer.alloc(0);

  /**
   * Connect to server
   */
  async connect(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.once("connect", resolve);
      this.socket.once("error", reject);
      this.socket.on("data", (data) => this.onData(data));
      this.socket.connect(port, host);
    });
  }

  /**
   * Send message and wait for response
   */
  async send(data: Buffer): Promise<Buffer> {
    const messageId = data.readUInt32LE(24);

    return new Promise((resolve, reject) => {
      this.pending.set(messageId, { resolve, reject });

      // NetBIOS frame: 4-byte length (BE) + data
      const frame = Buffer.alloc(4 + data.length);
      frame.writeUInt32BE(data.length, 0);
      data.copy(frame, 4);
      this.socket.write(frame);
    });
  }

  /**
   * Close connection
   */
  close(): void {
    this.socket.destroy();
  }

  private onData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);

    while (this.buffer.length >= 4) {
      const len = this.buffer.readUInt32BE(0);
      if (this.buffer.length < 4 + len) break;

      const msg = this.buffer.subarray(4, 4 + len);
      this.buffer = this.buffer.subarray(4 + len);

      const messageId = msg.readUInt32LE(24);
      const pending = this.pending.get(messageId);
      if (pending) {
        this.pending.delete(messageId);
        pending.resolve(msg);
      }
    }
  }
}
