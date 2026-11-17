export type AdminSortDir = "asc" | "desc";

export type AdminSortState<K extends string> = {
  key: K;
  dir: AdminSortDir;
};

export type AdminWorkspaceSortKey =
  | "name"
  | "createdAt"
  | "members"
  | "projects"
  | "luminaires"
  | "lastProjectUpdate";

export type AdminMemberSortKey = "createdAt" | "email" | "name" | "role" | "status";

export type AdminProjectSortKey = "name" | "updatedAt";

export type AdminWorkspaceMember = {
  userId: string;
  email: string;
  name: string | null;
  disabled: boolean;
  role: string;
  createdAt?: string;
};

export type AdminWorkspaceProject = {
  id: string;
  name: string;
  updatedAt: string;
  createdAt?: string;
};

export type AdminWorkspaceRow = {
  id: string;
  name: string;
  createdAt: string;
  luminaireCount: number;
  members: AdminWorkspaceMember[];
  projects: AdminWorkspaceProject[];
};

/** Matches GET /api/admin/workspaces: organisations in createdAt ascending order. */
export const DEFAULT_WORKSPACE_SORT: AdminSortState<AdminWorkspaceSortKey> = {
  key: "createdAt",
  dir: "asc",
};

/** Matches the API member list: membership createdAt ascending. */
export const DEFAULT_MEMBER_SORT: AdminSortState<AdminMemberSortKey> = {
  key: "createdAt",
  dir: "asc",
};

/** Matches GET /api/admin/workspaces: projects in updatedAt descending order. */
export const DEFAULT_PROJECT_SORT: AdminSortState<AdminProjectSortKey> = {
  key: "updatedAt",
  dir: "desc",
};

const TEXT_COMPARE: Intl.CollatorOptions = { sensitivity: "base", numeric: true };

export function memberStatusLabel(disabled: boolean): "Disabled" | "Active" {
  return disabled ? "Disabled" : "Active";
}

export function parseAdminDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Most recent project updatedAt, or null when the workspace has no usable project dates. */
export function lastProjectUpdateMs(workspace: Pick<AdminWorkspaceRow, "projects">): number | null {
  let max: number | null = null;
  for (const project of workspace.projects) {
    const ms = parseAdminDateMs(project.updatedAt);
    if (ms != null && (max == null || ms > max)) max = ms;
  }
  return max;
}

/**
 * Locale-aware text compare. Empty or missing values are listed after named values
 * in both directions.
 */
export function compareAdminText(
  a: string | null | undefined,
  b: string | null | undefined,
  dir: AdminSortDir
): number {
  const aText = (a ?? "").trim();
  const bText = (b ?? "").trim();
  const aEmpty = aText.length === 0;
  const bEmpty = bText.length === 0;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  const cmp = aText.localeCompare(bText, undefined, TEXT_COMPARE);
  return dir === "asc" ? cmp : -cmp;
}

/**
 * Numeric or date-ms compare. Missing / non-finite values are listed last in both
 * directions (including a workspace with no projects when sorting by last update).
 */
export function compareAdminNumber(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: AdminSortDir
): number {
  const aMissing = a == null || !Number.isFinite(a);
  const bMissing = b == null || !Number.isFinite(b);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  const cmp = a - b;
  return dir === "asc" ? cmp : -cmp;
}

export function defaultDirForWorkspaceKey(key: AdminWorkspaceSortKey): AdminSortDir {
  return key === "name" || key === "createdAt" ? "asc" : "desc";
}

export function defaultDirForMemberKey(key: AdminMemberSortKey): AdminSortDir {
  return "asc";
}

export function defaultDirForProjectKey(key: AdminProjectSortKey): AdminSortDir {
  return key === "updatedAt" ? "desc" : "asc";
}

export function nextAdminSortState<K extends string>(
  current: AdminSortState<K>,
  clicked: K,
  defaultDir: AdminSortDir
): AdminSortState<K> {
  if (current.key === clicked) {
    return { key: clicked, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  return { key: clicked, dir: defaultDir };
}

export function sortAdminWorkspaces(
  workspaces: readonly AdminWorkspaceRow[],
  sort: AdminSortState<AdminWorkspaceSortKey> = DEFAULT_WORKSPACE_SORT
): AdminWorkspaceRow[] {
  return [...workspaces].sort((a, b) => compareWorkspace(a, b, sort));
}

export function sortAdminMembers(
  members: readonly AdminWorkspaceMember[],
  sort: AdminSortState<AdminMemberSortKey> = DEFAULT_MEMBER_SORT
): AdminWorkspaceMember[] {
  return [...members].sort((a, b) => compareMember(a, b, sort));
}

export function sortAdminProjects(
  projects: readonly AdminWorkspaceProject[],
  sort: AdminSortState<AdminProjectSortKey> = DEFAULT_PROJECT_SORT
): AdminWorkspaceProject[] {
  return [...projects].sort((a, b) => compareProject(a, b, sort));
}

function compareWorkspace(
  a: AdminWorkspaceRow,
  b: AdminWorkspaceRow,
  sort: AdminSortState<AdminWorkspaceSortKey>
): number {
  switch (sort.key) {
    case "name":
      return compareAdminText(a.name, b.name, sort.dir);
    case "createdAt":
      return compareAdminNumber(parseAdminDateMs(a.createdAt), parseAdminDateMs(b.createdAt), sort.dir);
    case "members":
      return compareAdminNumber(a.members.length, b.members.length, sort.dir);
    case "projects":
      return compareAdminNumber(a.projects.length, b.projects.length, sort.dir);
    case "luminaires":
      return compareAdminNumber(a.luminaireCount, b.luminaireCount, sort.dir);
    case "lastProjectUpdate":
      return compareAdminNumber(lastProjectUpdateMs(a), lastProjectUpdateMs(b), sort.dir);
  }
}

function compareMember(
  a: AdminWorkspaceMember,
  b: AdminWorkspaceMember,
  sort: AdminSortState<AdminMemberSortKey>
): number {
  switch (sort.key) {
    case "createdAt":
      return compareAdminNumber(parseAdminDateMs(a.createdAt), parseAdminDateMs(b.createdAt), sort.dir);
    case "email":
      return compareAdminText(a.email, b.email, sort.dir);
    case "name":
      return compareAdminText(a.name, b.name, sort.dir);
    case "role":
      return compareAdminText(a.role, b.role, sort.dir);
    case "status":
      return compareAdminText(memberStatusLabel(a.disabled), memberStatusLabel(b.disabled), sort.dir);
  }
}

function compareProject(
  a: AdminWorkspaceProject,
  b: AdminWorkspaceProject,
  sort: AdminSortState<AdminProjectSortKey>
): number {
  switch (sort.key) {
    case "name":
      return compareAdminText(a.name, b.name, sort.dir);
    case "updatedAt":
      return compareAdminNumber(parseAdminDateMs(a.updatedAt), parseAdminDateMs(b.updatedAt), sort.dir);
  }
}
