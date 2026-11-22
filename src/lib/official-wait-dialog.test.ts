import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  OFFICIAL_WAIT_COPY,
  PROJECT_LOADING_TITLE_EN,
  PROJECT_LOADING_TITLE_ZH,
  officialWaitAfterPaint,
  officialWaitBeforeWork,
  officialWaitYield,
} from "./official-wait-dialog";

const root = path.resolve(__dirname, "../..");
function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("official reusable wait dialog", () => {
  it("exports bilingual titles and a presentational dialog that is not dismissible", () => {
    expect(PROJECT_LOADING_TITLE_EN).toBe("Loading project…");
    expect(PROJECT_LOADING_TITLE_ZH).toBe("正在載入專案…");
    expect(OFFICIAL_WAIT_COPY.projectLoading).toEqual({
      titleEn: PROJECT_LOADING_TITLE_EN,
      titleZh: PROJECT_LOADING_TITLE_ZH,
    });
    expect(OFFICIAL_WAIT_COPY.calculating).toEqual({
      titleEn: "Calculating…",
      titleZh: "正在計算…",
    });
    expect(OFFICIAL_WAIT_COPY.exportingPdf).toEqual({
      titleEn: "Exporting PDF report…",
      titleZh: "正在匯出 PDF 報告…",
    });
    expect(OFFICIAL_WAIT_COPY.updatingScale).toEqual({
      titleEn: "Updating scale…",
      titleZh: "正在更新比例尺…",
    });
    expect(OFFICIAL_WAIT_COPY.updatingIsolines).toEqual({
      titleEn: "Updating isolines…",
      titleZh: "正在更新等照度線…",
    });
    expect(OFFICIAL_WAIT_COPY.loadingView).toEqual({
      titleEn: "Loading…",
      titleZh: "正在載入…",
    });

    const dialog = read("src/components/OfficialWaitDialog.tsx");
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain('aria-busy="true"');
    expect(dialog).toContain("titleEn");
    expect(dialog).toContain("titleZh");
    expect(dialog).toContain("official-wait-backdrop");
    expect(dialog).toContain("official-wait-spinner");
    expect(dialog).not.toMatch(/onClick/);
    expect(dialog).not.toMatch(/onKeyDown|Escape/);
    expect(dialog).not.toMatch(/onClose|setOpen\(false\)|dismiss/i);
    expect(dialog).not.toMatch(/<button/i);

    const hook = read("src/components/useOfficialWaitDialog.tsx");
    expect(hook).toContain("export function useOfficialWaitDialog");
    expect(hook).toContain("officialWaitAfterPaint");
    expect(hook).toContain("officialWaitBeforeWork");
    expect(hook).toContain("flushSync");
    expect(hook).toContain("OfficialWaitDialog");
    expect(typeof officialWaitAfterPaint).toBe("function");
    expect(typeof officialWaitBeforeWork).toBe("function");
    expect(typeof officialWaitYield).toBe("function");
  });

  it("yields to the event loop so heavy work can keep the page responsive", async () => {
    let released = false;
    const pending = officialWaitYield().then(() => {
      released = true;
    });
    expect(released).toBe(false);
    await pending;
    expect(released).toBe(true);
  });
});
