import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  type AdminWorkspaceMember,
  type AdminWorkspaceProject,
  type AdminWorkspaceRow,
  DEFAULT_MEMBER_SORT,
  DEFAULT_PROJECT_SORT,
  DEFAULT_WORKSPACE_SORT,
  compareAdminNumber,
  compareAdminText,
  defaultDirForMemberKey,
  defaultDirForProjectKey,
  defaultDirForWorkspaceKey,
  lastProjectUpdateMs,
  memberStatusLabel,
  nextAdminSortState,
  sortAdminMembers,
  sortAdminProjects,
  sortAdminWorkspaces,
} from "@/lib/admin-workspaces-sort";

const root = path.resolve(__dirname, "..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

function workspace(
  partial: Partial<AdminWorkspaceRow> & Pick<AdminWorkspaceRow, "id" | "name">
): AdminWorkspaceRow {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    luminaireCount: 0,
    members: [],
    projects: [],
    ...partial,
  };
}

function member(
  partial: Partial<AdminWorkspaceMember> & Pick<AdminWorkspaceMember, "userId" | "email">
): AdminWorkspaceMember {
  return {
    name: null,
    disabled: false,
    role: "member",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function project(
  partial: Partial<AdminWorkspaceProject> & Pick<AdminWorkspaceProject, "id" | "name">
): AdminWorkspaceProject {
  return {
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const workspaces: AdminWorkspaceRow[] = [
  workspace({
    id: "new",
    name: "Zebra Hall",
    createdAt: "2026-03-01T00:00:00.000Z",
    luminaireCount: 2,
    members: [member({ userId: "u1", email: "a@example.com" })],
    projects: [
      project({ id: "p-old", name: "Old", updatedAt: "2026-01-15T00:00:00.000Z" }),
      project({ id: "p-latest", name: "Latest", updatedAt: "2026-06-01T00:00:00.000Z" }),
    ],
  }),
  workspace({
    id: "old",
    name: "Alpha Studio",
    createdAt: "2026-01-01T00:00:00.000Z",
    luminaireCount: 10,
    members: [
      member({ userId: "u2", email: "b@example.com" }),
      member({ userId: "u3", email: "c@example.com" }),
    ],
    projects: [project({ id: "p-mid", name: "Mid", updatedAt: "2026-03-01T00:00:00.000Z" })],
  }),
  workspace({
    id: "empty",
    name: "",
    createdAt: "2026-02-01T00:00:00.000Z",
    luminaireCount: 0,
    members: [],
    projects: [],
  }),
];

describe("admin workspace sort defaults", () => {
  it("defaults workspaces to Created ascending, not Name A–Z", () => {
    expect(DEFAULT_WORKSPACE_SORT).toEqual({ key: "createdAt", dir: "asc" });
    expect(sortAdminWorkspaces(workspaces).map((row) => row.id)).toEqual(["old", "empty", "new"]);
    expect(sortAdminWorkspaces(workspaces, { key: "name", dir: "asc" }).map((row) => row.id)).toEqual([
      "old",
      "new",
      "empty",
    ]);
    expect(sortAdminWorkspaces(workspaces).map((row) => row.id)).not.toEqual(
      sortAdminWorkspaces(workspaces, { key: "name", dir: "asc" }).map((row) => row.id)
    );
  });

  it("defaults members to createdAt ascending when that field is present", () => {
    expect(DEFAULT_MEMBER_SORT).toEqual({ key: "createdAt", dir: "asc" });
    const members = [
      member({ userId: "later", email: "ann@example.com", createdAt: "2026-02-01T00:00:00.000Z" }),
      member({ userId: "earlier", email: "zoe@example.com", createdAt: "2026-01-01T00:00:00.000Z" }),
    ];
    expect(sortAdminMembers(members).map((row) => row.userId)).toEqual(["earlier", "later"]);
  });

  it("defaults projects to Updated descending", () => {
    expect(DEFAULT_PROJECT_SORT).toEqual({ key: "updatedAt", dir: "desc" });
    const projects = [
      project({ id: "older", name: "Older", updatedAt: "2026-01-01T00:00:00.000Z" }),
      project({ id: "newer", name: "Newer", updatedAt: "2026-04-01T00:00:00.000Z" }),
    ];
    expect(sortAdminProjects(projects).map((row) => row.id)).toEqual(["newer", "older"]);
  });
});

describe("sortAdminWorkspaces keys", () => {
  it("sorts by name in both directions and lists empty names after named rows", () => {
    expect(sortAdminWorkspaces(workspaces, { key: "name", dir: "asc" }).map((row) => row.id)).toEqual([
      "old",
      "new",
      "empty",
    ]);
    expect(sortAdminWorkspaces(workspaces, { key: "name", dir: "desc" }).map((row) => row.id)).toEqual([
      "new",
      "old",
      "empty",
    ]);
  });

  it("sorts by createdAt in both directions and lists missing dates last", () => {
    const withMissing = [
      workspace({ id: "dated", name: "Dated", createdAt: "2026-05-01T00:00:00.000Z" }),
      workspace({ id: "missing", name: "Missing", createdAt: "" }),
      workspace({ id: "earlier", name: "Earlier", createdAt: "2026-01-01T00:00:00.000Z" }),
    ];
    expect(sortAdminWorkspaces(withMissing, { key: "createdAt", dir: "asc" }).map((row) => row.id)).toEqual([
      "earlier",
      "dated",
      "missing",
    ]);
    expect(sortAdminWorkspaces(withMissing, { key: "createdAt", dir: "desc" }).map((row) => row.id)).toEqual([
      "dated",
      "earlier",
      "missing",
    ]);
  });

  it("sorts by member, project, and luminaire counts in both directions", () => {
    expect(sortAdminWorkspaces(workspaces, { key: "members", dir: "asc" }).map((row) => row.id)).toEqual([
      "empty",
      "new",
      "old",
    ]);
    expect(sortAdminWorkspaces(workspaces, { key: "members", dir: "desc" }).map((row) => row.id)).toEqual([
      "old",
      "new",
      "empty",
    ]);
    expect(sortAdminWorkspaces(workspaces, { key: "projects", dir: "asc" }).map((row) => row.id)).toEqual([
      "empty",
      "old",
      "new",
    ]);
    expect(sortAdminWorkspaces(workspaces, { key: "projects", dir: "desc" }).map((row) => row.id)).toEqual([
      "new",
      "old",
      "empty",
    ]);
    expect(sortAdminWorkspaces(workspaces, { key: "luminaires", dir: "asc" }).map((row) => row.id)).toEqual([
      "empty",
      "new",
      "old",
    ]);
    expect(sortAdminWorkspaces(workspaces, { key: "luminaires", dir: "desc" }).map((row) => row.id)).toEqual([
      "old",
      "new",
      "empty",
    ]);
  });

  it("sorts by the latest project updatedAt and lists workspaces with no projects last in both directions", () => {
    expect(lastProjectUpdateMs(workspaces[0]!)).toBe(Date.parse("2026-06-01T00:00:00.000Z"));
    expect(lastProjectUpdateMs(workspaces[1]!)).toBe(Date.parse("2026-03-01T00:00:00.000Z"));
    expect(lastProjectUpdateMs(workspaces[2]!)).toBeNull();
    expect(
      sortAdminWorkspaces(workspaces, { key: "lastProjectUpdate", dir: "desc" }).map((row) => row.id)
    ).toEqual(["new", "old", "empty"]);
    expect(
      sortAdminWorkspaces(workspaces, { key: "lastProjectUpdate", dir: "asc" }).map((row) => row.id)
    ).toEqual(["old", "new", "empty"]);
  });
});

describe("sortAdminMembers keys", () => {
  const members: AdminWorkspaceMember[] = [
    member({
      userId: "ann",
      email: "ann@example.com",
      name: "Ann",
      role: "owner",
      disabled: false,
      createdAt: "2026-03-01T00:00:00.000Z",
    }),
    member({
      userId: "zoe",
      email: "zoe@example.com",
      name: "Zoe",
      role: "member",
      disabled: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
    member({
      userId: "blank",
      email: "blank@example.com",
      name: "  ",
      role: "member",
      disabled: false,
      createdAt: "2026-02-01T00:00:00.000Z",
    }),
  ];

  it("sorts by email in both directions", () => {
    expect(sortAdminMembers(members, { key: "email", dir: "asc" }).map((row) => row.userId)).toEqual([
      "ann",
      "blank",
      "zoe",
    ]);
    expect(sortAdminMembers(members, { key: "email", dir: "desc" }).map((row) => row.userId)).toEqual([
      "zoe",
      "blank",
      "ann",
    ]);
  });

  it("sorts by name in both directions and lists null or empty names after named rows", () => {
    const withNull = [
      ...members,
      member({ userId: "null-name", email: "none@example.com", name: null }),
    ];
    expect(sortAdminMembers(withNull, { key: "name", dir: "asc" }).map((row) => row.userId)).toEqual([
      "ann",
      "zoe",
      "blank",
      "null-name",
    ]);
    expect(sortAdminMembers(withNull, { key: "name", dir: "desc" }).map((row) => row.userId)).toEqual([
      "zoe",
      "ann",
      "blank",
      "null-name",
    ]);
  });

  it("sorts by role in both directions", () => {
    expect(sortAdminMembers(members, { key: "role", dir: "asc" }).map((row) => row.userId)).toEqual([
      "zoe",
      "blank",
      "ann",
    ]);
    expect(sortAdminMembers(members, { key: "role", dir: "desc" }).map((row) => row.userId)).toEqual([
      "ann",
      "zoe",
      "blank",
    ]);
  });

  it("sorts Status by the page labels Active and Disabled in both directions", () => {
    expect(memberStatusLabel(false)).toBe("Active");
    expect(memberStatusLabel(true)).toBe("Disabled");
    expect(sortAdminMembers(members, { key: "status", dir: "asc" }).map((row) => row.userId)).toEqual([
      "ann",
      "blank",
      "zoe",
    ]);
    expect(sortAdminMembers(members, { key: "status", dir: "desc" }).map((row) => row.userId)).toEqual([
      "zoe",
      "ann",
      "blank",
    ]);
  });
});

describe("sortAdminProjects keys", () => {
  const projects: AdminWorkspaceProject[] = [
    project({ id: "beta", name: "Beta", updatedAt: "2026-02-01T00:00:00.000Z" }),
    project({ id: "alpha", name: "Alpha", updatedAt: "2026-04-01T00:00:00.000Z" }),
    project({ id: "blank", name: "", updatedAt: "2026-03-01T00:00:00.000Z" }),
    project({ id: "missing", name: "No date", updatedAt: "" }),
  ];

  it("sorts by name in both directions and lists empty names after named rows", () => {
    expect(sortAdminProjects(projects, { key: "name", dir: "asc" }).map((row) => row.id)).toEqual([
      "alpha",
      "beta",
      "missing",
      "blank",
    ]);
    expect(sortAdminProjects(projects, { key: "name", dir: "desc" }).map((row) => row.id)).toEqual([
      "missing",
      "beta",
      "alpha",
      "blank",
    ]);
  });

  it("sorts by updatedAt in both directions and lists missing dates last", () => {
    expect(sortAdminProjects(projects, { key: "updatedAt", dir: "asc" }).map((row) => row.id)).toEqual([
      "beta",
      "blank",
      "alpha",
      "missing",
    ]);
    expect(sortAdminProjects(projects, { key: "updatedAt", dir: "desc" }).map((row) => row.id)).toEqual([
      "alpha",
      "blank",
      "beta",
      "missing",
    ]);
  });
});

describe("compare helpers and nextAdminSortState", () => {
  it("lists empty text and missing numbers last in both directions", () => {
    expect(compareAdminText("", "Ann", "asc")).toBe(1);
    expect(compareAdminText("", "Ann", "desc")).toBe(1);
    expect(compareAdminText("Ann", "", "asc")).toBe(-1);
    expect(compareAdminText(null, "Ann", "asc")).toBe(1);
    expect(compareAdminNumber(null, 3, "asc")).toBe(1);
    expect(compareAdminNumber(null, 3, "desc")).toBe(1);
    expect(compareAdminNumber(1, 3, "asc")).toBeLessThan(0);
    expect(compareAdminNumber(1, 3, "desc")).toBeGreaterThan(0);
  });

  it("toggles direction on the same key and uses the new key's default direction otherwise", () => {
    expect(nextAdminSortState(DEFAULT_WORKSPACE_SORT, "createdAt", "asc")).toEqual({
      key: "createdAt",
      dir: "desc",
    });
    expect(nextAdminSortState({ key: "createdAt", dir: "desc" }, "createdAt", "asc")).toEqual({
      key: "createdAt",
      dir: "asc",
    });
    expect(nextAdminSortState(DEFAULT_WORKSPACE_SORT, "name", defaultDirForWorkspaceKey("name"))).toEqual({
      key: "name",
      dir: "asc",
    });
    expect(
      nextAdminSortState(DEFAULT_WORKSPACE_SORT, "luminaires", defaultDirForWorkspaceKey("luminaires"))
    ).toEqual({ key: "luminaires", dir: "desc" });
    expect(defaultDirForMemberKey("email")).toBe("asc");
    expect(defaultDirForProjectKey("name")).toBe("asc");
    expect(defaultDirForProjectKey("updatedAt")).toBe("desc");
  });
});

describe("admin workspaces page sort wiring", () => {
  const ui = read("components/admin/WorkspacesAdminClient.tsx");
  const api = read("app/api/admin/workspaces/route.ts");
  const css = read("app/globals.css");
  const docs = readFileSync(path.join(root, "../docs/ADMIN.md"), "utf8");

  it("keeps the API default order and sorts the loaded lists in the client", () => {
    expect(api).toContain("orderBy: { createdAt: \"asc\" }");
    expect(api).toContain("orderBy: { updatedAt: \"desc\" }");
    expect(ui).toContain("sortAdminWorkspaces");
    expect(ui).toContain("sortAdminMembers");
    expect(ui).toContain("sortAdminProjects");
    expect(ui).toContain("DEFAULT_WORKSPACE_SORT");
    expect(ui).toContain("DEFAULT_MEMBER_SORT");
    expect(ui).toContain("DEFAULT_PROJECT_SORT");
    expect(ui).toContain("nextAdminSortState");
    expect(ui).not.toMatch(/useState\(\{\s*key:\s*"name"/);
    expect(ui).not.toMatch(/DIALux/i);
  });

  it("wires clickable workspace, member, and project sort controls with a visible direction", () => {
    expect(ui).toContain("AdminSortButton");
    expect(ui).toContain("Sort workspaces");
    expect(ui).toContain('label: "Name"');
    expect(ui).toContain('label: "Created"');
    expect(ui).toContain('label: "Members"');
    expect(ui).toContain('label: "Projects"');
    expect(ui).toContain('label: "Luminaires"');
    expect(ui).toContain('label: "Last project update"');
    expect(ui).toContain('label="Email"');
    expect(ui).toContain('label="Role"');
    expect(ui).toContain('label="Status"');
    expect(ui).toContain('label="Updated"');
    expect(ui).toContain('label="Name"');
    expect(ui).toContain("aria-sort");
    expect(ui).toContain("memberSort");
    expect(ui).toContain("projectSort");
    expect(css).toContain(".admin-sort-btn");
    expect(css).toContain(".admin-sort-btn--active");
    expect(css).toContain(".admin-sort-bar");
  });

  it("documents the sort keys and defaults in ADMIN.md without adding a workspace rename control", () => {
    expect(docs).toMatch(/\/admin\/workspaces/);
    expect(docs).toMatch(/Created ascending/i);
    expect(docs).toMatch(/Updated descending/i);
    expect(docs).toMatch(/Last project update/);
    expect(docs).toMatch(/Email, Name, Role/);
    expect(ui).not.toMatch(/>\s*Rename\s*</);
  });
});
