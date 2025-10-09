/**
 * SMB2 Tree Connect Command
 */
import { HEADER_SIZE } from "./constants";

export function buildRequest(path: string): Buffer {
  const pathBuf = Buffer.from(path, "ucs2");
  const fixedSize = 8;
  const body = Buffer.alloc(fixedSize + pathBuf.length);
  let offset = 0;

  // StructureSize (2) = 9
  body.writeUInt16LE(9, offset);
  offset += 2;

  // Reserved (2)
  offset += 2;

  // PathOffset (2)
  body.writeUInt16LE(HEADER_SIZE + fixedSize, offset);
  offset += 2;

  // PathLength (2)
  body.writeUInt16LE(pathBuf.length, offset);
  offset += 2;

  // Path
  pathBuf.copy(body, offset);

  return body;
}
