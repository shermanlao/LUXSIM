import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("official project loading dialog", () => {
  const dialog = read("src/components/ProjectLoadingDialog.tsx");
  const wait = read("src/components/OfficialWaitDialog.tsx");
  const copy = read("src/lib/official-wait-dialog.ts");
  const card = read("src/components/ProjectListCard.tsx");
  const create = read("src/components/CreateProjectButton.tsx");
  const gate = read("src/components/ProjectEditorLoadGate.tsx");
  const list = read("src/app/projects/page.tsx");
  const loading = read("src/app/projects/[id]/loading.tsx");
  const page = read("src/app/projects/[id]/page.tsx");
  const css = read("src/app/globals.css");
  const guide = read("docs/USER_GUIDE.md");

  it("exists as a labelled, bilingual, non-dismissible modal", () => {
    expect(wait).toContain('role="dialog"');
    expect(wait).toContain('aria-modal="true"');
    expect(wait).toContain("aria-busy");
    expect(wait).toContain("official-wait-backdrop");
    expect(wait).toContain("official-wait-dialog");
    expect(wait).not.toMatch(/onClick/);
    expect(wait).not.toMatch(/onClose|setOpen\(false\)|dismiss/i);
    expect(wait).not.toMatch(/<button/i);
    expect(dialog).toContain("OfficialWaitDialog");
    expect(dialog).toContain('titleId="project-loading-title"');
    expect(dialog).toContain('messageId="project-loading-message"');
    expect(dialog).toContain("OFFICIAL_WAIT_COPY.projectLoading");
    expect(copy).toContain('export const PROJECT_LOADING_TITLE_EN = "Loading project…"');
    expect(copy).toContain('export const PROJECT_LOADING_TITLE_ZH = "正在載入專案…"');
    expect(css).toContain(".official-wait-backdrop");
    expect(css).toContain(".official-wait-dialog");
    expect(css).toMatch(/\.official-wait-backdrop\s*\{[^}]*z-index:\s*200;/);
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
    expect(guide).toMatch(/\*\*Open \.lxm\*\*/);
    expect(guide).toMatch(/\*\*Save \.lxm\*\*/);
    expect(guide).toMatch(/舊的 \.lux、\.luxsim 或 \.luxsim\.json 檔同樣可以開啟/);
    expect(guide).toMatch(/older \.lux, \.luxsim and \.luxsim\.json files still open/);
    expect(guide).toMatch(/不能點背景關閉/);
    expect(guide).toMatch(/cannot be dismissed by clicking the backdrop/);
    expect(guide).toMatch(/沒有關閉按鈕/);
    expect(guide).toMatch(/close button/);
    expect(guide).toMatch(/直接開啟專案網址/);
    expect(guide).toMatch(/opening a project URL directly/);
    expect(guide).toMatch(/編輯器可以使用後，對話框會自行關閉/);
    expect(guide).toMatch(/stays until the editor is ready to use/);
    expect(guide).toMatch(/Creating project…/);
    expect(guide).toMatch(/正在建立專案…/);
    expect(guide).toMatch(/Opening project file…/);
    expect(guide).toMatch(/正在開啟專案檔…/);
    expect(guide).toMatch(/The same loading dialog also appears while other work that can take time is running/);
    expect(guide).toMatch(/其他需要較長時間的工作同樣使用這個載入對話框/);
    expect(guide).toMatch(/\*\*Calc room\*\* \/ \*\*Calc all\*\*/);
    expect(guide).toMatch(/does not appear for pan, zoom, selection, orbiting the 3D view/);
    expect(guide).toMatch(/平移、縮放、選取、環繞旋轉 3D 視圖/);
  });
});
