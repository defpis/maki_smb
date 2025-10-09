/**
 * SMB2 Negotiate Command
 */
import { HEADER_SIZE } from "./constants";

export function buildRequest(): Buffer {
  const body = Buffer.alloc(40);
  let offset = 0;

  // StructureSize (2) = 36
  body.writeUInt16LE(36, offset);
  offset += 2;

  // DialectCount (2) = 2
  body.writeUInt16LE(2, offset);
  offset += 2;

  // SecurityMode (2) = 1
  body.writeUInt16LE(1, offset);
  offset += 2;

  // Reserved (2)
  offset += 2;

  // Capabilities (4)
  offset += 4;

  // ClientGuid (16)
  offset += 16;

  // ClientStartTime (8)
  offset += 8;

  // Dialects: SMB 2.0.2, SMB 2.1
  body.writeUInt16LE(0x0202, offset);
  body.writeUInt16LE(0x0210, offset + 2);

  return body;
}

export function parseResponse(body: Buffer) {
  const securityBufferOffset = body.readUInt16LE(56) - HEADER_SIZE;
  const securityBufferLength = body.readUInt16LE(58);

  return {
    dialectRevision: body.readUInt16LE(4),
    securityBuffer: body.subarray(
      securityBufferOffset,
      securityBufferOffset + securityBufferLength,
    ),
  };
}
