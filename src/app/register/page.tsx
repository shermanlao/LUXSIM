"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      email: String(form.get("email")),
      password: String(form.get("password")),
      name: String(form.get("name") || ""),
      orgName: String(form.get("orgName") || ""),
    };
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      setError(data.error || "Registration failed");
      return;
    }
    const sign = await signIn("credentials", {
      email: payload.email,
      password: payload.password,
      redirect: false,
    });
    setLoading(false);
    if (sign?.error) {
      setError("Account created — please sign in");
      window.location.href = "/login";
      return;
    }
    window.location.href = "/projects";
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="display text-4xl mb-2">Create workspace</h1>
      <p className="text-[var(--muted)] mb-8">Start importing IES/LDT and designing rooms</p>
      <form onSubmit={onSubmit} className="panel p-6 space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input className="input" id="name" name="name" />
        </div>
        <div>
          <label className="label" htmlFor="orgName">
            Organization
          </label>
          <input className="input" id="orgName" name="orgName" placeholder="My studio" />
        </div>
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
        <button className="btn btn-accent w-full" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Already registered?{" "}
        <Link href="/login" className="text-[var(--accent-2)] underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
