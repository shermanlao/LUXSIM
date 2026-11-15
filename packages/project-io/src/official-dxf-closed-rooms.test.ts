import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { defaultSceneV2 } from "./migrate";
import { officialImportedUnderlay } from "./underlay";
import { officialNewRoom } from "./new-room-defaults";
import { rectPolygon } from "./geometry";
import { DEFAULT_NEW_ROOM_HEIGHT_M } from "./official-room-height";
import type { DxfEntity, ProjectSceneV2, RoomV2 } from "./types";
import {
  DXF_CLOSED_ROOM_MIN_AREA_M2,
  DXF_CLOSED_ROOMS_NEED_DXF_STATUS,
  DXF_CLOSED_ROOMS_NONE_STATUS,
  officialAppendRoomsFromDxfClosedPolylines,
  officialCanCreateRoomsFromDxf,
} from "./official-dxf-closed-rooms";

const CLOSED_4X3: DxfEntity = {
  type: "polyline",
  closed: true,
  points: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ],
};

const OPEN_L: DxfEntity = {
  type: "polyline",
  points: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
  ],
};

const OPEN_LINE: DxfEntity = {
  type: "line",
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ],
};

function ids(): { n: number; nextId: () => string } {
  const state = { n: 0, nextId: () => `room-dxf-${++state.n}` };
  return state;
}

function sceneWithDxf(entities: DxfEntity[], extra?: Partial<ProjectSceneV2["underlays"][number]>): ProjectSceneV2 {
  const scene = defaultSceneV2();
  const underlay = officialImportedUnderlay({
    id: "u-dxf",
    storeyId: scene.ui.activeStoreyId,
    assetId: "a-dxf",
    assetKind: "dxf",
    dxfEntities: entities,
  });
  scene.underlays = [{ ...underlay, ...extra }];
  return scene;
}

function line(x1: number, y1: number, x2: number, y2: number): DxfEntity {
  return { type: "line", points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] };
}

const RECT_LINES: DxfEntity[] = [
  line(0, 0, 4, 0),
  line(4, 0, 4, 3),
  line(4, 3, 0, 3),
  line(0, 3, 0, 0),
];

describe("officialCanCreateRoomsFromDxf", () => {
  it("is enabled for a DXF underlay that has a closed polyline or a simple line loop after world mapping", () => {
    const scene = sceneWithDxf([CLOSED_4X3]);
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(true);
    expect(officialCanCreateRoomsFromDxf(sceneWithDxf(RECT_LINES).underlays[0])).toBe(true);
    expect(officialCanCreateRoomsFromDxf(sceneWithDxf([OPEN_L, OPEN_LINE]).underlays[0])).toBe(
      false
    );
    expect(officialCanCreateRoomsFromDxf(null)).toBe(false);
    const image = officialImportedUnderlay({
      id: "u-img",
      storeyId: "s1",
      assetId: "a-img",
      assetKind: "image",
      sourceWidthPx: 100,
      sourceHeightPx: 80,
    });
    expect(officialCanCreateRoomsFromDxf({ ...image, dxfEntities: [CLOSED_4X3] })).toBe(
      false
    );
    const firstLastMm: DxfEntity = {
      type: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 },
        { x: 0, y: 0 },
      ],
    };
    const scaled = sceneWithDxf([firstLastMm], { metersPerUnit: 0.001 });
    expect(officialCanCreateRoomsFromDxf(scaled.underlays[0])).toBe(true);
  });
});

describe("officialAppendRoomsFromDxfClosedPolylines", () => {
  it("creates world-mapped rooms when metersPerUnit is not 1 and the origin is offset", () => {
    const raw: DxfEntity = {
      type: "polyline",
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ],
    };
    const scene = sceneWithDxf([raw], { metersPerUnit: 2, offsetX: 1, offsetY: -3 });
    const selected = officialNewRoom({
      id: "room-selected",
      storeyId: scene.ui.activeStoreyId,
      name: "Office",
      polygon: rectPolygon(20, 20, 2, 2),
      heightM: 3.2,
    });
    selected.calc = {
      ...selected.calc,
      maintenanceFactor: 0.67,
      en12464TemplateId: "office",
      mfBreakdown: { llmf: 0.8, lsf: 0.9, lmf: 1, rsmf: 1 },
    };
    selected.workplaneHeightM = 0.9;
    scene.rooms = [selected];
    scene.ui.activeRoomId = selected.id;
    const before = structuredClone(selected);

    const { n: _n, nextId } = ids();
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: DEFAULT_NEW_ROOM_HEIGHT_M,
      nextId,
    });
    expect(out.created).toBe(1);
    expect(out.status).toBe("Created 1 room from DXF");
    const created = out.scene.rooms.find((room) => room.id === "room-dxf-1");
    expect(created).toBeDefined();
    expect(created!.polygon).toEqual([
      { x: 1, y: -3 },
      { x: 9, y: -3 },
      { x: 9, y: 3 },
      { x: 1, y: 3 },
    ]);
    expect(created!.calc.maintenanceFactor).toBe(0.8);
    expect(created!.calc.en12464TemplateId).toBe("");
    expect(created!.calc.mfBreakdown).toBeUndefined();
    expect(created!.workplaneHeightM).toBe(0.75);
    expect(created!.heightM).toBe(DEFAULT_NEW_ROOM_HEIGHT_M);
    expect(created!.heightM).toBe(2.8);
    expect(created!.name).toBe("Room 2");
    expect(out.scene.ui.activeRoomId).toBe("room-dxf-1");
    expect(out.scene.rooms[0]).toEqual(before);
    expect(scene.rooms).toEqual([before]);
  });

  it("skips degenerate rings, duplicate outlines, and does not rewrite existing rooms", () => {
    const tiny: DxfEntity = {
      type: "polyline",
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 0.05, y: 0 },
        { x: 0.05, y: 0.05 },
        { x: 0, y: 0.05 },
      ],
    };
    // 0.05 * 0.05 = 0.0025 m² < 0.01
    expect(DXF_CLOSED_ROOM_MIN_AREA_M2).toBe(0.01);
    const twoPoints: DxfEntity = {
      type: "polyline",
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
    };
    const existingPoly = rectPolygon(0, 0, 4, 3);
    const scene = sceneWithDxf([CLOSED_4X3, tiny, twoPoints, CLOSED_4X3]);
    const existing = officialNewRoom({
      id: "room-existing",
      storeyId: scene.ui.activeStoreyId,
      name: "Existing",
      polygon: existingPoly,
      heightM: 3,
    });
    scene.rooms = [existing];
    const before = structuredClone(existing);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(0);
    expect(out.skipped).toBe(4);
    expect(out.status).toBe(DXF_CLOSED_ROOMS_NONE_STATUS);
    expect(out.scene).toBe(scene);
    expect(out.scene.rooms).toEqual([before]);
    expect(out.scene.rooms[0]).toEqual(before);
  });

  it("creates nothing from only open lines and reports the official status", () => {
    const scene = sceneWithDxf([OPEN_L, OPEN_LINE]);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(false);
    expect(out.created).toBe(0);
    expect(out.skipped).toBe(0);
    expect(out.scene.rooms).toEqual([]);
    expect(out.scene).toBe(scene);
    expect(out.status).toBe(DXF_CLOSED_ROOMS_NONE_STATUS);
  });

  it("does not create rooms from a non-DXF underlay", () => {
    const scene = defaultSceneV2();
    const image = officialImportedUnderlay({
      id: "u-img",
      storeyId: scene.ui.activeStoreyId,
      assetId: "a-img",
      assetKind: "image",
      sourceWidthPx: 800,
      sourceHeightPx: 600,
    });
    scene.underlays = [{ ...image, dxfEntities: [CLOSED_4X3] }];
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(0);
    expect(out.scene.rooms).toEqual([]);
    expect(out.status).toBe(DXF_CLOSED_ROOMS_NEED_DXF_STATUS);
  });

  it("creates two rooms from two different closed polylines and skips a later duplicate", () => {
    const other: DxfEntity = {
      type: "polyline",
      closed: true,
      points: [
        { x: 10, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 2 },
        { x: 10, y: 2 },
      ],
    };
    const shiftedStart: DxfEntity = {
      type: "polyline",
      closed: true,
      points: [
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
        { x: 0, y: 0 },
      ],
    };
    const scene = sceneWithDxf([CLOSED_4X3, other, shiftedStart]);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(2);
    expect(out.skipped).toBe(1);
    expect(out.status).toBe("Created 2 rooms from DXF");
    expect(out.scene.rooms).toHaveLength(2);
    expect(out.scene.rooms[0]!.polygon).toEqual(CLOSED_4X3.points);
    expect(out.scene.rooms[1]!.polygon).toEqual(other.points);
  });
});


describe("officialAppendRoomsFromDxfClosedPolylines line loops", () => {
  it("creates one room from a 4-LINE rectangle", () => {
    const scene = sceneWithDxf(RECT_LINES);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(true);
    expect(out.created).toBe(1);
    expect(out.skipped).toBe(0);
    expect(out.status).toBe("Created 1 room from DXF");
    expect(out.scene.rooms).toHaveLength(1);
    expect(out.scene.rooms[0]!.polygon).toHaveLength(4);
    expect(out.scene.rooms[0]!.calc.maintenanceFactor).toBe(0.8);
    expect(out.scene.rooms[0]!.calc.en12464TemplateId).toBe("");
  });

  it("creates one room from a triangle of three LINEs", () => {
    const scene = sceneWithDxf([
      line(0, 0, 4, 0),
      line(4, 0, 0, 3),
      line(0, 3, 0, 0),
    ]);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    expect(out.scene.rooms[0]!.polygon).toHaveLength(3);
  });

  it("creates a room from an open LWPOLYLINE plus one closing LINE", () => {
    const open: DxfEntity = {
      type: "polyline",
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
        { x: 0, y: 3 },
      ],
    };
    const scene = sceneWithDxf([open, line(0, 3, 0, 0)]);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    expect(out.scene.rooms[0]!.polygon).toHaveLength(4);
  });

  it("maps line-loop rooms when metersPerUnit is not 1 and the origin is offset", () => {
    const scene = sceneWithDxf(RECT_LINES, { metersPerUnit: 2, offsetX: 1, offsetY: -3 });
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    const poly = out.scene.rooms[0]!.polygon;
    expect(poly).toHaveLength(4);
    const xs = poly.map((p) => p.x).sort((a, b) => a - b);
    const ys = poly.map((p) => p.y).sort((a, b) => a - b);
    expect(xs).toEqual([1, 1, 9, 9]);
    expect(ys).toEqual([-3, -3, 3, 3]);
  });

  it("creates no loop room from a T-junction / degree-3 vertex", () => {
    const scene = sceneWithDxf([
      line(0, 0, 4, 0),
      line(4, 0, 4, 1.5),
      line(4, 1.5, 4, 3),
      line(4, 3, 0, 3),
      line(0, 3, 0, 0),
      line(4, 1.5, 6, 1.5),
    ]);
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(false);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(0);
    expect(out.skipped).toBe(0);
    expect(out.scene).toBe(scene);
    expect(out.scene.rooms).toEqual([]);
    expect(out.status).toBe(DXF_CLOSED_ROOMS_NONE_STATUS);
  });

  it("creates no loop room from a figure-8 / degree-4 shared vertex", () => {
    const scene = sceneWithDxf([
      line(0, 0, 2, 0),
      line(2, 0, 2, 2),
      line(2, 2, 0, 2),
      line(0, 2, 0, 0),
      line(2, 2, 4, 2),
      line(4, 2, 4, 4),
      line(4, 4, 2, 4),
      line(2, 4, 2, 2),
    ]);
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(false);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(0);
    expect(out.scene.rooms).toEqual([]);
    expect(out.status).toBe(DXF_CLOSED_ROOMS_NONE_STATUS);
  });

  it("does not double-create a closed polyline that is also a line loop", () => {
    const scene = sceneWithDxf([CLOSED_4X3, ...RECT_LINES]);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    expect(out.skipped).toBe(1);
    expect(out.status).toBe("Created 1 room from DXF");
    expect(out.scene.rooms).toHaveLength(1);
    expect(out.scene.rooms[0]!.polygon).toEqual(CLOSED_4X3.points);
  });

  it("still skips existing closed-polyline outlines and keeps official defaults", () => {
    const other: DxfEntity[] = [
      line(10, 0, 12, 0),
      line(12, 0, 12, 2),
      line(12, 2, 10, 2),
      line(10, 2, 10, 0),
    ];
    const scene = sceneWithDxf([CLOSED_4X3, ...other]);
    const existing = officialNewRoom({
      id: "room-existing",
      storeyId: scene.ui.activeStoreyId,
      name: "Existing",
      polygon: rectPolygon(0, 0, 4, 3),
      heightM: 3,
    });
    existing.calc = {
      ...existing.calc,
      maintenanceFactor: 0.67,
      en12464TemplateId: "office",
    };
    scene.rooms = [existing];
    const before = structuredClone(existing);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    expect(out.skipped).toBe(1);
    expect(out.status).toBe("Created 1 room from DXF");
    const created = out.scene.rooms.find((room) => room.id === "room-dxf-1");
    expect(created).toBeDefined();
    expect(created!.calc.maintenanceFactor).toBe(0.8);
    expect(created!.calc.en12464TemplateId).toBe("");
    expect(created!.heightM).toBe(2.8);
    expect(out.scene.rooms[0]).toEqual(before);
    expect(scene.rooms).toEqual([before]);
  });

  it("creates nothing from only dangling open lines", () => {
    const scene = sceneWithDxf([OPEN_L, OPEN_LINE]);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(false);
    expect(out.created).toBe(0);
    expect(out.scene.rooms).toEqual([]);
    expect(out.status).toBe(DXF_CLOSED_ROOMS_NONE_STATUS);
  });
});

describe("official editor Create rooms from DXF wiring", () => {
  it("places the official command beside Create rectangle and uses official defaults", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/components/editor/BuildingEditor.tsx"),
      "utf8"
    );
    expect(src).toContain("officialAppendRoomsFromDxfClosedPolylines");
    expect(src).toContain("officialCanCreateRoomsFromDxf");
    expect(src).toContain("Create rooms from DXF");
    expect(src).toContain("function createRoomsFromDxf");
    expect(src).toContain("disabled={!officialCanCreateRoomsFromDxf(underlay)}");
    expect(src).toContain("resolveNewRoomHeightM()");
    const fnStart = src.indexOf("function createRoomsFromDxf");
    const unionStart = src.indexOf("function startUnionRooms");
    const uploadStart = src.indexOf("async function onUploadPhotometry");
    expect(fnStart).toBeGreaterThan(src.indexOf("function createRectRoom"));
    expect(unionStart).toBeGreaterThan(fnStart);
    expect(uploadStart).toBeGreaterThan(unionStart);
    const fn = src.slice(fnStart, unionStart);
    expect(fn).toContain("officialAppendRoomsFromDxfClosedPolylines");
    expect(fn).toContain("resolveNewRoomHeightM");
    expect(fn).not.toMatch(/activeRoom/);
    expect(fn).not.toMatch(/maintenanceFactor/);
    expect(fn).not.toMatch(/en12464TemplateId/);
    expect(fn).not.toMatch(/mfBreakdown/);
    expect(fn).not.toMatch(/appendOfficialNewRoom\(/);

    const top = readFileSync(
      path.join(process.cwd(), "src/components/editor/TopView2D.tsx"),
      "utf8"
    );
    const underlay3d = readFileSync(
      path.join(process.cwd(), "src/components/editor/PlanUnderlay3D.tsx"),
      "utf8"
    );
    expect(top).toContain("officialDxfPolylineStrokePoints");
    expect(underlay3d).toContain("officialDxfPolylineStrokePoints");
  });
});
