import { describe, expect, it } from "vitest";
import {
  officialDxfMtextRotationDeg,
  officialDxfTextInsertionPoint,
  officialDxfTextLabelsToWorld,
  officialIsDxfTextLabelList,
  officialStripDxfText,
  officialVisibleDxfTextLabels,
  parseDxfTextLabels,
} from "./official-dxf-text";

function dxf(chunks: string[]): string {
  return chunks.join("\n") + "\n";
}

function entity(type: string, groups: Array<[number, string | number]>): string[] {
  const lines = ["0", type];
  for (const [code, value] of groups) {
    lines.push(String(code), String(value));
  }
  return lines;
}

describe("officialStripDxfText", () => {
  it("trims and ignores empty or whitespace-only text", () => {
    expect(officialStripDxfText("  LT-01  ")).toBe("LT-01");
    expect(officialStripDxfText(" \n\t ")).toBe("");
    expect(officialStripDxfText("{\\fArial|b0|i0|c0|p34;  }", "MTEXT")).toBe("");
  });

  it("strips MTEXT formatting and paragraph breaks", () => {
    expect(officialStripDxfText("\\pxqc;LT01\\Pextra", "MTEXT")).toBe("LT01 extra");
    expect(officialStripDxfText("{\\fArial|b0|i0|c0|p34;DL-2}", "MTEXT")).toBe("DL-2");
    expect(officialStripDxfText("\\A1;1840", "MTEXT")).toBe("1840");
    expect(officialStripDxfText("AP-7100^J430 (W)", "MTEXT")).toBe("AP-7100 430 (W)");
  });
});

describe("parseDxfTextLabels", () => {
  it("reads model-space TEXT at the insertion point and rotation", () => {
    const labels = parseDxfTextLabels(
      dxf([
        "0",
        "SECTION",
        "2",
        "ENTITIES",
        ...entity("TEXT", [
          [8, "EL-LIGHTING"],
          [10, 1500],
          [20, 2500],
          [1, "LT01"],
          [50, 90],
        ]),
        "0",
        "ENDSEC",
        "0",
        "EOF",
      ])
    );
    expect(labels).toEqual([
      {
        text: "LT01",
        x: 1500,
        y: 2500,
        rotationDeg: 90,
        layer: "EL-LIGHTING",
        kind: "TEXT",
      },
    ]);
  });

  it("keeps drawing units (does not convert millimetres itself)", () => {
    const labels = parseDxfTextLabels(
      dxf([
        "0",
        "SECTION",
        "2",
        "HEADER",
        "9",
        "$INSUNITS",
        "70",
        "4",
        "0",
        "ENDSEC",
        "0",
        "SECTION",
        "2",
        "ENTITIES",
        ...entity("TEXT", [
          [10, 1000],
          [20, 2000],
          [1, "A1"],
        ]),
        "0",
        "ENDSEC",
      ])
    );
    expect(labels[0]).toMatchObject({ text: "A1", x: 1000, y: 2000 });
    const world = officialDxfTextLabelsToWorld(labels, { metersPerUnit: 0.001 });
    expect(world[0]).toMatchObject({ text: "A1", x: 1, y: 2 });
  });

  it("skips paperspace TEXT and MTEXT", () => {
    const labels = parseDxfTextLabels(
      dxf([
        "0",
        "SECTION",
        "2",
        "ENTITIES",
        ...entity("TEXT", [
          [67, 1],
          [10, 1],
          [20, 1],
          [1, "PAPER"],
        ]),
        ...entity("MTEXT", [
          [67, 1],
          [10, 2],
          [20, 2],
          [1, "SHEET"],
        ]),
        ...entity("TEXT", [
          [10, 3],
          [20, 4],
          [1, "MODEL"],
        ]),
        "0",
        "ENDSEC",
      ])
    );
    expect(labels.map((l) => l.text)).toEqual(["MODEL"]);
  });

  it("ignores empty and whitespace-only TEXT and MTEXT", () => {
    const labels = parseDxfTextLabels(
      dxf([
        "0",
        "SECTION",
        "2",
        "ENTITIES",
        ...entity("TEXT", [
          [10, 0],
          [20, 0],
          [1, "   "],
        ]),
        ...entity("MTEXT", [
          [10, 1],
          [20, 1],
          [1, "{\\fArial|b0;  }"],
        ]),
        ...entity("TEXT", [
          [10, 2],
          [20, 2],
          [1, "OK"],
        ]),
        "0",
        "ENDSEC",
      ])
    );
    expect(labels.map((l) => l.text)).toEqual(["OK"]);
  });

  it("concatenates MTEXT group 3 chunks and uses the attachment point", () => {
    const labels = parseDxfTextLabels(
      dxf([
        "0",
        "SECTION",
        "2",
        "ENTITIES",
        ...entity("MTEXT", [
          [8, "L-CODE"],
          [10, 10],
          [20, 20],
          [3, "LT-0"],
          [1, "1a"],
          [50, 45],
        ]),
        "0",
        "ENDSEC",
      ])
    );
    expect(labels).toEqual([
      {
        text: "LT-01a",
        x: 10,
        y: 20,
        rotationDeg: 45,
        layer: "L-CODE",
        kind: "MTEXT",
      },
    ]);
  });

  it("derives MTEXT rotation from the 11/21 direction when group 50 is omitted", () => {
    expect(officialDxfMtextRotationDeg(undefined, 0, 1)).toBeCloseTo(90, 6);
    const labels = parseDxfTextLabels(
      dxf([
        "0",
        "SECTION",
        "2",
        "ENTITIES",
        ...entity("MTEXT", [
          [10, 0],
          [20, 0],
          [11, 0],
          [21, 1],
          [1, "UP"],
        ]),
        "0",
        "ENDSEC",
      ])
    );
    expect(labels[0]!.rotationDeg).toBeCloseTo(90, 6);
  });

  it("uses the TEXT alignment point when justification is not left/baseline", () => {
    expect(
      officialDxfTextInsertionPoint({
        kind: "TEXT",
        x: 0,
        y: 0,
        alignX: 5,
        alignY: 7,
        horizJust: 1,
        vertJust: 0,
      })
    ).toEqual({ x: 5, y: 7 });
    const labels = parseDxfTextLabels(
      dxf([
        "0",
        "SECTION",
        "2",
        "ENTITIES",
        ...entity("TEXT", [
          [10, 0],
          [20, 0],
          [11, 12],
          [21, 34],
          [72, 1],
          [1, "CTR"],
        ]),
        "0",
        "ENDSEC",
      ])
    );
    expect(labels[0]).toMatchObject({ text: "CTR", x: 12, y: 34 });
  });

  it("explodes TEXT inside a block through a model-space INSERT", () => {
    const labels = parseDxfTextLabels(
      dxf([
        "0",
        "SECTION",
        "2",
        "BLOCKS",
        "0",
        "BLOCK",
        "2",
        "L1",
        "10",
        "0",
        "20",
        "0",
        ...entity("TEXT", [
          [8, "0"],
          [10, 10],
          [20, 0],
          [1, "L1"],
          [50, 15],
        ]),
        "0",
        "ENDBLK",
        "0",
        "ENDSEC",
        "0",
        "SECTION",
        "2",
        "ENTITIES",
        ...entity("INSERT", [
          [8, "EL-LIGHTING"],
          [2, "L1"],
          [10, 100],
          [20, 200],
          [50, 90],
        ]),
        "0",
        "ENDSEC",
      ])
    );
    // Local (10,0) rotated 90° about the insert at (100,200) → (100,210)
    expect(labels).toHaveLength(1);
    expect(labels[0]!.text).toBe("L1");
    expect(labels[0]!.x).toBeCloseTo(100, 8);
    expect(labels[0]!.y).toBeCloseTo(210, 8);
    expect(labels[0]!.rotationDeg).toBe(105);
    expect(labels[0]!.layer).toBe("EL-LIGHTING");
    expect(labels[0]!.kind).toBe("TEXT");
  });

  it("explodes nested INSERT text and skips paperspace INSERT", () => {
    const labels = parseDxfTextLabels(
      dxf([
        "0",
        "SECTION",
        "2",
        "BLOCKS",
        "0",
        "BLOCK",
        "2",
        "INNER",
        "10",
        "0",
        "20",
        "0",
        ...entity("TEXT", [
          [8, "CODES"],
          [10, 1],
          [20, 0],
          [1, "IN"],
        ]),
        "0",
        "ENDBLK",
        "0",
        "BLOCK",
        "2",
        "OUTER",
        "10",
        "0",
        "20",
        "0",
        ...entity("INSERT", [
          [2, "INNER"],
          [10, 10],
          [20, 0],
        ]),
        "0",
        "ENDBLK",
        "0",
        "ENDSEC",
        "0",
        "SECTION",
        "2",
        "ENTITIES",
        ...entity("INSERT", [
          [67, 1],
          [2, "OUTER"],
          [10, 0],
          [20, 0],
        ]),
        ...entity("INSERT", [
          [2, "OUTER"],
          [10, 100],
          [20, 50],
        ]),
        "0",
        "ENDSEC",
      ])
    );
    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatchObject({ text: "IN", layer: "CODES", kind: "TEXT" });
    expect(labels[0]!.x).toBeCloseTo(111, 8);
    expect(labels[0]!.y).toBeCloseTo(50, 8);
  });

  it("does not emit text from a block definition at its definition coordinates", () => {
    const labels = parseDxfTextLabels(
      dxf([
        "0",
        "SECTION",
        "2",
        "BLOCKS",
        "0",
        "BLOCK",
        "2",
        "L1",
        ...entity("TEXT", [
          [10, 999],
          [20, 999],
          [1, "L1"],
        ]),
        "0",
        "ENDBLK",
        "0",
        "ENDSEC",
        "0",
        "SECTION",
        "2",
        "ENTITIES",
        "0",
        "ENDSEC",
      ])
    );
    expect(labels).toEqual([]);
  });

  it("reads ATTRIB values that follow an INSERT with group 66 = 1", () => {
    const labels = parseDxfTextLabels(
      dxf([
        "0",
        "SECTION",
        "2",
        "BLOCKS",
        "0",
        "BLOCK",
        "2",
        "FIX",
        "0",
        "ENDBLK",
        "0",
        "ENDSEC",
        "0",
        "SECTION",
        "2",
        "ENTITIES",
        ...entity("INSERT", [
          [2, "FIX"],
          [10, 8],
          [20, 9],
          [66, 1],
        ]),
        ...entity("ATTRIB", [
          [8, "EL-LIGHTING"],
          [10, 8],
          [20, 9],
          [1, "LT03a"],
          [2, "CODE"],
          [50, 30],
        ]),
        "0",
        "SEQEND",
        "0",
        "ENDSEC",
      ])
    );
    expect(labels).toEqual([
      {
        text: "LT03a",
        x: 8,
        y: 9,
        rotationDeg: 30,
        layer: "EL-LIGHTING",
        kind: "ATTRIB",
      },
    ]);
  });

  it("skips ATTRIB on a paperspace INSERT", () => {
    const labels = parseDxfTextLabels(
      dxf([
        "0",
        "SECTION",
        "2",
        "ENTITIES",
        ...entity("INSERT", [
          [67, 1],
          [2, "FIX"],
          [10, 0],
          [20, 0],
          [66, 1],
        ]),
        ...entity("ATTRIB", [
          [10, 0],
          [20, 0],
          [1, "SKIP"],
        ]),
        "0",
        "SEQEND",
        ...entity("TEXT", [
          [10, 1],
          [20, 1],
          [1, "KEEP"],
        ]),
        "0",
        "ENDSEC",
      ])
    );
    expect(labels.map((l) => l.text)).toEqual(["KEEP"]);
  });

  it("does not treat *MODEL_SPACE records as insertable blocks", () => {
    const labels = parseDxfTextLabels(
      dxf([
        "0",
        "SECTION",
        "2",
        "BLOCKS",
        "0",
        "BLOCK",
        "2",
        "*MODEL_SPACE",
        ...entity("TEXT", [
          [10, 1],
          [20, 1],
          [1, "DEF"],
        ]),
        "0",
        "ENDBLK",
        "0",
        "ENDSEC",
        "0",
        "SECTION",
        "2",
        "ENTITIES",
        ...entity("INSERT", [
          [2, "*MODEL_SPACE"],
          [10, 0],
          [20, 0],
        ]),
        ...entity("TEXT", [
          [10, 4],
          [20, 5],
          [1, "OK"],
        ]),
        "0",
        "ENDSEC",
      ])
    );
    expect(labels.map((l) => l.text)).toEqual(["OK"]);
  });
});

describe("officialVisibleDxfTextLabels", () => {
  it("skips codes on hidden layers", () => {
    const labels = parseDxfTextLabels(
      dxf([
        "0",
        "SECTION",
        "2",
        "ENTITIES",
        ...entity("TEXT", [
          [8, "EL-LIGHTING"],
          [10, 0],
          [20, 0],
          [1, "L1"],
        ]),
        ...entity("TEXT", [
          [8, "D-DIM"],
          [10, 1],
          [20, 1],
          [1, "1840"],
        ]),
        "0",
        "ENDSEC",
      ])
    );
    expect(officialVisibleDxfTextLabels(labels, ["D-DIM"]).map((l) => l.text)).toEqual([
      "L1",
    ]);
    expect(officialVisibleDxfTextLabels(labels, []).map((l) => l.text)).toEqual([
      "L1",
      "1840",
    ]);
  });
});

describe("officialIsDxfTextLabelList", () => {
  it("accepts a parsed list including empty", () => {
    expect(officialIsDxfTextLabelList([])).toBe(true);
    expect(
      officialIsDxfTextLabelList([{ text: "A", x: 1, y: 2, rotationDeg: 0, kind: "TEXT" }])
    ).toBe(true);
    expect(officialIsDxfTextLabelList(undefined)).toBe(false);
    expect(officialIsDxfTextLabelList([{ text: "A" }])).toBe(false);
  });
});

describe("officialDxfTextLabelsToWorld", () => {
  it("applies metersPerUnit and offset the same way as linework", () => {
    const world = officialDxfTextLabelsToWorld(
      [{ text: "A", x: 10, y: 5, rotationDeg: 0, kind: "TEXT" }],
      { metersPerUnit: 2, offsetX: 1, offsetY: -3 }
    );
    expect(world[0]).toMatchObject({ text: "A", x: 21, y: 7, rotationDeg: 0 });
  });
});
