/**
 * SMB2 Header - Build and parse
 */
import { HEADER_SIZE, PROTOCOL_ID } from "./constants";
import type { MessageOptions, ResponseHeader } from "./types";

export function buildMessage(opts: MessageOptions): Buffer {
  const header = Buffer.alloc(HEADER_SIZE);
  let offset = 0;

  // ProtocolId (4)
  PROTOCOL_ID.copy(header, offset);
  offset += 4;

  // StructureSize (2) = 64
  header.writeUInt16LE(64, offset);
  offset += 2;

  // CreditCharge (2)
  header.writeUInt16LE(0, offset);
  offset += 2;

  // Status (4)
  header.writeUInt32LE(0, offset);
  offset += 4;

  // Command (2)
  header.writeUInt16LE(opts.command, offset);
  offset += 2;

  // CreditRequest (2)
  header.writeUInt16LE(126, offset);
  offset += 2;

  // Flags (4)
  header.writeUInt32LE(0, offset);
  offset += 4;

  // NextCommand (4)
  header.writeUInt32LE(0, offset);
  offset += 4;

  // MessageId (8)
  header.writeUInt32LE(opts.messageId, offset);
  header.writeUInt32LE(0, offset + 4);
  offset += 8;

  // ProcessId (4)
  opts.processId.copy(header, offset);
  offset += 4;

  // TreeId (4)
  header.writeUInt32LE(opts.treeId ?? 0, offset);
  offset += 4;

  // SessionId (8)
  if (opts.sessionId) {
    opts.sessionId.copy(header, offset);
  }

  return Buffer.concat([header, opts.body]);
}

export function parseHeader(buf: Buffer): ResponseHeader {
  return {
    status: buf.readUInt32LE(8),
    command: buf.readUInt16LE(12),
    messageId: buf.readUInt32LE(24),
    treeId: buf.readUInt32LE(36),
    sessionId: Buffer.from(buf.subarray(40, 48)),
  };
}

export function getBody(buf: Buffer): Buffer {
  return buf.subarray(HEADER_SIZE);
}
