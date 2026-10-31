"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateProjectButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled room" }),
    });
    setLoading(false);
    if (!res.ok) return;
    const project = await res.json();
    router.push(`/projects/${project.id}`);
    router.refresh();
  }

  return (
    <button className="btn btn-accent" disabled={loading} onClick={() => void create()}>
      {loading ? "Creating…" : "New project"}
    </button>
  );
}
