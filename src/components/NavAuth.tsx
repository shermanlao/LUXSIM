"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function NavAuth() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-sm text-[var(--muted)]">…</span>;
  }

  if (!session) {
    return (
      <>
        <Link href="/login" className="hover:text-[var(--accent-2)]">
          Sign in
        </Link>
        <Link href="/register" className="btn btn-accent !py-1.5 !px-3 !text-xs">
          Get started
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/projects" className="hover:text-[var(--accent-2)]">
        Projects
      </Link>
      <Link href="/library" className="hover:text-[var(--accent-2)]">
        Library
      </Link>
      <Link href="/docs" className="hover:text-[var(--accent-2)]">
        Docs
      </Link>
      <span className="text-[var(--muted)] hidden sm:inline">{session.user.email}</span>
      <button
        type="button"
        className="btn btn-secondary !py-1.5 !px-3 !text-xs"
        onClick={() => void signOut({ callbackUrl: "/" })}
      >
        Sign out
      </button>
    </>
  );
}
