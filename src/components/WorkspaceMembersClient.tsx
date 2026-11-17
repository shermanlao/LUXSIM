"use client";

import { useCallback, useEffect, useState } from "react";
import { parseWorkspaceName, WORKSPACE_NAME_MAX_LENGTH } from "@/lib/workspace-name";

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
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [renamingBusy, setRenamingBusy] = useState(false);
  const currentName = workspaces.find((w) => w.id === orgId)?.name ?? "Workspace";

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

  useEffect(() => {
    setRenaming(false);
    setDraftName("");
    setRenamingBusy(false);
  }, [orgId]);

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

  function startRename() {
    setError(null);
    setDraftName(currentName);
    setRenaming(true);
  }

  function cancelRename() {
    setRenaming(false);
    setDraftName("");
    setRenamingBusy(false);
  }

  async function saveRename(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseWorkspaceName(draftName);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setRenamingBusy(true);
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, name: parsed.name }),
    });
    if (!res.ok) {
      setRenamingBusy(false);
      setError(await readError(res, "Failed to rename workspace"));
      return;
    }
    const data = (await res.json()) as { id: string; name: string };
    setWorkspaces((prev) => prev.map((w) => (w.id === data.id ? { ...w, name: data.name } : w)));
    setRenaming(false);
    setDraftName("");
    setRenamingBusy(false);
  }

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

      {orgId && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {renaming ? (
            <form onSubmit={(e) => void saveRename(e)} className="flex flex-wrap items-end gap-3 flex-1">
              <div className="flex-1 min-w-56 max-w-md">
                <label className="label" htmlFor="workspace-name">
                  Workspace name
                </label>
                <input
                  id="workspace-name"
                  className="input"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  maxLength={WORKSPACE_NAME_MAX_LENGTH}
                  autoFocus
                  disabled={renamingBusy}
                />
              </div>
              <button type="submit" className="btn btn-accent" disabled={renamingBusy}>
                Save
              </button>
              <button type="button" className="btn btn-secondary" onClick={cancelRename} disabled={renamingBusy}>
                Cancel
              </button>
            </form>
          ) : (
            <>
              <h2 className="display text-2xl">{currentName}</h2>
              <button
                type="button"
                className="workspace-rename-btn"
                onClick={startRename}
                aria-label="Rename"
                title="Rename"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M14.2 5.2l4.6 4.6M5 19l3.3-.7L19.2 7.4a1.5 1.5 0 0 0 0-2.1L18.7 4.8a1.5 1.5 0 0 0-2.1 0L5.7 15.7 5 19z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
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
