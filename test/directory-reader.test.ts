/**
 * DirectoryReader Tests
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SMBClient } from "../src/client";
import { DirectoryReader } from "../src/directory-reader";
import { clearStorage, createFiles, createClient } from "./utils";

describe("DirectoryReader", () => {
  let client: SMBClient;

  beforeEach(async () => {
    await clearStorage();
    client = await createClient();
  });

  afterEach(async () => {
    await clearStorage();
    client.close();
  });

  it("empty directory", async () => {
    const reader = new DirectoryReader(client);
    await reader.open("");

    const entries = await reader.read(10);
    expect(entries).toHaveLength(0);
    expect(reader.hasMore()).toBe(false);

    await reader.close();
  });

  it("single read", async () => {
    await createFiles([
      { name: "1.txt" },
      { name: "2.txt" },
      { name: "3.txt" },
    ]);

    const reader = new DirectoryReader(client);
    await reader.open("");

    const entries = await reader.read(10);
    expect(entries).toHaveLength(3);

    await reader.close();
  });

  it("batch read", async () => {
    await createFiles([
      { name: "1.txt" },
      { name: "2.txt" },
      { name: "3.txt" },
      { name: "4.txt" },
      { name: "5.txt" },
    ]);

    const reader = new DirectoryReader(client);
    await reader.open("");

    const batch1 = await reader.read(2);
    expect(batch1).toHaveLength(2);
    expect(reader.hasMore()).toBe(true);

    const batch2 = await reader.read(2);
    expect(batch2).toHaveLength(2);
    expect(reader.hasMore()).toBe(true);

    const batch3 = await reader.read(2);
    expect(batch3).toHaveLength(1);
    expect(reader.hasMore()).toBe(false);

    await reader.close();
  });

  it("read all", async () => {
    await createFiles([
      { name: "a.txt" },
      { name: "b.txt" },
      { name: "c.txt" },
      { name: "d.txt" },
    ]);

    const reader = new DirectoryReader(client);
    await reader.open("");

    const all: string[] = [];
    while (reader.hasMore()) {
      const batch = await reader.read(2);
      if (batch.length === 0) break;
      all.push(...batch.map((e) => e.fileName));
    }

    expect(all).toHaveLength(4);
    expect(all).toContain("a.txt");
    expect(all).toContain("d.txt");

    await reader.close();
  });

  it("reopen", async () => {
    await createFiles([{ name: "test.txt" }]);

    const reader = new DirectoryReader(client);

    await reader.open("");
    const first = await reader.read(10);
    expect(first).toHaveLength(1);
    await reader.close();

    await reader.open("");
    const second = await reader.read(10);
    expect(second).toHaveLength(1);
    await reader.close();
  });
});
