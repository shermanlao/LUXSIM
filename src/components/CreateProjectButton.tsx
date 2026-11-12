"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type WorkspaceOption = { id: string; name: string };

export function CreateProjectButton({ workspaces = [] }: { workspaces?: WorkspaceOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState(workspaces[0]?.id ?? "");

  async function create() {
    setLoading(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Untitled room",
        orgId: orgId || undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) return;
    const project = await res.json();
    router.push(`/projects/${project.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {workspaces.length > 1 && (
        <label className="sr-only" htmlFor="new-project-workspace">
          Workspace
        </label>
      )}
      {workspaces.length > 1 && (
        <select
          id="new-project-workspace"
          className="select !w-auto"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>
      )}
      <button className="btn btn-accent" disabled={loading || workspaces.length === 0} onClick={() => void create()}>
        {loading ? "Creating…" : "New project"}
      </button>
    </div>
  );
}
