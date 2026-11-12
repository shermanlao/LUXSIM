"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Member = {
  userId: string;
  email: string;
  name: string | null;
  disabled: boolean;
  role: string;
};
type Project = { id: string; name: string; updatedAt: string };
type Workspace = {
  id: string;
  name: string;
  createdAt: string;
  luminaireCount: number;
  members: Member[];
  projects: Project[];
};

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
}

export function WorkspacesAdminClient() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState<Record<string, string>>({});
  const [addRole, setAddRole] = useState<Record<string, "owner" | "member">>({});

  const refresh = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/workspaces");
    if (!res.ok) {
      setError(await readError(res, "Failed to load workspaces"));
      setLoading(false);
      return;
    }
    setWorkspaces((await res.json()) as Workspace[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addMember(orgId: string) {
    const email = (addEmail[orgId] ?? "").trim();
    if (!email) return;
    setError(null);
    const res = await fetch(`/api/admin/workspaces/${orgId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: addRole[orgId] ?? "member" }),
    });
    if (!res.ok) {
      setError(await readError(res, "Failed to add member"));
      return;
    }
    setAddEmail((s) => ({ ...s, [orgId]: "" }));
    await refresh();
  }

  async function setRole(orgId: string, userId: string, role: string) {
    setError(null);
    const res = await fetch(`/api/admin/workspaces/${orgId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      setError(await readError(res, "Failed to change role"));
      return;
    }
    await refresh();
  }

  async function removeMember(orgId: string, member: Member) {
    if (!window.confirm(`Remove ${member.email} from this workspace? The account itself will not be deleted.`)) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/admin/workspaces/${orgId}/members/${member.userId}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await readError(res, "Failed to remove member"));
      return;
    }
    await refresh();
  }

  async function deleteWorkspace(ws: Workspace) {
    const ok = window.confirm(
      `Delete workspace “${ws.name}” and all of its projects? This cannot be undone. Users will not be deleted.`
    );
    if (!ok) return;
    const typed = window.prompt(`Type the workspace name to confirm: ${ws.name}`);
    if (typed !== ws.name) {
      setError("Workspace was not deleted — the name did not match.");
      return;
    }
    setError(null);
    const res = await fetch(`/api/admin/workspaces/${ws.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await readError(res, "Failed to delete workspace"));
      return;
    }
    await refresh();
  }

  return (
    <div>
      <h1 className="display text-4xl mb-2">Workspaces</h1>
      <p className="text-[var(--muted)] mb-6">
        Members, projects, and membership changes for each organisation. Opening a project uses the editor.
      </p>
      {error && <p className="text-sm text-red-700 mb-4">{error}</p>}
      {loading ? (
        <p className="text-[var(--muted)]">Loading…</p>
      ) : workspaces.length === 0 ? (
        <div className="panel p-6 text-[var(--muted)]">No workspaces yet.</div>
      ) : (
        <div className="space-y-5">
          {workspaces.map((ws) => (
            <section key={ws.id} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="display text-2xl">{ws.name}</h2>
                  <p className="text-sm text-[var(--muted)]">
                    {ws.members.length} member{ws.members.length === 1 ? "" : "s"} · {ws.projects.length} project
                    {ws.projects.length === 1 ? "" : "s"} · {ws.luminaireCount} luminaire
                    {ws.luminaireCount === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary !py-1.5 !px-3 !text-xs"
                  onClick={() => void deleteWorkspace(ws)}
                >
                  Delete workspace
                </button>
              </div>

              <h3 className="label">Members</h3>
              <div className="admin-table-wrap mb-4">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {ws.members.map((m) => (
                      <tr key={m.userId}>
                        <td>{m.email}</td>
                        <td>{m.name ?? "—"}</td>
                        <td>
                          <select
                            className="select !w-auto !py-1 !text-xs"
                            value={m.role}
                            onChange={(e) => void setRole(ws.id, m.userId, e.target.value)}
                          >
                            <option value="owner">Owner</option>
                            <option value="member">Member</option>
                          </select>
                        </td>
                        <td>{m.disabled ? "Disabled" : "Active"}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary !py-1 !px-2 !text-xs"
                            onClick={() => void removeMember(ws.id, m)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <form
                className="flex flex-wrap gap-2 items-end mb-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addMember(ws.id);
                }}
              >
                <div>
                  <label className="label" htmlFor={`add-email-${ws.id}`}>
                    Add existing account
                  </label>
                  <input
                    id={`add-email-${ws.id}`}
                    className="input"
                    type="email"
                    placeholder="email@example.com"
                    value={addEmail[ws.id] ?? ""}
                    onChange={(e) => setAddEmail((s) => ({ ...s, [ws.id]: e.target.value }))}
                    required
                  />
                </div>
                <select
                  className="select !w-auto"
                  value={addRole[ws.id] ?? "member"}
                  onChange={(e) => setAddRole((s) => ({ ...s, [ws.id]: e.target.value as "owner" | "member" }))}
                >
                  <option value="member">Member</option>
                  <option value="owner">Owner</option>
                </select>
                <button className="btn btn-accent !py-1.5 !px-3 !text-xs" type="submit">
                  Add
                </button>
              </form>

              <h3 className="label">Projects</h3>
              {ws.projects.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No projects in this workspace.</p>
              ) : (
                <ul className="space-y-1">
                  {ws.projects.map((p) => (
                    <li key={p.id} className="flex flex-wrap gap-3 justify-between">
                      <Link href={`/projects/${p.id}`} className="text-[var(--accent-2)] underline">
                        {p.name}
                      </Link>
                      <span className="text-sm text-[var(--muted)]">
                        Updated {new Date(p.updatedAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
