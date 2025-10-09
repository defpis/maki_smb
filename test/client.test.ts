/**
 * SMBClient Tests
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SMBClient } from "../src/client";
import { clearStorage, createFile, createDir, createClient } from "./utils";

describe("SMBClient", () => {
  let client: SMBClient;

  beforeEach(async () => {
    await clearStorage();
    client = await createClient();
  });

  afterEach(async () => {
    await clearStorage();
    client.close();
  });

  describe("listDirectory", () => {
    it("empty directory", async () => {
      const entries = await client.listDirectory();
      expect(entries).toHaveLength(0);
    });

    it("single file", async () => {
      await createFile("test.txt", "hello");

      const entries = await client.listDirectory();
      expect(entries).toHaveLength(1);
      expect(entries[0].fileName).toBe("test.txt");
      expect(entries[0].isDirectory).toBe(false);
    });

    it("single directory", async () => {
      await createDir("subdir");

      const entries = await client.listDirectory();
      expect(entries).toHaveLength(1);
      expect(entries[0].fileName).toBe("subdir");
      expect(entries[0].isDirectory).toBe(true);
    });

    it("multiple files and directories", async () => {
      await createFile("a.txt");
      await createFile("b.txt");
      await createDir("folder1");
      await createDir("folder2");

      const entries = await client.listDirectory();
      expect(entries).toHaveLength(4);

      const names = entries.map((e) => e.fileName);
      expect(names).toContain("a.txt");
      expect(names).toContain("b.txt");
      expect(names).toContain("folder1");
      expect(names).toContain("folder2");
    });

    it("subdirectory", async () => {
      await createDir("parent");
      await createFile("parent/child.txt", "content");

      const rootEntries = await client.listDirectory();
      expect(rootEntries).toHaveLength(1);
      expect(rootEntries[0].fileName).toBe("parent");

      const subEntries = await client.listDirectory("parent");
      expect(subEntries).toHaveLength(1);
      expect(subEntries[0].fileName).toBe("child.txt");
    });

    it("file size", async () => {
      const content = "Hello, World!";
      await createFile("size.txt", content);

      const entries = await client.listDirectory();
      expect(entries[0].fileSize).toBe(BigInt(content.length));
    });

    it("special filenames", async () => {
      await createFile("file with spaces.txt");
      await createFile("中文文件.txt");

      const entries = await client.listDirectory();
      const names = entries.map((e) => e.fileName);
      expect(names).toContain("file with spaces.txt");
      expect(names).toContain("中文文件.txt");
    });
  });

  describe("readFile", () => {
    it("read file content", async () => {
      const content = "Hello, SMB!";
      await createFile("hello.txt", content);

      const data = await client.readFile("hello.txt");
      expect(data.toString()).toBe(content);
    });

    it("read empty file", async () => {
      await createFile("empty.txt", "");

      const data = await client.readFile("empty.txt");
      expect(data.length).toBe(0);
    });

    it("read file in subdirectory", async () => {
      await createDir("subdir");
      await createFile("subdir/file.txt", "nested content");

      const data = await client.readFile("subdir/file.txt");
      expect(data.toString()).toBe("nested content");
    });
  });
});
