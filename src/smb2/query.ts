/**
 * SMB2 Query Directory Command
 */
import { HEADER_SIZE } from "./constants";
import type { DirectoryEntry } from "./types";

export function buildRequest(fileId: Buffer, pattern: string = "*"): Buffer {
  const patternBuf = Buffer.from(pattern, "ucs2");
  const fixedSize = 32;
  const body = Buffer.alloc(fixedSize + patternBuf.length);
  let offset = 0;

  // StructureSize (2) = 33
  body.writeUInt16LE(33, offset);
  offset += 2;

  // FileInformationClass (1) = FileIdBothDirectoryInformation
  body.writeUInt8(37, offset);
  offset += 1;

  // Flags (1)
  offset += 1;

  // FileIndex (4)
  offset += 4;

  // FileId (16)
  fileId.copy(body, offset);
  offset += 16;

  // FileNameOffset (2)
  body.writeUInt16LE(HEADER_SIZE + fixedSize, offset);
  offset += 2;

  // FileNameLength (2)
  body.writeUInt16LE(patternBuf.length, offset);
  offset += 2;

  // OutputBufferLength (4) = 64KB
  body.writeUInt32LE(0x10000, offset);
  offset += 4;

  // FileName
  patternBuf.copy(body, fixedSize);

  return body;
}

export function parseResponse(body: Buffer): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];
  const outputOffset = body.readUInt16LE(2) - HEADER_SIZE;
  const outputLength = body.readUInt32LE(4);

  if (outputLength === 0) return entries;

  let pos = outputOffset;
  const end = outputOffset + outputLength;

  while (pos < end) {
    const nextOffset = body.readUInt32LE(pos);
    const fileNameLength = body.readUInt32LE(pos + 60);
    const fileAttributes = body.readUInt32LE(pos + 56);

    const fileName = body
      .subarray(pos + 104, pos + 104 + fileNameLength)
      .toString("ucs2");

    if (fileName !== "." && fileName !== "..") {
      entries.push({
        fileName,
        isDirectory: (fileAttributes & 0x10) !== 0,
        fileSize: body.readBigUInt64LE(pos + 40),
        creationTime: filetimeToDate(body.readBigUInt64LE(pos + 8)),
        lastWriteTime: filetimeToDate(body.readBigUInt64LE(pos + 24)),
      });
    }

    if (nextOffset === 0) break;
    pos += nextOffset;
  }

  return entries;
}

function filetimeToDate(filetime: bigint): Date {
  const ms = Number(filetime / 10000n) - 11644473600000;
  return new Date(ms);
}
