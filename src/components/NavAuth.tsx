"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { AUTOSAVE_INTERVALS } from "@/lib/account-settings";
import { useAccountSettings } from "@/components/AccountSettingsProvider";

export function NavAuth() {
  const { data: session, status } = useSession();
  const account = useAccountSettings();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

  const email = session.user.email ?? "Account";
  const autosaveMs = account.autosaveMs;
  const minutes = autosaveMs / 60_000;

  return (
    <>
      <Link href="/projects" className="hover:text-[var(--accent-2)]">
        Projects
      </Link>
      <Link href="/library" className="hover:text-[var(--accent-2)]">
        Library
      </Link>
      {session.user.isWorkspaceOwner && (
        <Link href="/workspace/members" className="hover:text-[var(--accent-2)]">
          Members
        </Link>
      )}
      {session.user.isSiteAdmin && (
        <Link href="/admin/users" className="hover:text-[var(--accent-2)]">
          Admin
        </Link>
      )}
      <Link href="/docs/guide" className="hover:text-[var(--accent-2)]">
        User guide
      </Link>
      <div className="relative" ref={rootRef}>
        <button
          type="button"
          className="nav-account-btn hidden sm:inline-flex"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
        >
          {email}
        </button>
        <button
          type="button"
          className="nav-account-btn sm:hidden"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
        >
          Account
        </button>
        {open && (
          <div className="account-popover" role="dialog" aria-label="Account settings">
            <p className="account-popover__title">Account settings</p>
            <p className="account-popover__email">{email}</p>
            <label className="account-popover__label" htmlFor="save-reminder-interval">
              Save reminder
            </label>
            <select
              id="save-reminder-interval"
              className="account-popover__select"
              value={autosaveMs}
              onChange={(e) => {
                void account.saveAutosaveMs(Number(e.target.value));
              }}
            >
              {AUTOSAVE_INTERVALS.map((opt) => (
                <option key={opt.ms} value={opt.ms}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="account-popover__hint">
              {autosaveMs === 0
                ? "No reminder. You can still click Save in the editor."
                : `Reminds you to save every ${minutes} min when there are unsaved changes.`}
            </p>
            <button
              type="button"
              className="btn nav-signout w-full !py-1.5 !px-3 !text-xs"
              onClick={() => void signOut({ callbackUrl: "/" })}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        className="btn nav-signout !py-1.5 !px-3 !text-xs"
        onClick={() => void signOut({ callbackUrl: "/" })}
      >
        Sign out
      </button>
    </>
  );
}
