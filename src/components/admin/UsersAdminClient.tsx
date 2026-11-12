"use client";

import { useCallback, useEffect, useState } from "react";
import { OneTimeSecretDialog } from "@/components/admin/OneTimeSecretDialog";

type Workspace = { orgId: string; name: string; role: string };
type UserRow = {
  id: string;
  email: string;
  name: string | null;
  isSiteAdmin: boolean;
  disabled: boolean;
  createdAt: string;
  workspaces: Workspace[];
};
type OrgOption = { id: string; name: string };

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || fallback;
}

export function UsersAdminClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState<{ title: string; message: string; value: string } | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [orgChoice, setOrgChoice] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [role, setRole] = useState<"owner" | "member">("member");
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    const [usersRes, orgsRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/workspaces"),
    ]);
    if (!usersRes.ok) {
      setError(await readError(usersRes, "Failed to load users"));
      setLoading(false);
      return;
    }
    setUsers((await usersRes.json()) as UserRow[]);
    if (orgsRes.ok) {
      const raw = (await orgsRes.json()) as OrgOption[];
      setOrgs(raw.map((o) => ({ id: o.id, name: o.name })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const body: Record<string, unknown> = {
      email,
      name: name || undefined,
      isSiteAdmin: makeAdmin,
    };
    if (orgChoice) {
      body.orgId = orgChoice;
      body.role = role;
    } else if (newOrgName.trim()) {
      body.orgName = newOrgName.trim();
    }
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setCreating(false);
    if (!res.ok) {
      setError(await readError(res, "Failed to create user"));
      return;
    }
    const created = (await res.json()) as UserRow & { temporaryPassword?: string };
    setEmail("");
    setName("");
    setNewOrgName("");
    setMakeAdmin(false);
    await refresh();
    if (created.temporaryPassword) {
      setSecret({
        title: "User created",
        message: `Temporary password for ${created.email}:`,
        value: created.temporaryPassword,
      });
    }
  }

  async function patchUser(id: string, data: Record<string, unknown>, fail: string) {
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      setError(await readError(res, fail));
      return;
    }
    await refresh();
  }

  async function resetPassword(user: UserRow) {
    if (!window.confirm(`Generate a new temporary password for ${user.email}?`)) return;
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: "POST" });
    if (!res.ok) {
      setError(await readError(res, "Failed to reset password"));
      return;
    }
    const data = (await res.json()) as { temporaryPassword?: string };
    if (data.temporaryPassword) {
      setSecret({
        title: "Password reset",
        message: `Temporary password for ${user.email}:`,
        value: data.temporaryPassword,
      });
    }
  }

  return (
    <div>
      <h1 className="display text-4xl mb-2">Users</h1>
      <p className="text-[var(--muted)] mb-6">
        Create accounts, set site administrators, disable sign-in, and place people in workspaces.
      </p>
      {error && <p className="text-sm text-red-700 mb-4">{error}</p>}

      <form onSubmit={(e) => void createUser(e)} className="panel p-5 mb-8 grid gap-3 sm:grid-cols-2">
        <h2 className="display text-2xl sm:col-span-2">Create user</h2>
        <div>
          <label className="label" htmlFor="new-user-email">
            Email
          </label>
          <input
            id="new-user-email"
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="new-user-name">
            Name
          </label>
          <input id="new-user-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="new-user-org">
            Workspace
          </label>
          <select
            id="new-user-org"
            className="select"
            value={orgChoice}
            onChange={(e) => setOrgChoice(e.target.value)}
          >
            <option value="">New workspace</option>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        {orgChoice ? (
          <div>
            <label className="label" htmlFor="new-user-role">
              Role
            </label>
            <select
              id="new-user-role"
              className="select"
              value={role}
              onChange={(e) => setRole(e.target.value as "owner" | "member")}
            >
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="new-user-orgname">
              New workspace name
            </label>
            <input
              id="new-user-orgname"
              className="input"
              placeholder="Optional — defaults to the user's workspace"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
            />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={makeAdmin} onChange={(e) => setMakeAdmin(e.target.checked)} />
          Site administrator
        </label>
        <div className="sm:col-span-2">
          <button className="btn btn-accent" disabled={creating}>
            {creating ? "Creating…" : "Create user"}
          </button>
        </div>
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
                <th>Site admin</th>
                <th>Status</th>
                <th>Workspace</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.name ?? "—"}</td>
                  <td>{user.isSiteAdmin ? "Yes" : "No"}</td>
                  <td>{user.disabled ? "Disabled" : "Active"}</td>
                  <td>
                    {user.workspaces.length === 0
                      ? "—"
                      : user.workspaces.map((w) => `${w.name} (${w.role})`).join(", ")}
                    <div className="mt-2 flex flex-wrap gap-1 items-center">
                      <select
                        className="select !w-auto !py-1 !text-xs"
                        defaultValue=""
                        aria-label={`Place ${user.email} in a workspace`}
                        onChange={(e) => {
                          const orgId = e.target.value;
                          if (!orgId) return;
                          void patchUser(
                            user.id,
                            { membership: { orgId, role: "member" } },
                            "Failed to place user"
                          );
                          e.target.value = "";
                        }}
                      >
                        <option value="">Add to workspace…</option>
                        {orgs
                          .filter((o) => !user.workspaces.some((w) => w.orgId === o.id))
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                      </select>
                      {user.workspaces.map((w) => (
                        <select
                          key={w.orgId}
                          className="select !w-auto !py-1 !text-xs"
                          value={w.role}
                          aria-label={`Role for ${user.email} in ${w.name}`}
                          onChange={(e) =>
                            void patchUser(
                              user.id,
                              { membership: { orgId: w.orgId, role: e.target.value } },
                              "Failed to change role"
                            )
                          }
                        >
                          <option value="owner">Owner</option>
                          <option value="member">Member</option>
                        </select>
                      ))}
                    </div>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleString()}</td>
                  <td className="admin-table__actions">
                    <button
                      type="button"
                      className="btn btn-secondary !py-1 !px-2 !text-xs"
                      onClick={() =>
                        void patchUser(
                          user.id,
                          { isSiteAdmin: !user.isSiteAdmin },
                          "Failed to update site admin"
                        )
                      }
                    >
                      {user.isSiteAdmin ? "Remove admin" : "Make admin"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary !py-1 !px-2 !text-xs"
                      onClick={() =>
                        void patchUser(user.id, { disabled: !user.disabled }, "Failed to update status")
                      }
                    >
                      {user.disabled ? "Enable" : "Disable"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary !py-1 !px-2 !text-xs"
                      onClick={() => void resetPassword(user)}
                    >
                      Reset password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {secret && (
        <OneTimeSecretDialog
          title={secret.title}
          message={secret.message}
          secret={secret.value}
          onClose={() => setSecret(null)}
        />
      )}
    </div>
  );
}
