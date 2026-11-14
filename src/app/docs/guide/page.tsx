import { readFile } from "fs/promises";
import path from "path";
import Link from "next/link";
import { UserGuideArticle } from "@/lib/user-guide-markdown";

export const metadata = { title: "User guide / 使用手冊 · LUXSIM" };

async function readUserGuide(): Promise<string> {
  return readFile(path.join(process.cwd(), "docs/USER_GUIDE.md"), "utf8");
}

export default async function UserGuidePage() {
  const markdown = await readUserGuide();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <UserGuideArticle markdown={markdown} />
      <p className="mt-10 text-sm text-[var(--muted)]">
        <Link className="text-[var(--accent-2)] underline" href="/docs">
          Other documentation
        </Link>
      </p>
    </div>
  );
}
