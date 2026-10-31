import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveDbUrl(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (url === ":memory:") return url;
  if (url.startsWith("file:")) {
    const rel = url.slice("file:".length);
    if (path.isAbsolute(rel)) return rel;
    return path.resolve(process.cwd(), rel);
  }
  return url;
}

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: resolveDbUrl() });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
