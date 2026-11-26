/**
 * Create or promote a site administrator.
 *
 * Usage (from the app root, after migrations):
 *   npx tsx scripts/create-site-admin.ts --email you@example.com
 *   npx tsx scripts/create-site-admin.ts --email you@example.com --name "Site Admin"
 *
 * A new account receives a generated password printed once to stdout.
 * An existing account is promoted and its password is left unchanged.
 * Do not commit or log the printed password.
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateTemporaryPassword } from "../src/lib/temporary-password";

const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const filePath = dbUrl.startsWith("file:")
  ? path.resolve(process.cwd(), dbUrl.slice("file:".length))
  : dbUrl;

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: filePath }),
});

function argString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
    },
  });
  const email = argString(values.email)?.toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Usage: npx tsx scripts/create-site-admin.ts --email you@example.com [--name \"Name\"]");
    process.exit(1);
  }
  const name = argString(values.name) ?? email.split("@")[0]!;

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { memberships: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { isSiteAdmin: true, disabled: false },
    });
    if (existing.memberships.length === 0) {
      await prisma.org.create({
        data: {
          name: `${existing.name ?? name}'s workspace`,
          members: { create: { userId: existing.id, role: "owner" } },
        },
      });
    }
    console.log(`Promoted existing user ${email} to site administrator. Password was not changed.`);
    return;
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      isSiteAdmin: true,
    },
  });
  await prisma.org.create({
    data: {
      name: `${name}'s workspace`,
      members: { create: { userId: user.id, role: "owner" } },
    },
  });
  console.log(`Created site administrator ${email}`);
  console.log(`Temporary password (shown once): ${temporaryPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
