import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateEn12464,
  clampMf,
  enAssistPendingStatus,
  getEn12464Template,
} from "./en12464";
import type { CalcResults } from "../../solver/src/types";

const baseResults: CalcResults = {
  version: 1,
  grid: {
    originX: 0,
    originY: 0,
    spacing: 0.5,
    nx: 2,
    ny: 2,
    z: 0.75,
    lux: [650, 650, 650, 650],
  },
  summary: {
    eave: 650,
    emin: 600,
    emax: 700,
    uo: 600 / 650,
    ugr: 18,
    lpd: 5,
    totalWatts: 30,
    areaM2: 6,
  },
  meta: {
    interreflection: true,
    bounces: 2,
    calculatedAt: "2026-01-01T00:00:00.000Z",
    disclaimer: "test",
  },
};

function secondaryResults(eave: number, emin = eave * 0.8): CalcResults {
  return {
    ...baseResults,
    summary: { ...baseResults.summary, eave, emin, uo: emin / eave },
  };
}

describe("evaluateEn12464", () => {
  it("passes office task targets when maintained lux is sufficient", () => {
    const check = evaluateEn12464({
      templateId: "office",
      maintenanceFactor: clampMf(0.8),
      taskResults: baseResults,
    })!;
    expect(check.checks.taskEm.pass).toBe(true);
    expect(check.maintainedEave).toBeCloseTo(650 * 0.8, 1);
    expect(check.overallPass).toBe(true);
  });

  it("evaluates surrounding when secondary results provided", () => {
    const check = evaluateEn12464({
      templateId: "office",
      maintenanceFactor: 0.8,
      taskResults: baseResults,
      surroundingResults: secondaryResults(400, 350),
    })!;
    expect(check.checks.surroundingEm.target).toBe(300);
    expect(check.checks.surroundingEm.pass).toBe(true);
    expect(check.checks.surroundingEm.actual).toBeCloseTo(400 * 0.8, 6);
  });

  it("honest null surrounding without secondary grid keeps the office surrounding target", () => {
    const check = evaluateEn12464({
      templateId: "office",
      maintenanceFactor: 0.8,
      taskResults: baseResults,
    })!;
    expect(check.checks.surroundingEm.pass).toBeNull();
    expect(check.checks.surroundingEm.actual).toBeNull();
    expect(check.checks.surroundingEm.target).toBe(300);
    expect(check.checks.surroundingEm.note).toMatch(/Surrounding target defined/i);
    expect(check.checks.surroundingEm.note).not.toMatch(/no surrounding grid|Single workplane/i);
    expect(check.overallPass).toBe(true);
  });

  it("keeps corridor and lobby background targets and does not invent actuals without a second grid", () => {
    const corridor = evaluateEn12464({
      templateId: "corridor",
      maintenanceFactor: 0.8,
      taskResults: baseResults,
    })!;
    expect(getEn12464Template("corridor")?.backgroundEm).toBe(75);
    expect(corridor.checks.backgroundEm.target).toBe(75);
    expect(corridor.checks.backgroundEm.pass).toBeNull();
    expect(corridor.checks.backgroundEm.actual).toBeNull();
    expect(corridor.checks.backgroundEm.note).toMatch(/Background target defined/i);
    expect(corridor.checks.surroundingEm.target).toBeNull();
    expect(corridor.checks.surroundingEm.pass).toBeNull();
    expect(corridor.checks.surroundingEm.actual).toBeNull();
    expect(corridor.checks.surroundingEm.note).toBe("No surrounding-area target for template");
    expect(corridor.checks.surroundingEm.note).not.toMatch(/no surrounding grid|Single workplane/i);
    expect(corridor.overallPass).toBe(true);

    const lobby = evaluateEn12464({
      templateId: "lobby",
      maintenanceFactor: 0.8,
      taskResults: baseResults,
    })!;
    expect(getEn12464Template("lobby")?.backgroundEm).toBe(100);
    expect(getEn12464Template("lobby")?.surroundingEmRatio).toBe(0.5);
    expect(lobby.checks.backgroundEm.target).toBe(100);
    expect(lobby.checks.backgroundEm.pass).toBeNull();
    expect(lobby.checks.backgroundEm.actual).toBeNull();
    expect(lobby.checks.backgroundEm.note).toMatch(/Background target defined/i);
    expect(lobby.checks.surroundingEm.target).toBe(100);
    expect(lobby.checks.surroundingEm.pass).toBeNull();
    expect(lobby.checks.surroundingEm.actual).toBeNull();
    expect(lobby.checks.surroundingEm.note).toMatch(/Surrounding target defined/i);
    expect(lobby.overallPass).toBe(true);
  });

  it("does not invent surrounding or background pass/fail when second-grid results are absent", () => {
    for (const id of ["office", "corridor", "lobby", "restroom"] as const) {
      const check = evaluateEn12464({
        templateId: id,
        maintenanceFactor: 0.8,
        taskResults: baseResults,
      })!;
      expect(check.checks.surroundingEm.pass).toBeNull();
      expect(check.checks.surroundingEm.actual).toBeNull();
      expect(check.checks.backgroundEm.pass).toBeNull();
      expect(check.checks.backgroundEm.actual).toBeNull();
    }
  });

  it("does not change overallPass rules when unevaluated surrounding or background checks are null", () => {
    const office = evaluateEn12464({
      templateId: "office",
      maintenanceFactor: 0.8,
      taskResults: baseResults,
    })!;
    expect(office.checks.surroundingEm.pass).toBeNull();
    expect(office.checks.backgroundEm.pass).toBeNull();
    expect(office.overallPass).toBe(true);

    const failingTask: CalcResults = {
      ...baseResults,
      summary: { ...baseResults.summary, eave: 400, emin: 200, uo: 0.5, ugr: 18 },
    };
    const failTaskOnly = evaluateEn12464({
      templateId: "office",
      maintenanceFactor: 0.8,
      taskResults: failingTask,
    })!;
    expect(failTaskOnly.checks.taskEm.pass).toBe(false);
    expect(failTaskOnly.checks.surroundingEm.pass).toBeNull();
    expect(failTaskOnly.overallPass).toBe(false);

    const failSurrounding = evaluateEn12464({
      templateId: "office",
      maintenanceFactor: 0.8,
      taskResults: baseResults,
      surroundingResults: secondaryResults(200),
    })!;
    expect(failSurrounding.checks.surroundingEm.target).toBe(300);
    expect(failSurrounding.checks.surroundingEm.pass).toBe(false);
    expect(failSurrounding.overallPass).toBe(false);

    const failBackground = evaluateEn12464({
      templateId: "corridor",
      maintenanceFactor: 0.8,
      taskResults: baseResults,
      backgroundResults: secondaryResults(50),
    })!;
    expect(failBackground.checks.backgroundEm.target).toBe(75);
    expect(failBackground.checks.backgroundEm.pass).toBe(false);
    expect(failBackground.overallPass).toBe(false);

    const passBackground = evaluateEn12464({
      templateId: "corridor",
      maintenanceFactor: 0.8,
      taskResults: baseResults,
      backgroundResults: secondaryResults(100),
    })!;
    expect(passBackground.checks.backgroundEm.pass).toBe(true);
    expect(passBackground.overallPass).toBe(true);
  });

  it("uses no-target wording for restroom surrounding and office background", () => {
    const restroom = evaluateEn12464({
      templateId: "restroom",
      maintenanceFactor: 0.8,
      taskResults: baseResults,
    })!;
    expect(restroom.checks.surroundingEm.note).toBe("No surrounding-area target for template");
    expect(restroom.checks.backgroundEm.note).toBe("No background target for template");
    expect(restroom.checks.surroundingEm.target).toBeNull();
    expect(restroom.checks.backgroundEm.target).toBeNull();

    const office = evaluateEn12464({
      templateId: "office",
      maintenanceFactor: 0.8,
      taskResults: baseResults,
    })!;
    expect(office.checks.backgroundEm.note).toBe("No background target for template");
    expect(office.checks.backgroundEm.target).toBeNull();
  });
});

describe("enAssistPendingStatus", () => {
  it("does not phrase a missing template target as not evaluated", () => {
    const corridor = evaluateEn12464({
      templateId: "corridor",
      maintenanceFactor: 0.8,
      taskResults: baseResults,
    })!;
    const noSurr = enAssistPendingStatus(corridor.checks.surroundingEm);
    expect(noSurr.status).toBe("no-target");
    expect(noSurr.label).toBe("No surrounding-area target for template");
    expect(noSurr.label).not.toMatch(/not evaluated/i);
    expect(noSurr.showNoteBelow).toBe(false);

    const pendingBg = enAssistPendingStatus(corridor.checks.backgroundEm);
    expect(pendingBg.status).toBe("not-evaluated");
    expect(pendingBg.label).toBe("not evaluated");
    expect(pendingBg.showNoteBelow).toBe(true);
    expect(corridor.checks.backgroundEm.target).toBe(75);

    const office = evaluateEn12464({
      templateId: "office",
      maintenanceFactor: 0.8,
      taskResults: baseResults,
    })!;
    const pendingSurr = enAssistPendingStatus(office.checks.surroundingEm);
    expect(pendingSurr.status).toBe("not-evaluated");
    expect(pendingSurr.label).toBe("not evaluated");
    expect(office.checks.surroundingEm.target).toBe(300);

    const noBg = enAssistPendingStatus(office.checks.backgroundEm);
    expect(noBg.status).toBe("no-target");
    expect(noBg.label).toBe("No background target for template");
    expect(noBg.label).not.toMatch(/not evaluated/i);
  });

  it("keeps the official properties panel listing Background Em from evaluateEn12464", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
      "utf8"
    );
    expect(src).toContain('PassRow label="Background Em" check={en12464Check.checks.backgroundEm}');
    expect(src).toContain('PassRow label="Surr. Em" check={en12464Check.checks.surroundingEm}');
    expect(src).toContain("enAssistPendingStatus");
    expect(src).not.toMatch(/Single workplane — no surrounding grid/);
  });
});
