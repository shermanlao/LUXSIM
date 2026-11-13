"use client";

import { useCallback, useEffect, useState } from "react";

type Workspace = { id: string; name: string };
type Member = {
  userId: string;
  email: string;
  name: string | null;
  disabled: boolean;
  role: string;
};

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
}

export function WorkspaceMembersClient({ initialWorkspaces }: { initialWorkspaces: Workspace[] }) {
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [orgId, setOrgId] = useState(initialWorkspaces[0]?.id ?? "");
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "member">("member");

  const refresh = useCallback(async (id: string) => {
    setError(null);
    const res = await fetch(`/api/workspace/members?orgId=${encodeURIComponent(id)}`);
    if (!res.ok) {
      setError(await readError(res, "Failed to load members"));
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { workspaces: Workspace[]; orgId: string; members: Member[] };
    setWorkspaces(data.workspaces);
    setOrgId(data.orgId);
    setMembers(data.members);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (orgId) void refresh(orgId);
  }, [orgId, refresh]);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/workspace/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, email, role }),
    });
    if (!res.ok) {
      setError(await readError(res, "Failed to add member"));
      return;
    }
    setEmail("");
    await refresh(orgId);
  }

  async function setMemberRole(userId: string, nextRole: string) {
    setError(null);
    const res = await fetch(`/api/workspace/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, role: nextRole }),
    });
    if (!res.ok) {
      setError(await readError(res, "Failed to change role"));
      return;
    }
    await refresh(orgId);
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Remove ${member.email} from this workspace?`)) return;
    setError(null);
    const res = await fetch(`/api/workspace/members/${member.userId}?orgId=${encodeURIComponent(orgId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError(await readError(res, "Failed to remove member"));
      return;
    }
    await refresh(orgId);
  }

  const currentName = workspaces.find((w) => w.id === orgId)?.name ?? "Workspace";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="display text-4xl mb-2">Workspace members</h1>
      <p className="text-[var(--muted)] mb-6">
        Add or remove colleagues and choose Owner or Member. Members can open every project in this workspace.
      </p>

      {workspaces.length > 1 && (
        <div className="mb-6 max-w-xs">
          <label className="label" htmlFor="workspace-select">
            Workspace
          </label>
          <select
            id="workspace-select"
            className="select"
            value={orgId}
            onChange={(e) => {
              setLoading(true);
              setOrgId(e.target.value);
            }}
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {workspaces.length === 1 && <h2 className="display text-2xl mb-4">{currentName}</h2>}
      {error && <p className="text-sm text-red-700 mb-4">{error}</p>}

      <form onSubmit={(e) => void addMember(e)} className="panel p-5 mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-56">
          <label className="label" htmlFor="member-email">
            Add by existing email
          </label>
          <input
            id="member-email"
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <select
          className="select !w-auto"
          value={role}
          onChange={(e) => setRole(e.target.value as "owner" | "member")}
        >
          <option value="member">Member</option>
          <option value="owner">Owner</option>
        </select>
        <button className="btn btn-accent">Add member</button>
      </form>

      {loading ? (
        <p className="text-[var(--muted)]">Loading…</p>
      ) : (
        <div className="admin-table-wrap">
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
              {members.map((m) => (
                <tr key={m.userId}>
                  <td>{m.email}</td>
                  <td>{m.name ?? "—"}</td>
                  <td>
                    <select
                      className="select !w-auto !py-1 !text-xs"
                      value={m.role}
                      onChange={(e) => void setMemberRole(m.userId, e.target.value)}
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
                      onClick={() => void removeMember(m)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
