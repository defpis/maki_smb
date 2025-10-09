/**
 * SMB2 Read Command
 */
import { HEADER_SIZE } from "./constants";

export function buildRequest(
  fileId: Buffer,
  offset: bigint,
  length: number,
): Buffer {
  const body = Buffer.alloc(49);
  let pos = 0;

  // StructureSize (2) = 49
  body.writeUInt16LE(49, pos);
  pos += 2;

  // Padding (1)
  body.writeUInt8(0, pos);
  pos += 1;

  // Flags (1)
  body.writeUInt8(0, pos);
  pos += 1;

  // Length (4)
  body.writeUInt32LE(length, pos);
  pos += 4;

  // Offset (8)
  body.writeBigUInt64LE(offset, pos);
  pos += 8;

  // FileId (16)
  fileId.copy(body, pos);
  pos += 16;

  // MinimumCount (4)
  body.writeUInt32LE(0, pos);
  pos += 4;

  // Channel (4)
  body.writeUInt32LE(0, pos);
  pos += 4;

  // RemainingBytes (4)
  body.writeUInt32LE(0, pos);
  pos += 4;

  // ReadChannelInfoOffset (2)
  body.writeUInt16LE(0, pos);
  pos += 2;

  // ReadChannelInfoLength (2)
  body.writeUInt16LE(0, pos);
  pos += 2;

  // Buffer (1)
  body.writeUInt8(0, pos);

  return body;
}

export function parseResponse(body: Buffer): Buffer {
  const dataOffset = body.readUInt8(2) - HEADER_SIZE;
  const dataLength = body.readUInt32LE(4);

  if (dataLength === 0) {
    return Buffer.alloc(0);
  }

  return Buffer.from(body.subarray(dataOffset, dataOffset + dataLength));
}
