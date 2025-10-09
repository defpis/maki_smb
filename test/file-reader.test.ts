/**
 * FileReader Tests
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SMBClient } from "../src/client";
import { FileReader } from "../src/file-reader";
import { clearStorage, createFile, createClient } from "./utils";

describe("FileReader", () => {
  let client: SMBClient;

  beforeEach(async () => {
    await clearStorage();
    client = await createClient();
  });

  afterEach(async () => {
    await clearStorage();
    client.close();
  });

  it("read empty file", async () => {
    await createFile("empty.txt", "");

    const reader = new FileReader(client);
    await reader.open("empty.txt");

    expect(reader.getSize()).toBe(0n);
    expect(reader.hasMore()).toBe(false);

    const data = await reader.read();
    expect(data.length).toBe(0);

    await reader.close();
  });

  it("read small file", async () => {
    const content = "Hello, SMB!";
    await createFile("small.txt", content);

    const reader = new FileReader(client);
    await reader.open("small.txt");

    expect(reader.getSize()).toBe(BigInt(content.length));

    const data = await reader.readAll();
    expect(data.toString()).toBe(content);

    await reader.close();
  });

  it("chunk read", async () => {
    const content = "ABCDEFGHIJ";
    await createFile("chunk.txt", content);

    const reader = new FileReader(client, { chunkSize: 3 });
    await reader.open("chunk.txt");

    const chunk1 = await reader.read();
    expect(chunk1.toString()).toBe("ABC");
    expect(reader.getOffset()).toBe(3n);

    const chunk2 = await reader.read();
    expect(chunk2.toString()).toBe("DEF");
    expect(reader.getOffset()).toBe(6n);

    const chunk3 = await reader.read();
    expect(chunk3.toString()).toBe("GHI");
    expect(reader.getOffset()).toBe(9n);

    const chunk4 = await reader.read();
    expect(chunk4.toString()).toBe("J");
    expect(reader.getOffset()).toBe(10n);
    expect(reader.hasMore()).toBe(false);

    await reader.close();
  });

  it("readBytes", async () => {
    const content = "0123456789";
    await createFile("bytes.txt", content);

    const reader = new FileReader(client);
    await reader.open("bytes.txt");

    const part1 = await reader.readBytes(5);
    expect(part1.toString()).toBe("01234");

    const part2 = await reader.readBytes(3);
    expect(part2.toString()).toBe("567");

    const part3 = await reader.readBytes(10);
    expect(part3.toString()).toBe("89");

    await reader.close();
  });

  it("seek", async () => {
    const content = "ABCDEFGHIJ";
    await createFile("seek.txt", content);

    const reader = new FileReader(client);
    await reader.open("seek.txt");

    reader.seek(5n);
    expect(reader.getOffset()).toBe(5n);

    const data = await reader.readBytes(3);
    expect(data.toString()).toBe("FGH");

    reader.seek(0n);
    const start = await reader.readBytes(3);
    expect(start.toString()).toBe("ABC");

    await reader.close();
  });

  it("client.readFile shortcut", async () => {
    const content = "Quick read test";
    await createFile("quick.txt", content);

    const data = await client.readFile("quick.txt");
    expect(data.toString()).toBe(content);
  });

  it("read binary file", async () => {
    const binary = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
    await createFile("binary.bin", binary);

    const reader = new FileReader(client);
    await reader.open("binary.bin");

    const data = await reader.readAll();
    expect(data.length).toBe(binary.length);
    expect(data.equals(binary)).toBe(true);

    await reader.close();
  });

  it("reopen", async () => {
    await createFile("reopen.txt", "content");

    const reader = new FileReader(client);

    await reader.open("reopen.txt");
    const first = await reader.readAll();
    expect(first.toString()).toBe("content");
    await reader.close();

    await reader.open("reopen.txt");
    const second = await reader.readAll();
    expect(second.toString()).toBe("content");
    await reader.close();
  });
});
