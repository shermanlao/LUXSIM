import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseUserGuideMarkdown } from "./user-guide-markdown";

function read(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("user guide", () => {
  const guide = read("docs/USER_GUIDE.md");
  const blocks = parseUserGuideMarkdown(guide);

  it("is a user-facing manual, not a developer note", () => {
    expect(guide).toMatch(/使用手冊/);
    expect(guide).toMatch(/User guide/);
    expect(guide).not.toMatch(/BuildingEditor/);
    expect(guide).not.toMatch(/tool\.drawRoom/);
    expect(guide).not.toMatch(/parseLengthToM/);
  });

  it("documents wheel zoom, reset, Backspace, and Esc", () => {
    expect(guide).toMatch(/zoom toward the cursor/i);
    expect(guide).toMatch(/以游標位置為中心/);
    expect(guide).toMatch(/The page itself does not scroll/);
    expect(guide).toMatch(/不會捲動整頁/);
    expect(guide).toMatch(/Double-click an empty area/);
    expect(guide).toMatch(/雙擊圖面空白處/);
    expect(guide).toMatch(/Switching storeys also resets/);
    expect(guide).toMatch(/one \*\*Backspace\*\* clears that whole length/);
    expect(guide).toMatch(/按一次 \*\*Backspace\*\* 會整段清掉該長度/);
    expect(guide).toMatch(/The next \*\*Backspace\*\* removes the last corner/);
    expect(guide).toMatch(/\*\*Esc\*\* cancels the draft/);
    expect(guide).toMatch(/畫房途中按 \*\*Esc\*\* 會取消草稿/);
    expect(guide).toMatch(/does not exit the browser/);
    expect(guide).toMatch(/不會因此退出全畫面/);
    expect(guide).toMatch(/When you are not drawing, \*\*Esc\*\* can still exit fullscreen/);
    expect(guide).toMatch(/Origin \(first corner\)/);
    expect(guide).toMatch(/Bounding min/);
    expect(guide).toMatch(/Calibrate scale first/);
  });

  it("parses the main headings", () => {
    const headings = blocks.filter((b) => b.type === "h1" || b.type === "h2").map((b) => b.text);
    expect(headings[0]).toMatch(/使用手冊 \/ User guide/);
    expect(headings).toContain("平面圖視野 / Plan view");
    expect(headings).toContain("畫房 / Draw room");
    expect(headings).toContain("房間屬性 / Room properties");
    expect(blocks.some((b) => b.type === "ol" && b.items.length >= 6)).toBe(true);
    expect(blocks.some((b) => b.type === "ul")).toBe(true);
  });

  it("is linked from the in-app docs home, guide route, and header nav", () => {
    const docsPage = read("src/app/docs/page.tsx");
    const guidePage = read("src/app/docs/guide/page.tsx");
    const nav = read("src/components/NavAuth.tsx");
    expect(docsPage).toContain('href="/docs/guide"');
    expect(docsPage).toMatch(/使用手冊/);
    expect(guidePage).toContain("docs/USER_GUIDE.md");
    expect(guidePage).toContain("UserGuideArticle");
    expect(nav).toContain('href="/docs/guide"');
    expect(nav).toContain("User guide");
    expect(nav).not.toMatch(/href="\/docs"(?!\/guide)/);
  });

  it("keeps the Draw room help tip in sync with Backspace and Esc", () => {
    const tips = read("src/lib/ui-tips.ts");
    expect(tips).toMatch(/Esc cancels/);
    expect(tips).toMatch(/Backspace clears the typed length in one press, then removes the last corner/);
  });
});
