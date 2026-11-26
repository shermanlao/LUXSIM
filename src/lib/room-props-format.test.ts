import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { rectPolygon, roomAreaM2, roomBounds, type RoomV2 } from "@luxsim/project-io";
import {
  formatAreaM2,
  formatMetresXy,
  formatOriginMetres,
  shouldShowBoundingMin,
} from "./room-props-format";

function room(polygon: { x: number; y: number }[]): RoomV2 {
  return {
    id: "r1",
    storeyId: "s1",
    name: "Room 1",
    polygon,
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, interreflection: true, bounces: 2, computeUgr: true, maintenanceFactor: 0.8 },
  };
}

/** 4×4 m square with a 2×2 m southwest notch. First corner is not the AABB min. */
const L_POLYGON = [
  { x: 0, y: 2 },
  { x: 2, y: 2 },
  { x: 2, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
];

/** Non-ortho trapezoid whose first corner is not the southwest bound. */
const NON_ORTHO_POLYGON = [
  { x: 1, y: 0 },
  { x: 4, y: 0 },
  { x: 5, y: 3 },
  { x: 0, y: 3 },
];

function readSrc(...parts: string[]): string {
  return readFileSync(path.join("/tmp/luxsim-pdf-improve", ...parts), "utf8");
}

describe("room property formatting", () => {
  it("shows 20 m² for the 5×4 m rectangle and its (0, 0) origin", () => {
    const r = room(rectPolygon(0, 0, 5, 4));
    expect(roomAreaM2(r)).toBe(20);
    expect(formatAreaM2(roomAreaM2(r))).toBe("20 m²");
    expect(formatOriginMetres(r.polygon[0])).toBe("0.00, 0.00 m");
    expect(formatMetresXy(r.polygon[0]!.x, r.polygon[0]!.y)).toBe("0.00, 0.00 m");
  });

  it("keeps non-integer areas to two decimals, including the retest 13.06 / 19.04 style", () => {
    expect(formatAreaM2(12.5)).toBe("12.50 m²");
    expect(formatAreaM2(13.059)).toBe("13.06 m²");
    expect(formatAreaM2(19.037)).toBe("19.04 m²");
  });

  it("renders invalid or non-finite area and missing first corner as —", () => {
    expect(formatAreaM2(Number.NaN)).toBe("—");
    expect(formatAreaM2(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatAreaM2(-1)).toBe("—");
    expect(formatMetresXy(Number.NaN, 0)).toBe("—");
    expect(formatMetresXy(0, Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatOriginMetres(undefined)).toBe("—");
    expect(formatOriginMetres(null)).toBe("—");
  });

  it("hides Bounding min when the rectangle origin is already the AABB min", () => {
    const r = room(rectPolygon(0, 0, 5, 4));
    const bounds = roomBounds(r);
    expect(bounds.minX).toBe(0);
    expect(bounds.minY).toBe(0);
    expect(shouldShowBoundingMin(r.polygon[0], bounds)).toBe(false);
    expect(shouldShowBoundingMin({ x: 1e-7, y: 0 }, bounds)).toBe(false);
  });

  it("shows Bounding min for an L-shape whose first corner is not the bound min", () => {
    const r = room(L_POLYGON);
    expect(roomAreaM2(r)).toBe(12);
    expect(formatAreaM2(roomAreaM2(r))).toBe("12 m²");
    expect(formatOriginMetres(r.polygon[0])).toBe("0.00, 2.00 m");
    const bounds = roomBounds(r);
    expect(formatMetresXy(bounds.minX, bounds.minY)).toBe("0.00, 0.00 m");
    expect(shouldShowBoundingMin(r.polygon[0], bounds)).toBe(true);
  });

  it("shows Bounding min for a non-ortho room whose first corner is not the bound min", () => {
    const r = room(NON_ORTHO_POLYGON);
    expect(formatAreaM2(roomAreaM2(r))).toBe("12 m²");
    expect(formatOriginMetres(r.polygon[0])).toBe("1.00, 0.00 m");
    const bounds = roomBounds(r);
    expect(formatMetresXy(bounds.minX, bounds.minY)).toBe("0.00, 0.00 m");
    expect(shouldShowBoundingMin(r.polygon[0], bounds)).toBe(true);
  });

  it("hides Bounding min when the first corner is missing", () => {
    expect(shouldShowBoundingMin(undefined, { minX: 0, minY: 0 })).toBe(false);
  });
});

describe("BuildingEditor Properties wiring", () => {
  const src = readSrc("src/components/editor/BuildingEditor.tsx");
  const constructionStart = src.indexOf('data-construction-room-props=""');
  const calculationStart = src.indexOf('data-calculation-room-props=""');
  const fixtureStart = src.indexOf('data-fixture-properties=""');

  it("shows Area and Origin only on the selected-room Properties path", () => {
    expect(constructionStart).toBeGreaterThan(0);
    expect(calculationStart).toBeGreaterThan(constructionStart);
    expect(fixtureStart).toBeGreaterThan(calculationStart);
    const selected = src.slice(constructionStart, calculationStart);
    const calc = src.slice(calculationStart, fixtureStart);
    const after = src.slice(fixtureStart);
    expect(selected).toContain("formatAreaM2(roomAreaM2(activeRoom))");
    expect(selected).toContain("Origin (first corner)");
    expect(selected).toContain("formatOriginMetres(activeRoom.polygon[0])");
    expect(selected).toContain("shouldShowBoundingMin");
    expect(selected).toContain("roomBounds(activeRoom)");
    expect(selected).toContain("Bounding min");
    // Calculation may repeat Area for context, but origin / bounding min stay on Construction.
    expect(calc).not.toContain("Origin (first corner)");
    expect(calc).not.toContain("Bounding min");
    expect(after).not.toContain("Origin (first corner)");
    expect(after).not.toContain("Bounding min");
    expect(src).toContain(
      'showRightConstructionRoom = workflow === "construction" && !selected && !!activeRoom',
    );
    expect(src).not.toContain("No room selected. Set Room height in the Building panel");
    expect(src).not.toContain("Area and origin appear after a room is selected.");
  });

  it("uses official roomAreaM2 / roomBounds and does not start leftover Method 1 UX ports", () => {
    expect(src).toContain("roomAreaM2,");
    expect(src).toContain("roomBounds,");
    expect(src).toContain('from "@/lib/room-props-format"');
    expect(src).toContain("formatAreaM2");
    expect(src).toContain("formatOriginMetres");
    expect(src).toContain("shouldShowBoundingMin");
    expect(src).not.toContain("plan-zoom");
    expect(src).not.toContain("onRoomDrag");
    expect(src).not.toContain("startRoomDrag");
    expect(src).not.toContain("text-[#e8eef2]");
  });
});
