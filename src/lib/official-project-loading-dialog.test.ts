import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("official project loading dialog", () => {
  const dialog = read("src/components/ProjectLoadingDialog.tsx");
  const card = read("src/components/ProjectListCard.tsx");
  const create = read("src/components/CreateProjectButton.tsx");
  const gate = read("src/components/ProjectEditorLoadGate.tsx");
  const list = read("src/app/projects/page.tsx");
  const loading = read("src/app/projects/[id]/loading.tsx");
  const page = read("src/app/projects/[id]/page.tsx");
  const css = read("src/app/globals.css");
  const guide = read("docs/USER_GUIDE.md");

  it("exists as a labelled, bilingual, non-dismissible modal", () => {
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain('aria-labelledby="project-loading-title"');
    expect(dialog).toContain("Loading project…");
    expect(dialog).toContain("正在載入專案…");
    expect(dialog).toContain("project-loading-backdrop");
    expect(dialog).toContain("project-loading-dialog");
    expect(dialog).not.toMatch(/onClick/);
    expect(dialog).not.toMatch(/onClose|setOpen\(false\)|dismiss/i);
    expect(dialog).not.toMatch(/<button/i);
    expect(css).toContain(".project-loading-backdrop");
    expect(css).toContain(".project-loading-dialog");
    expect(css).toMatch(/\.project-loading-backdrop\s*\{[^}]*z-index:\s*200;/);
    expect(css).toContain("#0a1218");
  });

  it("is used from the projects list, create/open actions, route loading UI, and editor gate", () => {
    expect(list).toContain("ProjectListCard");
    expect(list).not.toMatch(/<Link[\s\S]*href=\{\`\/projects\/\$\{p\.id\}\`\}/);

    expect(card).toContain("ProjectLoadingDialog");
    expect(card).toContain("router.push(href)");
    expect(card).toContain("setOpening(true)");

    expect(create).toContain("ProjectLoadingDialog");
    expect(create).toContain("setOpening(true)");
    expect(create).toMatch(/setOpening\(true\);\s*router\.push\(`\/projects\/\$\{project\.id\}`\)/);
    expect(create).toMatch(/setOpening\(true\);\s*router\.push\(`\/projects\/\$\{data\.id\}`\)/);

    expect(loading).toContain("ProjectLoadingDialog");
    expect(loading).toContain("CadEditorRoot");
    expect(loading).toContain("ProjectRouteLoading");

    expect(page).toContain("ProjectEditorLoadGate");
    expect(page).toContain("<BuildingEditor");
    expect(gate).toContain("ProjectLoadingDialog");
    expect(gate).toContain("setReady(true)");
    expect(gate).toContain("requestAnimationFrame");
    expect(gate).toContain("{!ready && <ProjectLoadingDialog />}");
    expect(gate).toContain("{children}");
  });

  it("documents the loading dialog in the bilingual user guide", () => {
    expect(guide).toMatch(/開啟專案 \/ Open a project/);
    expect(guide).toMatch(/Loading project…/);
    expect(guide).toMatch(/正在載入專案…/);
    expect(guide).toMatch(/\*\*New project\*\*/);
    expect(guide).toMatch(/\*\*Open \.luxsim\*\*/);
    expect(guide).toMatch(/不能點背景關閉/);
    expect(guide).toMatch(/cannot be dismissed by clicking the backdrop/);
    expect(guide).toMatch(/沒有關閉按鈕/);
    expect(guide).toMatch(/close button/);
    expect(guide).toMatch(/直接開啟專案網址/);
    expect(guide).toMatch(/opening a project URL directly/);
    expect(guide).toMatch(/編輯器可以使用後，對話框會自行關閉/);
    expect(guide).toMatch(/stays until the editor is ready to use/);
  });
});
