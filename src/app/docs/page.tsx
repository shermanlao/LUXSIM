import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="display text-4xl mb-4">Documentation</h1>
      <p className="text-[var(--muted)] mb-8">
        Start with the user guide for editor operations. Product and calculation notes are also here if you need them.
      </p>
      <ul className="space-y-3 text-sm">
        <li>
          <Link className="text-[var(--accent-2)] underline text-base font-semibold" href="/docs/guide">
            User guide / 使用手冊
          </Link>
          <p className="text-[var(--muted)] mt-1">
            Plan zoom, drawing rooms, Backspace and Esc, and room properties.
          </p>
        </li>
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
