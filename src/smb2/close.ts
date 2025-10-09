/**
 * SMB2 Close Command
 */

export function buildRequest(fileId: Buffer): Buffer {
  const body = Buffer.alloc(24);

  // StructureSize (2) = 24
  body.writeUInt16LE(24, 0);

  // Flags (2) + Reserved (4) = 0

  // FileId (16)
  fileId.copy(body, 8);

  return body;
}
