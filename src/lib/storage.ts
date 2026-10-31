import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

function storageRoot(): string {
  return path.resolve(process.cwd(), process.env.STORAGE_DIR ?? "./storage");
}

export async function ensureStorage(): Promise<void> {
  await fs.mkdir(storageRoot(), { recursive: true });
}

export async function saveTextFile(
  category: string,
  filename: string,
  content: string
): Promise<string> {
  await ensureStorage();
  const key = `${category}/${randomUUID()}-${filename}`;
  const full = path.join(storageRoot(), key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
  return key;
}

export async function readTextFile(fileKey: string): Promise<string> {
  const full = path.join(storageRoot(), fileKey);
  return fs.readFile(full, "utf8");
}

export async function saveBinaryFile(
  category: string,
  filename: string,
  data: Buffer
): Promise<string> {
  await ensureStorage();
  const key = `${category}/${randomUUID()}-${filename}`;
  const full = path.join(storageRoot(), key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return key;
}

export function absolutePath(fileKey: string): string {
  return path.join(storageRoot(), fileKey);
}
