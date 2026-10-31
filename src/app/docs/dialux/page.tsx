import { readFile } from "fs/promises";
import path from "path";

export default async function DialuxDocPage() {
  const text = await readFile(path.join(process.cwd(), "docs/DIALUX_INTEROP.md"), "utf8");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <pre className="panel p-6 whitespace-pre-wrap text-sm leading-relaxed font-sans">{text}</pre>
    </div>
  );
}
