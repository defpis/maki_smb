/**
 * SMB2 Create Command
 */
import { HEADER_SIZE } from "./constants";

export interface CreateOptions {
  directory?: boolean;
}

export function buildRequest(
  path: string,
  options: CreateOptions = {},
): Buffer {
  const { directory = true } = options;
  const pathBuf = path ? Buffer.from(path, "ucs2") : Buffer.alloc(0);
  const fixedSize = 56;
  const bufferSize = Math.max(pathBuf.length, 1);
  const body = Buffer.alloc(fixedSize + bufferSize);
  let offset = 0;

  // StructureSize (2) = 57
  body.writeUInt16LE(57, offset);
  offset += 2;

  // SecurityFlags (1)
  offset += 1;

  // RequestedOplockLevel (1)
  offset += 1;

  // ImpersonationLevel (4) = Impersonation
  body.writeUInt32LE(2, offset);
  offset += 4;

  // SmbCreateFlags (8)
  offset += 8;

  // Reserved (8)
  offset += 8;

  // DesiredAccess (4)
  body.writeUInt32LE(0x00100081, offset);
  offset += 4;

  // FileAttributes (4)
  offset += 4;

  // ShareAccess (4) = READ | WRITE | DELETE
  body.writeUInt32LE(0x07, offset);
  offset += 4;

  // CreateDisposition (4) = FILE_OPEN
  body.writeUInt32LE(1, offset);
  offset += 4;

  // CreateOptions (4)
  body.writeUInt32LE(directory ? 0x00000001 : 0x00000040, offset);
  offset += 4;

  // NameOffset (2)
  body.writeUInt16LE(HEADER_SIZE + fixedSize, offset);
  offset += 2;

  // NameLength (2)
  body.writeUInt16LE(pathBuf.length, offset);
  offset += 2;

  // CreateContextsOffset (4)
  offset += 4;

  // CreateContextsLength (4)
  offset += 4;

  // Buffer
  if (pathBuf.length > 0) {
    pathBuf.copy(body, fixedSize);
  }

  return body;
}

export function parseResponse(body: Buffer) {
  return {
    fileId: Buffer.from(body.subarray(64, 80)),
    endOfFile: body.readBigUInt64LE(48),
  };
}
