import { describe, expect, it } from "vitest";
import type { FixtureCodeMapRule } from "@luxsim/project-io";
import {
  createCodeMapRule,
  lookupFixtureCode,
  mergeCsvIntoCodeMapRules,
  normalizeFixtureCode,
  parseFixtureCodeMapCsv,
  requireMappedFixtureCode,
  CodeMapGateError,
} from "./fixture-code-map";

const L1 = "lum_downlight_1";
const L2 = "lum_downlight_2";

describe("normalizeFixtureCode", () => {
  it("strips separators and uppercases", () => {
    expect(normalizeFixtureCode("  dl-01 ")).toBe("DL01");
    expect(normalizeFixtureCode("DL_01")).toBe("DL01");
  });
});

describe("lookupFixtureCode", () => {
  it("maps DL-01 to L1", () => {
    const rules: FixtureCodeMapRule[] = [
      createCodeMapRule({ codeRaw: "DL-01", luminaireId: L1, match: "exact" }),
    ];
    const r = lookupFixtureCode("DL-01", rules);
    expect(r.status).toBe("mapped");
    expect(r.luminaireId).toBe(L1);
  });

  it("matches aliases when match is alias", () => {
    const rules: FixtureCodeMapRule[] = [
      createCodeMapRule({
        codeRaw: "DL-01",
        luminaireId: L1,
        match: "alias",
        aliases: ["D1", "DOWN-01"],
      }),
    ];
    expect(lookupFixtureCode("D1", rules).luminaireId).toBe(L1);
    expect(lookupFixtureCode("down 01", rules).luminaireId).toBe(L1);
  });

  it("does not match aliases when match is exact only", () => {
    const rules: FixtureCodeMapRule[] = [
      createCodeMapRule({
        codeRaw: "DL-01",
        luminaireId: L1,
        match: "exact",
        aliases: ["D1"],
      }),
    ];
    expect(lookupFixtureCode("D1", rules).status).toBe("unmapped");
    expect(lookupFixtureCode("DL-01", rules).status).toBe("mapped");
  });

  it("returns ambiguous when two rules hit different luminaires", () => {
    const rules: FixtureCodeMapRule[] = [
      createCodeMapRule({ codeRaw: "DL-01", luminaireId: L1, match: "exact" }),
      createCodeMapRule({ codeRaw: "DL-01", luminaireId: L2, match: "exact" }),
    ];
    const r = lookupFixtureCode("DL-01", rules);
    expect(r.status).toBe("ambiguous");
    expect(r.candidates.sort()).toEqual([L1, L2].sort());
  });

  it("returns unmapped when rule deleted", () => {
    const rules: FixtureCodeMapRule[] = [
      createCodeMapRule({ codeRaw: "DL-01", luminaireId: L1, match: "exact" }),
    ];
    expect(lookupFixtureCode("DL-01", rules).status).toBe("mapped");
    expect(lookupFixtureCode("DL-01", []).status).toBe("unmapped");
  });
});

describe("requireMappedFixtureCode", () => {
  it("throws on unmapped and ambiguous", () => {
    expect(() => requireMappedFixtureCode("X", [])).toThrow(CodeMapGateError);
    const rules = [
      createCodeMapRule({ codeRaw: "A", luminaireId: L1, match: "exact" }),
      createCodeMapRule({ codeRaw: "A", luminaireId: L2, match: "exact" }),
    ];
    expect(() => requireMappedFixtureCode("A", rules)).toThrow(CodeMapGateError);
  });
});

describe("parseFixtureCodeMapCsv", () => {
  it("parses rows and header", () => {
    const { rows, errors } = parseFixtureCodeMapCsv(
      "code,luminaireId\nDL-01,lum_a\nDL-02,lum_b\n"
    );
    expect(errors).toHaveLength(0);
    expect(rows).toEqual([
      { code: "DL-01", luminaireId: "lum_a" },
      { code: "DL-02", luminaireId: "lum_b" },
    ]);
  });
});

describe("mergeCsvIntoCodeMapRules", () => {
  it("appends rules from csv", () => {
    const merged = mergeCsvIntoCodeMapRules([], [{ code: "DL-01", luminaireId: L1 }]);
    expect(merged).toHaveLength(1);
    expect(lookupFixtureCode("DL-01", merged).luminaireId).toBe(L1);
  });
});
