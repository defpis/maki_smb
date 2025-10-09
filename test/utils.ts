/**
 * Test Utilities
 */
import fs from "fs/promises";
import path from "path";
import { SMBClient } from "../src/client";
import config from "../config.json";

export const STORAGE_DIR = path.resolve(import.meta.dirname, "../storage");

export async function clearStorage(): Promise<void> {
  const entries = await fs.readdir(STORAGE_DIR);
  for (const entry of entries) {
    const fullPath = path.join(STORAGE_DIR, entry);
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      await fs.rm(fullPath, { recursive: true });
    } else {
      await fs.unlink(fullPath);
    }
  }
}

export async function createFile(
  name: string,
  content: string | Buffer = "",
): Promise<void> {
  const filePath = path.join(STORAGE_DIR, name);
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content);
}

export async function createDir(name: string): Promise<void> {
  const dirPath = path.join(STORAGE_DIR, name);
  await fs.mkdir(dirPath, { recursive: true });
}

export async function createFiles(
  files: { name: string; content?: string }[],
): Promise<void> {
  for (const file of files) {
    await createFile(file.name, file.content ?? "");
  }
}

export async function createClient(): Promise<SMBClient> {
  const client = new SMBClient({
    host: config.host,
    port: config.port ?? 445,
    share: config.share,
    username: config.username,
    password: config.password,
  });
  await client.connect();
  return client;
}
