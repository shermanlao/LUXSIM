import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("workspace rename wiring", () => {
  const api = read("app/api/workspace/route.ts");
  const ui = read("components/WorkspaceMembersClient.tsx");
  const page = read("app/workspace/members/page.tsx");
  const session = read("lib/session.ts");

  it("lets a workspace manager PATCH the workspace name through a validated helper", () => {
    expect(api).toContain("export async function PATCH");
    expect(api).toContain('from "@/lib/session"');
    expect(api).toContain("requireWorkspaceManager");
    expect(api).toContain("await requireWorkspaceManager(body.orgId)");
    expect(api).toContain("parseWorkspaceName");
    expect(api).toContain("data: { name: parsed.name }");
    expect(api).toMatch(/return NextResponse\.json\(\{ id: org\.id, name: org\.name \}\)/);
    expect(api).toContain('status: 400');
    expect(session).toContain("export async function requireWorkspaceManager");
    expect(session).toContain("canManageWorkspaceMembers");
  });

  it("exposes Rename, Save, and Cancel on the Workspace members page and updates local names", () => {
    expect(page).toContain("canSeeWorkspaceMembersPage");
    expect(page).toContain("WorkspaceMembersClient");
    expect(ui).toContain('fetch("/api/workspace"');
    expect(ui).toContain('method: "PATCH"');
    expect(ui).toContain("parseWorkspaceName");
    expect(ui).toContain("WORKSPACE_NAME_MAX_LENGTH");
    expect(ui).toMatch(/>\s*Rename\s*</);
    expect(ui).toMatch(/>\s*Save\s*</);
    expect(ui).toMatch(/>\s*Cancel\s*</);
    expect(ui).toContain("setWorkspaces((prev) => prev.map((w) => (w.id === data.id ? { ...w, name: data.name } : w)))");
    expect(ui).toContain('id="workspace-name"');
    expect(ui).not.toMatch(/\bHost\b/);
    expect(ui).not.toMatch(/DIALux/i);
  });
});
