import { readFile } from "fs/promises";
import path from "path";

export default async function SolverDocPage() {
  const text = await readFile(path.join(process.cwd(), "docs/SOLVER.md"), "utf8");
  const migration = await readFile(
    path.join(process.cwd(), "docs/SERVER_SOLVER_MIGRATION.md"),
    "utf8"
  );
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <pre className="panel p-6 whitespace-pre-wrap text-sm leading-relaxed font-sans">{text}</pre>
      <pre className="panel p-6 whitespace-pre-wrap text-sm leading-relaxed font-sans">
        {migration}
      </pre>
    </div>
  );
}
