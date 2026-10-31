import Link from "next/link";
import { readFile } from "fs/promises";
import path from "path";

async function readDoc(name: string): Promise<string> {
  try {
    return await readFile(path.join(process.cwd(), "docs", name), "utf8");
  } catch {
    return `_Missing ${name}_`;
  }
}

export default async function DocsPage() {
  const index = await readDoc("MARKDOWN_INDEX.md");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 prose-like">
      <h1 className="display text-4xl mb-4">Documentation</h1>
      <p className="text-[var(--muted)] mb-8">
        Guides live in <code>docs/</code>. Full markdown is also on disk for the agent/repo.
      </p>
      <div className="panel p-6 whitespace-pre-wrap text-sm leading-relaxed">{index}</div>
      <ul className="mt-6 space-y-2 text-sm">
        <li>
          <Link className="text-[var(--accent-2)] underline" href="/docs/product">
            Product MVP
          </Link>
        </li>
        <li>
          <Link className="text-[var(--accent-2)] underline" href="/docs/dialux">
            DIALux interop
          </Link>
        </li>
        <li>
          <Link className="text-[var(--accent-2)] underline" href="/docs/solver">
            Solver notes
          </Link>
        </li>
      </ul>
    </div>
  );
}
