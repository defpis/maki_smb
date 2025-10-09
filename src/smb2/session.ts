/**
 * SMB2 Session Setup Command
 */
import { HEADER_SIZE } from "./constants";

export function buildRequest(securityBuffer: Buffer): Buffer {
  const fixedSize = 24;
  const body = Buffer.alloc(fixedSize + securityBuffer.length);
  let offset = 0;

  // StructureSize (2) = 25
  body.writeUInt16LE(25, offset);
  offset += 2;

  // Flags (1)
  offset += 1;

  // SecurityMode (1) = 1
  body.writeUInt8(1, offset);
  offset += 1;

  // Capabilities (4) = 1
  body.writeUInt32LE(1, offset);
  offset += 4;

  // Channel (4)
  offset += 4;

  // SecurityBufferOffset (2)
  body.writeUInt16LE(HEADER_SIZE + fixedSize, offset);
  offset += 2;

  // SecurityBufferLength (2)
  body.writeUInt16LE(securityBuffer.length, offset);
  offset += 2;

  // PreviousSessionId (8)
  offset += 8;

  // SecurityBuffer
  securityBuffer.copy(body, offset);

  return body;
}

export function parseResponse(body: Buffer) {
  const securityBufferOffset = body.readUInt16LE(4) - HEADER_SIZE;
  const securityBufferLength = body.readUInt16LE(6);

  return {
    sessionFlags: body.readUInt16LE(2),
    securityBuffer: body.subarray(
      securityBufferOffset,
      securityBufferOffset + securityBufferLength,
    ),
  };
}
