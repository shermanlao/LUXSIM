import Link from "next/link";
import { NavAuth } from "@/components/NavAuth";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--line)] bg-[color-mix(in_srgb,white_70%,transparent)] backdrop-blur-md">
        <div className="w-full px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="display text-2xl tracking-tight">
            LUX<span className="text-[var(--accent)]">SIM</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <NavAuth />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[var(--line)] text-sm text-[var(--muted)]">
        <div className="w-full px-4 py-4 flex flex-wrap gap-3 justify-between">
          <span>LUXSIM — lightweight lighting design assist</span>
          <span>Not tender-certified · Verify critical work in DIALux</span>
        </div>
      </footer>
    </div>
  );
}
