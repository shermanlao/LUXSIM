import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { rectPolygon } from "@luxsim/project-io";
import {
  OFFICIAL_PLAN_EMPTY_MAX_X,
  OFFICIAL_PLAN_EMPTY_MAX_Y,
  OFFICIAL_PLAN_EMPTY_MIN_X,
  OFFICIAL_PLAN_EMPTY_MIN_Y,
  OFFICIAL_PLAN_FIT_MARGIN,
  OFFICIAL_PLAN_MIN_SPAN_M,
  OFFICIAL_PLAN_PAD_M,
  OFFICIAL_PLAN_VIEW_H,
  OFFICIAL_PLAN_VIEW_W,
  officialPlanFitTransform,
  officialPlanSvgToWorld,
  officialPlanToScreen,
  officialPlanWorldBounds,
  type OfficialPlanBoundsInput,
  type OfficialPlanWorldBounds,
} from "./official-plan-world-bounds";

const FAR_DRAFT = [
  { x: 100, y: 80 },
  { x: -40, y: -30 },
  { x: 6, y: 50 },
];

function room(x: number, y: number, w: number, d: number) {
  return { polygon: rectPolygon(x, y, w, d) };
}

function padBounds(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): OfficialPlanWorldBounds {
  return {
    minX: minX - OFFICIAL_PLAN_PAD_M,
    minY: minY - OFFICIAL_PLAN_PAD_M,
    width: Math.max(OFFICIAL_PLAN_MIN_SPAN_M, maxX - minX + 2 * OFFICIAL_PLAN_PAD_M),
    depth: Math.max(OFFICIAL_PLAN_MIN_SPAN_M, maxY - minY + 2 * OFFICIAL_PLAN_PAD_M),
  };
}

/** The previous Top-plan path that folded draft points into the fitted bounds. */
function legacyBoundsIncludingDraft(
  input: OfficialPlanBoundsInput
): OfficialPlanWorldBounds {
  const base = officialPlanWorldBounds({ ...input, draft: undefined });
  const pts = input.draft ?? [];
  if (pts.length === 0) return base;
  // Invert the official pad so we can expand the pre-pad box, then re-apply it.
  let minX = base.minX + OFFICIAL_PLAN_PAD_M;
  let minY = base.minY + OFFICIAL_PLAN_PAD_M;
  let maxX = minX + (base.width - 2 * OFFICIAL_PLAN_PAD_M);
  let maxY = minY + (base.depth - 2 * OFFICIAL_PLAN_PAD_M);
  // Empty default is 12×10 with pad, so the unpadded box is already correct.
  // For the empty span the unpadded width is 12, depth 10.
  if (
    base.minX === OFFICIAL_PLAN_EMPTY_MIN_X - OFFICIAL_PLAN_PAD_M &&
    base.minY === OFFICIAL_PLAN_EMPTY_MIN_Y - OFFICIAL_PLAN_PAD_M &&
    base.width ===
      Math.max(
        OFFICIAL_PLAN_MIN_SPAN_M,
        OFFICIAL_PLAN_EMPTY_MAX_X - OFFICIAL_PLAN_EMPTY_MIN_X + 2 * OFFICIAL_PLAN_PAD_M
      ) &&
    base.depth ===
      Math.max(
        OFFICIAL_PLAN_MIN_SPAN_M,
        OFFICIAL_PLAN_EMPTY_MAX_Y - OFFICIAL_PLAN_EMPTY_MIN_Y + 2 * OFFICIAL_PLAN_PAD_M
      )
  ) {
    minX = OFFICIAL_PLAN_EMPTY_MIN_X;
    minY = OFFICIAL_PLAN_EMPTY_MIN_Y;
    maxX = OFFICIAL_PLAN_EMPTY_MAX_X;
    maxY = OFFICIAL_PLAN_EMPTY_MAX_Y;
  }
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return padBounds(minX, minY, maxX, maxY);
}

function topViewSrc() {
  return readFileSync(
    path.join(process.cwd(), "src/components/editor/TopView2D.tsx"),
    "utf8"
  );
}

function helperSrc() {
  return readFileSync(
    path.join(process.cwd(), "src/lib/official-plan-world-bounds.ts"),
    "utf8"
  );
}

describe("officialPlanWorldBounds — no-draft content", () => {
  it("keeps the default 12×10 empty fit (1 m pad, 4 m minimum span)", () => {
    expect(OFFICIAL_PLAN_EMPTY_MIN_X).toBe(0);
    expect(OFFICIAL_PLAN_EMPTY_MIN_Y).toBe(0);
    expect(OFFICIAL_PLAN_EMPTY_MAX_X).toBe(12);
    expect(OFFICIAL_PLAN_EMPTY_MAX_Y).toBe(10);
    expect(OFFICIAL_PLAN_PAD_M).toBe(1);
    expect(OFFICIAL_PLAN_MIN_SPAN_M).toBe(4);
    expect(officialPlanWorldBounds({})).toEqual({
      minX: -1,
      minY: -1,
      width: 14,
      depth: 12,
    });
    expect(officialPlanWorldBounds({ rooms: [], dxfEntities: [], underlay: null, underlaySize: null })).toEqual(
      officialPlanWorldBounds({})
    );
  });

  it("fits a known 5×4 m room at the origin", () => {
    expect(officialPlanWorldBounds({ rooms: [room(0, 0, 5, 4)] })).toEqual({
      minX: -1,
      minY: -1,
      width: 7,
      depth: 6,
    });
  });

  it("fits a known underlay size and offset", () => {
    expect(
      officialPlanWorldBounds({
        underlay: { offsetX: 2, offsetY: 3 },
        underlaySize: { widthM: 20, heightM: 10 },
      })
    ).toEqual({
      minX: 1,
      minY: 2,
      width: 22,
      depth: 12,
    });
  });

  it("unions a room with an underlay and DXF points", () => {
    expect(
      officialPlanWorldBounds({
        rooms: [room(0, 0, 5, 4)],
        dxfEntities: [{ points: [{ x: -2, y: -3 }, { x: 8, y: 1 }] }],
        underlay: { offsetX: 0, offsetY: 0 },
        underlaySize: { widthM: 20, heightM: 10 },
      })
    ).toEqual({
      minX: -3,
      minY: -4,
      width: 24,
      depth: 15,
    });
  });

  it("leaves DXF extents unchanged when metersPerUnit is 1", () => {
    const entities = [{ points: [{ x: -2, y: -3 }, { x: 8, y: 1 }] }];
    expect(
      officialPlanWorldBounds({
        dxfEntities: entities,
        underlay: { offsetX: 0, offsetY: 0, metersPerUnit: 1 },
      })
    ).toEqual(
      officialPlanWorldBounds({
        dxfEntities: entities,
        underlay: { offsetX: 0, offsetY: 0 },
      })
    );
    expect(
      officialPlanWorldBounds({
        dxfEntities: entities,
        underlay: { offsetX: 0, offsetY: 0, metersPerUnit: 1 },
      })
    ).toEqual({
      minX: -3,
      minY: -4,
      width: 12,
      depth: 6,
    });
  });

  it("scales official DXF bounds by metersPerUnit 2 and 0.001, then adds the origin", () => {
    expect(
      officialPlanWorldBounds({
        dxfEntities: [{ points: [{ x: -2, y: -3 }, { x: 8, y: 1 }] }],
        underlay: { offsetX: 0, offsetY: 0, metersPerUnit: 2 },
      })
    ).toEqual({
      minX: -5,
      minY: -7,
      width: 22,
      depth: 10,
    });
    expect(
      officialPlanWorldBounds({
        dxfEntities: [{ points: [{ x: 0, y: 0 }, { x: 10000, y: 5000 }] }],
        underlay: { offsetX: 0, offsetY: 0, metersPerUnit: 0.001 },
      })
    ).toEqual({
      minX: -1,
      minY: -1,
      width: 12,
      depth: 7,
    });
    expect(
      officialPlanWorldBounds({
        dxfEntities: [{ points: [{ x: 10, y: 5 }] }],
        underlay: { offsetX: 1, offsetY: -3, metersPerUnit: 2 },
      })
    ).toEqual({
      minX: 20,
      minY: 6,
      width: 4,
      depth: 4,
    });
  });

  it("does not multiply existing room polygons by metersPerUnit", () => {
    // Room stays 5×4 m. The DXF corner at entity (5, 4) becomes (10, 8) after mpu 2.
    expect(
      officialPlanWorldBounds({
        rooms: [room(0, 0, 5, 4)],
        dxfEntities: [{ points: [{ x: 5, y: 4 }] }],
        underlay: { offsetX: 0, offsetY: 0, metersPerUnit: 2 },
      })
    ).toEqual({
      minX: -1,
      minY: -1,
      width: 12,
      depth: 10,
    });
  });

  it("applies the 4 m minimum span to a tiny room", () => {
    expect(officialPlanWorldBounds({ rooms: [room(0, 0, 0.5, 0.5)] })).toEqual({
      minX: -1,
      minY: -1,
      width: 4,
      depth: 4,
    });
  });

  it("ignores an underlay when its world size is missing", () => {
    expect(
      officialPlanWorldBounds({
        rooms: [room(0, 0, 5, 4)],
        underlay: { offsetX: 0, offsetY: 0 },
        underlaySize: null,
      })
    ).toEqual(officialPlanWorldBounds({ rooms: [room(0, 0, 5, 4)] }));
  });
});

describe("officialPlanWorldBounds — freeze while drawing", () => {
  it("does not move the empty 12×10 fit when a draft is drawn in an empty scene", () => {
    const empty = officialPlanWorldBounds({});
    const during = officialPlanWorldBounds({ draft: FAR_DRAFT });
    expect(during).toEqual(empty);
    expect(officialPlanFitTransform(during)).toEqual(officialPlanFitTransform(empty));
    const expanded = legacyBoundsIncludingDraft({ draft: FAR_DRAFT });
    expect(expanded.width).toBeGreaterThan(empty.width);
    expect(during).not.toEqual(expanded);
  });

  it("does not change official fit scale or origin when a draft point falls outside the current bounds", () => {
    const content: OfficialPlanBoundsInput = { rooms: [room(0, 0, 5, 4)] };
    const before = officialPlanWorldBounds(content);
    const fitBefore = officialPlanFitTransform(before);
    const during = officialPlanWorldBounds({ ...content, draft: FAR_DRAFT });
    const fitDuring = officialPlanFitTransform(during);
    expect(during).toEqual(before);
    expect(fitDuring).toEqual(fitBefore);

    const expanded = legacyBoundsIncludingDraft({ ...content, draft: FAR_DRAFT });
    expect(expanded).not.toEqual(before);
    expect(officialPlanFitTransform(expanded).scale).not.toBe(fitBefore.scale);
  });

  it("maps the same SVG click to the same world point after adding an out-of-bounds draft corner", () => {
    const content: OfficialPlanBoundsInput = { rooms: [room(0, 0, 5, 4)] };
    const before = officialPlanWorldBounds(content);
    const during = officialPlanWorldBounds({ ...content, draft: FAR_DRAFT });
    const click = officialPlanSvgToWorld(before, 320, 240);
    expect(officialPlanSvgToWorld(during, 320, 240)).toEqual(click);
    const worldPt = { x: 2.5, y: 2 };
    expect(officialPlanToScreen(during, worldPt.x, worldPt.y)).toEqual(
      officialPlanToScreen(before, worldPt.x, worldPt.y)
    );

    const expanded = legacyBoundsIncludingDraft({ ...content, draft: FAR_DRAFT });
    expect(officialPlanSvgToWorld(expanded, 320, 240)).not.toEqual(click);
  });

  it("does not keep the expanded draft bounds after the draft is cleared", () => {
    const content: OfficialPlanBoundsInput = { rooms: [room(0, 0, 5, 4)] };
    const before = officialPlanWorldBounds(content);
    const during = officialPlanWorldBounds({ ...content, draft: FAR_DRAFT });
    const afterLeave = officialPlanWorldBounds({ ...content, draft: [] });
    const expanded = legacyBoundsIncludingDraft({ ...content, draft: FAR_DRAFT });
    expect(during).toEqual(before);
    expect(afterLeave).toEqual(before);
    expect(afterLeave).not.toEqual(expanded);
  });

  it("resumes normal auto-fit from the closed room once the draft is committed", () => {
    const existing = room(0, 0, 5, 4);
    const closedPolygon = [
      { x: 20, y: 0 },
      { x: 28, y: 0 },
      { x: 28, y: 6 },
      { x: 20, y: 6 },
    ];
    const during = officialPlanWorldBounds({
      rooms: [existing],
      draft: closedPolygon,
    });
    expect(during).toEqual(officialPlanWorldBounds({ rooms: [existing] }));

    const afterClose = officialPlanWorldBounds({
      rooms: [existing, { polygon: closedPolygon }],
    });
    expect(afterClose).toEqual({
      minX: -1,
      minY: -1,
      width: 30,
      depth: 8,
    });
    expect(afterClose.width).toBeGreaterThan(during.width);
    expect(officialPlanFitTransform(afterClose).scale).toBeLessThan(
      officialPlanFitTransform(during).scale
    );
  });
});

describe("officialPlanFitTransform", () => {
  it("uses the official 640×480 view and 0.92 margin", () => {
    expect(OFFICIAL_PLAN_VIEW_W).toBe(640);
    expect(OFFICIAL_PLAN_VIEW_H).toBe(480);
    expect(OFFICIAL_PLAN_FIT_MARGIN).toBe(0.92);
    const world = officialPlanWorldBounds({});
    const fit = officialPlanFitTransform(world);
    const scale = Math.min(640 / 14, 480 / 12) * 0.92;
    expect(fit.scale).toBe(scale);
    expect(fit.ox).toBe((640 - 14 * scale) / 2);
    expect(fit.oy).toBe((480 - 12 * scale) / 2);
  });

  it("round-trips a world point through SVG coordinates", () => {
    const world = officialPlanWorldBounds({ rooms: [room(0, 0, 5, 4)] });
    const pt = { x: 1.25, y: 3.5 };
    const screen = officialPlanToScreen(world, pt.x, pt.y);
    const back = officialPlanSvgToWorld(world, screen.x, screen.y);
    expect(back.x).toBeCloseTo(pt.x, 10);
    expect(back.y).toBeCloseTo(pt.y, 10);
  });
});

describe("TopView2D wiring", () => {
  it("fits the official plan with the helper and does not put draft in the auto-fit deps", () => {
    const src = topViewSrc();
    expect(src).toContain("officialPlanWorldBounds");
    expect(src).toContain("officialPlanFitTransform");
    expect(src).toContain("OFFICIAL_PLAN_VIEW_W");
    expect(src).toContain("OFFICIAL_PLAN_VIEW_H");
    expect(src).toMatch(
      /officialPlanWorldBounds\(\{\s*rooms,\s*dxfEntities,\s*underlay,\s*underlaySize\s*\}\)/
    );
    expect(src).toMatch(
      /\[rooms,\s*dxfEntities,\s*underlay,\s*underlaySize\]/
    );
    expect(src).not.toMatch(/for \(const p of draft\)/);
    expect(src).not.toMatch(/underlaySize,\s*draft/);
  });

  it("still draws the draft, typed-length lock, close-to-start, and keyboard actions in the frozen view", () => {
    const src = topViewSrc();
    expect(src).toContain("resolveDraftPoint");
    expect(src).toContain("isCloseToStart");
    expect(src).toContain("onDrawRoomPolygon(draft)");
    expect(src).toContain("officialDrawRoomAllowed");
    expect(src).toContain('strokeDasharray="4 3"');
    expect(src).toContain("setOrtho(true)");
    expect(src).toContain('if (e.key === "Enter")');
    expect(src).toContain('if (e.key === "Escape")');
    expect(src).toContain("applyDrawRoomBackspace");
    expect(src).toContain("drawRoomEscapeAction");
    expect(src).not.toContain("setLengthBuf((s) => s.slice(0, -1))");
    expect(src).toContain("[...draft, preview ?? draft[draft.length - 1]!]");
  });

  it("layers user wheel zoom on the official fit and still ignores draft in auto-fit constants", () => {
    const src = topViewSrc();
    const helper = helperSrc();
    expect(src).toContain("planViewTransform");
    expect(src).toContain("plan-zoom");
    expect(src).toContain("officialPlanFitTransform");
    expect(src).toContain("usePlanPointerNav");
    expect(src).toContain("useViewElementSize");
    expect(helper).toContain("void input.draft");
    expect(helper).not.toMatch(/for \(const p of input\.draft/);
    expect(helper).toContain("OFFICIAL_PLAN_EMPTY_MAX_X = 12");
    expect(helper).toContain("OFFICIAL_PLAN_EMPTY_MAX_Y = 10");
  });
});
