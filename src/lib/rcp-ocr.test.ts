import { describe, expect, it } from "vitest";
import {
  buildSyntheticRcpTestPng,
  dedupeRcpProposals,
  detectRcpFromImageBuffer,
  looksLikeFixtureCode,
  proposalsFromOcrWords,
} from "./rcp-ocr";
import { normalizeFixtureCode } from "./fixture-code-map";
import type { Underlay } from "@luxsim/project-io";

describe("looksLikeFixtureCode", () => {
  it("accepts schedule-style codes", () => {
    expect(looksLikeFixtureCode("DL-01")).toBe(true);
    expect(looksLikeFixtureCode("XX")).toBe(false);
  });
});

describe("proposalsFromOcrWords", () => {
  it("builds proposals with codeNorm and dedupes", () => {
    const underlay: Underlay = {
      id: "u1",
      storeyId: "s1",
      assetId: "a1",
      kind: "image",
      opacity: 1,
      metersPerUnit: 0.02,
      offsetX: 0,
      offsetY: 0,
      sourceWidthPx: 800,
      sourceHeightPx: 600,
    };
    const { proposals } = proposalsFromOcrWords(
      [
        {
          text: "DL-01",
          confidence: 92,
          bbox: { x0: 90, y0: 170, x1: 180, y1: 210 },
        },
        {
          text: "DL-01",
          confidence: 80,
          bbox: { x0: 95, y0: 175, x1: 175, y1: 205 },
        },
        {
          text: "DL-02",
          confidence: 88,
          bbox: { x0: 390, y0: 320, x1: 480, y1: 360 },
        },
      ],
      { underlay, underlayId: "u1", confidenceMin: 0.5 }
    );
    expect(proposals.length).toBe(2);
    const norms = proposals.map((p) => p.codeNorm ?? normalizeFixtureCode(p.codeRaw)).sort();
    expect(norms).toEqual(["DL01", "DL02"]);
    expect(proposals.every((p) => p.pointM && p.status === "pending")).toBe(true);
  });
});

describe("dedupeRcpProposals", () => {
  it("keeps highest confidence per code cluster", () => {
    const out = dedupeRcpProposals([
      {
        id: "1",
        codeRaw: "A-1",
        codeNorm: "A1",
        confidence: 0.9,
        status: "pending",
        bboxPx: { x0: 0, y0: 0, x1: 10, y1: 10 },
      },
      {
        id: "2",
        codeRaw: "A-1",
        codeNorm: "A1",
        confidence: 0.5,
        status: "pending",
        bboxPx: { x0: 2, y0: 2, x1: 12, y1: 12 },
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.confidence).toBe(0.9);
  });
});

/** Deterministic labels for synthetic PNG layout (48px font at x,y baseline). */
export const GOLDEN_SYNTHETIC_OCR_LABELS: OcrWordBox[] = [
  {
    text: "DL-01",
    confidence: 92,
    bbox: { x0: 100, y0: 158, x1: 232, y1: 208 },
  },
  {
    text: "DL-02",
    confidence: 90,
    bbox: { x0: 400, y0: 308, x1: 532, y1: 358 },
  },
];

describe("golden synthetic labeled recall", () => {
  it("maps labeled DL-01 / DL-02 pixel boxes to proposals", () => {
    const underlay: Underlay = {
      id: "u_golden",
      storeyId: "s1",
      assetId: "a1",
      kind: "image",
      opacity: 1,
      metersPerUnit: 0.015,
      offsetX: 0,
      offsetY: 0,
      sourceWidthPx: 800,
      sourceHeightPx: 600,
    };
    const { proposals } = proposalsFromOcrWords(GOLDEN_SYNTHETIC_OCR_LABELS, {
      underlay,
      underlayId: "u_golden",
      confidenceMin: 0.5,
    });
    const norms = new Set(
      proposals.map((p) => p.codeNorm ?? normalizeFixtureCode(p.codeRaw))
    );
    expect(norms.has("DL01")).toBe(true);
    expect(norms.has("DL02")).toBe(true);
    expect(proposals.length).toBeGreaterThanOrEqual(2);
  });
});

describe("detectRcpFromImageBuffer (tesseract e2e)", () => {
  it(
    "runs local OCR on synthetic PNG without error",
    async () => {
      const png = buildSyntheticRcpTestPng([
        { text: "DL-01", x: 100, y: 200 },
        { text: "DL-02", x: 400, y: 350 },
      ]);
      const underlay: Underlay = {
        id: "u_golden",
        storeyId: "s1",
        assetId: "a1",
        kind: "image",
        opacity: 1,
        metersPerUnit: 0.015,
        offsetX: 0,
        offsetY: 0,
        sourceWidthPx: 800,
        sourceHeightPx: 600,
      };
      const { proposals } = await detectRcpFromImageBuffer(png, {
        underlay,
        underlayId: "u_golden",
        confidenceMin: 0.35,
      });
      expect(Array.isArray(proposals)).toBe(true);
    },
    120_000
  );
});
