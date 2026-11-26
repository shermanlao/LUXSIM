import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  officialAssetFileDownloadRequested,
  officialContentDisposition,
  officialPlanAssetFileUrl,
} from "./official-content-disposition";

function readSrc(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("official asset file Content-Disposition", () => {
  it("keeps inline as the default and uses attachment for download=1", () => {
    expect(officialAssetFileDownloadRequested(null)).toBe(false);
    expect(officialAssetFileDownloadRequested("")).toBe(false);
    expect(officialAssetFileDownloadRequested("1")).toBe(true);
    expect(officialAssetFileDownloadRequested("true")).toBe(true);
    expect(officialContentDisposition("inline", "plan.dwg")).toBe(
      'inline; filename="plan.dwg"; filename*=UTF-8\'\'plan.dwg'
    );
    expect(officialContentDisposition("attachment", "plan.dwg")).toBe(
      'attachment; filename="plan.dwg"; filename*=UTF-8\'\'plan.dwg'
    );
  });

  it("encodes a non-ASCII file name safely for filename*", () => {
    const header = officialContentDisposition("attachment", "圖則 R1.dwg");
    expect(header.startsWith('attachment; filename="')).toBe(true);
    expect(header).toContain("filename*=UTF-8''");
    expect(header).toContain(encodeURIComponent("圖則 R1.dwg"));
    expect(header).not.toContain("\n");
    const messy = officialContentDisposition("attachment", 'a"b\nc.dwg');
    expect(messy).not.toMatch(/[\r\n]/);
    expect(messy).toContain('filename="a_b_c.dwg"');
  });

  it("builds the current underlay file URL with the download flag", () => {
    expect(officialPlanAssetFileUrl("/api/projects/p1", "asset-9")).toBe(
      "/api/projects/p1/assets/asset-9/file"
    );
    expect(officialPlanAssetFileUrl("/api/projects/p1", "asset-9", { download: true })).toBe(
      "/api/projects/p1/assets/asset-9/file?download=1"
    );
    expect(
      officialPlanAssetFileUrl("/api/share/tok", "asset-9", { download: true })
    ).toBe("/api/share/tok/assets/asset-9/file?download=1");
  });

  it("wires file routes to stay inline unless download=1", () => {
    const projectRoute = readSrc(
      "src/app/api/projects/[id]/assets/[assetId]/file/route.ts"
    );
    const shareRoute = readSrc(
      "src/app/api/share/[token]/assets/[assetId]/file/route.ts"
    );
    for (const src of [projectRoute, shareRoute]) {
      expect(src).toContain("officialContentDisposition");
      expect(src).toContain("officialAssetFileDownloadRequested");
      expect(src).toContain('searchParams.get("download")');
      expect(src).not.toMatch(/Content-Disposition": `inline; filename=/);
    }
  });
});
