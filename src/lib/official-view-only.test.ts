import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("view-only projects cannot be edited", () => {
  it("blocks scene writes and shows property values as text", () => {
    const editor = read("src/components/editor/BuildingEditor.tsx");
    expect(editor).toContain("if (readOnly && !opts?.viewOnlySafe) return;");
    expect(editor).toContain("viewOnlySafe: true");
    expect(editor).toContain("OfficialMaybeInput");
    expect(editor).toContain("OfficialMaybeSelect");
    expect(editor).toContain("{!readOnly && (");
    expect(editor).toContain('readOnly ? "cad-project-name official-view-value" : "cad-project-input"');
    expect(editor).toContain('status || (readOnly ? "View only');
    expect(editor).toContain("if (readOnly) return false;");
    expect(editor).toContain("pendingDiscardRoomIds != null && !readOnly");

    const fields = read("src/components/editor/OfficialViewField.tsx");
    expect(fields).toContain("official-view-value");
    expect(fields).toContain("if (readOnly)");

    const top = read("src/components/editor/TopView2D.tsx");
    expect(top).toContain("readOnly = false");
    expect(top).toContain("if (readOnly) return;");
    expect(top).toContain('cursor: readOnly ? "pointer"');
    expect(top).toContain("!readOnly &&");

    const elev = read("src/components/editor/ElevationView2D.tsx");
    expect(elev).toContain("readOnly = false");
    expect(elev).toContain("if (readOnly) return;");

    const scene3d = read("src/components/editor/BuildingScene3D.tsx");
    expect(scene3d).toContain("readOnly = false");
    expect(scene3d).toContain("if (readOnly) return;");
  });
});
