"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

type Mode = "signin" | "forgot-request" | "forgot-verify" | "forgot-done";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  function go(next: Mode) {
    setError(null);
    setNotice(null);
    setMode(next);
  }

  async function onSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(form.get("email")),
      password: String(form.get("password")),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    window.location.href = "/projects";
  }

  async function onRequestCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    const res = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not send a reset code just now. Please try again later.");
      return;
    }
    setResetEmail(email);
    setNotice(
      data.message ||
        "If that email is registered, a reset code has been sent. Enter the code on this screen. It expires in 10 minutes."
    );
    setMode("forgot-verify");
  }

  async function onVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    const otp = String(form.get("otp")).trim();
    const password = String(form.get("password"));
    const confirm = String(form.get("confirmPassword"));
    if (password !== confirm) {
      setLoading(false);
      setError("Passwords do not match");
      return;
    }
    const res = await fetch("/api/auth/password-reset/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Invalid or expired code.");
      return;
    }
    setNotice(data.message || "Your password has been changed. Sign in with your new password.");
    setMode("forgot-done");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      {mode === "signin" && (
        <>
          <h1 className="display text-4xl mb-2">Sign in</h1>
          <p className="text-[var(--muted)] mb-8">Access your LUXSIM workspace</p>
          <form onSubmit={onSignIn} className="panel p-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input className="input" id="email" name="email" type="email" required />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                minLength={6}
                required
              />
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button className="btn w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-sm text-[var(--muted)]">
              <button
                type="button"
                className="text-[var(--accent-2)] underline"
                onClick={() => go("forgot-request")}
              >
                Forgot password?
              </button>
            </p>
          </form>
          <p className="mt-4 text-sm text-[var(--muted)]">
            No account?{" "}
            <Link href="/register" className="text-[var(--accent-2)] underline">
              Register
            </Link>
          </p>
        </>
      )}

      {mode === "forgot-request" && (
        <>
          <h1 className="display text-4xl mb-2">Reset password</h1>
          <p className="text-[var(--muted)] mb-8">
            Enter your registered email. If it has an account, we will send a 6-digit code there —
            not a link.
          </p>
          <form onSubmit={onRequestCode} className="panel p-6 space-y-4">
            <div>
              <label className="label" htmlFor="reset-email">
                Email
              </label>
              <input
                className="input"
                id="reset-email"
                name="email"
                type="email"
                defaultValue={resetEmail}
                required
              />
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button className="btn w-full" disabled={loading}>
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
          <p className="mt-4 text-sm text-[var(--muted)]">
            <button type="button" className="text-[var(--accent-2)] underline" onClick={() => go("signin")}>
              Back to sign in
            </button>
          </p>
        </>
      )}

      {mode === "forgot-verify" && (
        <>
          <h1 className="display text-4xl mb-2">Enter your code</h1>
          <p className="text-[var(--muted)] mb-8">
            {notice ||
              "If that email is registered, a reset code has been sent. Enter the code below. It expires in 10 minutes."}
          </p>
          <form onSubmit={onVerify} className="panel p-6 space-y-4">
            <div>
              <label className="label" htmlFor="verify-email">
                Email
              </label>
              <input
                className="input"
                id="verify-email"
                name="email"
                type="email"
                value={resetEmail}
                onChange={(ev) => setResetEmail(ev.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="otp">
                6-digit code
              </label>
              <input
                className="input"
                id="otp"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="new-password">
                New password
              </label>
              <input
                className="input"
                id="new-password"
                name="password"
                type="password"
                minLength={6}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="confirm-password">
                Confirm password
              </label>
              <input
                className="input"
                id="confirm-password"
                name="confirmPassword"
                type="password"
                minLength={6}
                autoComplete="new-password"
                required
              />
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button className="btn w-full" disabled={loading}>
              {loading ? "Resetting…" : "Reset password"}
            </button>
          </form>
          <p className="mt-4 text-sm text-[var(--muted)] space-x-3">
            <button
              type="button"
              className="text-[var(--accent-2)] underline"
              onClick={() => go("forgot-request")}
            >
              Request a new code
            </button>
            <button type="button" className="text-[var(--accent-2)] underline" onClick={() => go("signin")}>
              Back to sign in
            </button>
          </p>
        </>
      )}

      {mode === "forgot-done" && (
        <>
          <h1 className="display text-4xl mb-2">Password changed</h1>
          <p className="text-[var(--muted)] mb-8">
            {notice || "Your password has been changed. Sign in with your new password."}
          </p>
          <div className="panel p-6 space-y-4">
            <button className="btn w-full" type="button" onClick={() => go("signin")}>
              Sign in
            </button>
          </div>
        </>
      )}
    </div>
  );
}
