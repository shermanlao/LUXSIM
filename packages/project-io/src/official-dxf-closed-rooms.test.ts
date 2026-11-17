import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { defaultSceneV2 } from "./migrate";
import { officialImportedUnderlay } from "./underlay";
import { officialNewRoom } from "./new-room-defaults";
import { rectPolygon, roomAreaM2 } from "./geometry";
import { DEFAULT_NEW_ROOM_HEIGHT_M } from "./official-room-height";
import type { DxfEntity, ProjectSceneV2, RoomV2 } from "./types";
import { parseDxfEntities, DXF_CURVE_SEGMENTS_PER_TURN } from "./dxf";
import { officialDxfHasSimpleLineLoop } from "./official-dxf-line-loops";
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
        { x: 20, y: 20 },
        { x: 20.05, y: 20 },
        { x: 20.05, y: 20.05 },
        { x: 20, y: 20.05 },
      ],
    };
    // 0.05 * 0.05 = 0.0025 m² < 0.01
    expect(DXF_CLOSED_ROOM_MIN_AREA_M2).toBe(0.01);
    const twoPoints: DxfEntity = {
      type: "polyline",
      closed: true,
      points: [
        { x: 30, y: 20 },
        { x: 35, y: 20 },
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

  it("creates one room from a rectangle with an exterior dangling T-junction", () => {
    const scene = sceneWithDxf([
      line(0, 0, 4, 0),
      line(4, 0, 4, 1.5),
      line(4, 1.5, 4, 3),
      line(4, 3, 0, 3),
      line(0, 3, 0, 0),
      line(4, 1.5, 6, 1.5),
    ]);
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(true);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    expect(out.status).toBe("Created 1 room from DXF");
    expect(out.scene.rooms).toHaveLength(1);
    expect(roomAreaM2(out.scene.rooms[0]!)).toBe(12);
  });

  it("creates two rooms from a figure-8 / degree-4 shared vertex", () => {
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
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(true);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(2);
    expect(out.status).toBe("Created 2 rooms from DXF");
    expect(out.scene.rooms).toHaveLength(2);
    const areas = out.scene.rooms.map((room) => roomAreaM2(room)).sort((a, b) => a - b);
    expect(areas).toEqual([4, 4]);
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


describe("officialAppendRoomsFromDxfClosedPolylines wall networks", () => {
  it("creates two rooms from two rectangles that share a wall, not a union", () => {
    const scene = sceneWithDxf([
      ...RECT_LINES,
      line(4, 0, 8, 0),
      line(8, 0, 8, 3),
      line(8, 3, 4, 3),
      line(4, 3, 4, 0),
    ]);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(2);
    expect(out.status).toBe("Created 2 rooms from DXF");
    expect(out.scene.rooms).toHaveLength(2);
    const areas = out.scene.rooms.map((room) => roomAreaM2(room)).sort((a, b) => a - b);
    expect(areas).toEqual([12, 12]);
    expect(out.scene.rooms.every((room) => room.calc.maintenanceFactor === 0.8)).toBe(true);
    expect(out.scene.rooms.every((room) => room.calc.en12464TemplateId === "")).toBe(true);
  });

  it("splits a T-junction mid-segment wall into two rooms", () => {
    const tee = [
      line(0, 0, 10, 0),
      line(10, 0, 10, 4),
      line(10, 4, 0, 4),
      line(0, 4, 0, 0),
      line(0, 2, 4, 2),
      line(4, 2, 4, 0),
    ];
    const scene = sceneWithDxf(tee);
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(true);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(2);
    expect(out.status).toBe("Created 2 rooms from DXF");
    const areas = out.scene.rooms.map((room) => roomAreaM2(room)).sort((a, b) => a - b);
    expect(areas).toEqual([8, 32]);
  });

  it("creates three rooms from a corridor T-junction network", () => {
    const scene = sceneWithDxf([
      line(0, 2, 4, 2),
      line(4, 2, 4, 6),
      line(4, 6, 0, 6),
      line(0, 6, 0, 2),
      line(6, 2, 10, 2),
      line(10, 2, 10, 6),
      line(10, 6, 6, 6),
      line(6, 6, 6, 2),
      line(4, 0, 6, 0),
      line(6, 0, 6, 2),
      line(4, 2, 4, 0),
      line(4, 6, 6, 6),
    ]);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(3);
    expect(out.status).toBe("Created 3 rooms from DXF");
    const areas = out.scene.rooms.map((room) => roomAreaM2(room)).sort((a, b) => a - b);
    expect(areas).toEqual([12, 16, 16]);
  });

  it("creates only the face rooms from a closed polyline with an interior T-wall", () => {
    const closed: DxfEntity = {
      type: "polyline",
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 4 },
        { x: 0, y: 4 },
      ],
    };
    const scene = sceneWithDxf([closed, line(4, 0, 4, 4)]);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(2);
    const areas = out.scene.rooms.map((room) => roomAreaM2(room)).sort((a, b) => a - b);
    expect(areas).toEqual([16, 16]);
    expect(out.scene.rooms.some((room) => roomAreaM2(room) === 32)).toBe(false);
  });

  it("keeps the inner of two nested disjoint rectangles and does not create the overlapping outer", () => {
    const outer: DxfEntity = {
      type: "polyline",
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    };
    const inner: DxfEntity = {
      type: "polyline",
      closed: true,
      points: [
        { x: 3, y: 3 },
        { x: 7, y: 3 },
        { x: 7, y: 7 },
        { x: 3, y: 7 },
      ],
    };
    const scene = sceneWithDxf([outer, inner]);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    expect(out.status).toBe("Created 1 room from DXF");
    expect(out.scene.rooms).toHaveLength(1);
    expect(roomAreaM2(out.scene.rooms[0]!)).toBe(16);
  });

  it("enables the command when only a T-junction network exists", () => {
    const tee = [
      line(0, 2, 4, 2),
      line(4, 2, 4, 6),
      line(4, 6, 0, 6),
      line(0, 6, 0, 2),
      line(6, 2, 10, 2),
      line(10, 2, 10, 6),
      line(10, 6, 6, 6),
      line(6, 6, 6, 2),
      line(4, 0, 6, 0),
      line(6, 0, 6, 2),
      line(4, 2, 4, 0),
      line(4, 6, 6, 6),
    ];
    const scene = sceneWithDxf(tee);
    expect(tee.every((entity) => entity.type === "line" && entity.closed !== true)).toBe(true);
    expect(officialDxfHasSimpleLineLoop(tee)).toBe(false);
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(true);
  });

  it("maps T-junction network rooms when metersPerUnit is not 1 and the origin is offset", () => {
    const tee = [
      line(0, 0, 10, 0),
      line(10, 0, 10, 4),
      line(10, 4, 0, 4),
      line(0, 4, 0, 0),
      line(0, 2, 4, 2),
      line(4, 2, 4, 0),
    ];
    const scene = sceneWithDxf(tee, { metersPerUnit: 2, offsetX: 1, offsetY: -3 });
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(2);
    const areas = out.scene.rooms.map((room) => roomAreaM2(room)).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(32, 6);
    expect(areas[1]).toBeCloseTo(128, 6);
  });

  it("skips a network face that already exists on the storey and does not rewrite it", () => {
    const scene = sceneWithDxf([
      ...RECT_LINES,
      line(4, 0, 8, 0),
      line(8, 0, 8, 3),
      line(8, 3, 4, 3),
    ]);
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
    expect(out.status).toBe("Created 1 room from DXF");
    const created = out.scene.rooms.find((room) => room.id === "room-dxf-1");
    expect(created).toBeDefined();
    expect(roomAreaM2(created!)).toBe(12);
    expect(created!.calc.maintenanceFactor).toBe(0.8);
    expect(created!.calc.en12464TemplateId).toBe("");
    expect(out.scene.rooms[0]).toEqual(before);
    expect(scene.rooms).toEqual([before]);
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

function dxfFile(body: string): string {
  return "  0\nSECTION\n  2\nENTITIES\n" + body + "  0\nENDSEC\n  0\nEOF\n";
}

describe("officialAppendRoomsFromDxfClosedPolylines CIRCLE, ARC, and old POLYLINE", () => {
  it("creates a room from a circular DXF entity", () => {
    const entities = parseDxfEntities(
      dxfFile("  0\nCIRCLE\n  10\n0\n  20\n0\n  40\n2\n")
    );
    expect(entities[0]?.closed).toBe(true);
    expect(entities[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    const scene = sceneWithDxf(entities);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    expect(out.status).toBe("Created 1 room from DXF");
    const created = out.scene.rooms[0]!;
    expect(created.polygon).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    expect(created.calc.maintenanceFactor).toBe(0.8);
    const expectedArea =
      0.5 * DXF_CURVE_SEGMENTS_PER_TURN * 2 * 2 * Math.sin((2 * Math.PI) / DXF_CURVE_SEGMENTS_PER_TURN);
    expect(roomAreaM2(created)).toBeCloseTo(expectedArea, 6);
    expect(roomAreaM2(created)).toBeGreaterThan(DXF_CLOSED_ROOM_MIN_AREA_M2);
  });

  it("creates a room from a closed old POLYLINE", () => {
    const entities = parseDxfEntities(
      dxfFile(
        "  0\nPOLYLINE\n  70\n1\n" +
          "  0\nVERTEX\n  10\n0\n  20\n0\n" +
          "  0\nVERTEX\n  10\n4\n  20\n0\n" +
          "  0\nVERTEX\n  10\n4\n  20\n3\n" +
          "  0\nVERTEX\n  10\n0\n  20\n3\n" +
          "  0\nSEQEND\n"
      )
    );
    const scene = sceneWithDxf(entities);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    expect(out.scene.rooms[0]!.polygon).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ]);
    expect(roomAreaM2(out.scene.rooms[0]!)).toBe(12);
  });

  it("creates a room from an ARC plus closing LINEs", () => {
    // Semicircle from (2,0) to (-2,0) CCW (through (0,2)) and a diameter LINE.
    const entities = parseDxfEntities(
      dxfFile(
        "  0\nARC\n  10\n0\n  20\n0\n  40\n2\n  50\n0\n  51\n180\n" +
          "  0\nLINE\n  10\n-2\n  20\n0\n  11\n2\n  21\n0\n"
      )
    );
    expect(entities).toHaveLength(2);
    expect(entities[0]?.closed).toBeUndefined();
    const scene = sceneWithDxf(entities);
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(true);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    const created = out.scene.rooms[0]!;
    // 24 arc segments + the diameter: 25 unique ring vertices? 
    // Arc has 25 points from (2,0) to (-2,0); LINE reconnects. Ring should drop the shared ends once.
    expect(created.polygon.length).toBeGreaterThanOrEqual(24);
    const expected =
      0.5 * 24 * 2 * 2 * Math.sin(Math.PI / 24); // polygonal semicircle area
    expect(roomAreaM2(created)).toBeCloseTo(expected, 5);
  });

  it("creates rooms from a T-junction whose outer side is an ARC", () => {
    // 10×4 box with a right-side semicircle bulge and a 4×2 T partition.
    const entities = parseDxfEntities(
      dxfFile(
        "  0\nLINE\n  10\n0\n  20\n0\n  11\n10\n  21\n0\n" +
          "  0\nARC\n  10\n10\n  20\n2\n  40\n2\n  50\n270\n  51\n90\n" +
          "  0\nLINE\n  10\n10\n  20\n4\n  11\n0\n  21\n4\n" +
          "  0\nLINE\n  10\n0\n  20\n4\n  11\n0\n  21\n0\n" +
          "  0\nLINE\n  10\n0\n  20\n2\n  11\n4\n  21\n2\n" +
          "  0\nLINE\n  10\n4\n  20\n2\n  11\n4\n  21\n0\n"
      )
    );
    const scene = sceneWithDxf(entities);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(2);
    const areas = out.scene.rooms.map((room) => roomAreaM2(room)).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(8, 6);
    const semicircle =
      0.5 * 24 * 2 * 2 * Math.sin(Math.PI / 24);
    expect(areas[1]).toBeCloseTo(32 + semicircle, 5);
  });

  it("refuses a very tiny CIRCLE below the official minimum room area", () => {
    // r = 0.05 → true area ≈ 0.00785 m² < 0.01; the 48-gon is slightly smaller.
    const entities = parseDxfEntities(
      dxfFile("  0\nCIRCLE\n  10\n20\n  20\n20\n  40\n0.05\n")
    );
    expect(entities[0]?.closed).toBe(true);
    const polyArea =
      0.5 *
      DXF_CURVE_SEGMENTS_PER_TURN *
      0.05 *
      0.05 *
      Math.sin((2 * Math.PI) / DXF_CURVE_SEGMENTS_PER_TURN);
    expect(polyArea).toBeLessThan(DXF_CLOSED_ROOM_MIN_AREA_M2);
    const scene = sceneWithDxf(entities);
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(true);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(0);
    expect(out.scene.rooms).toEqual([]);
    expect(out.status).toBe(DXF_CLOSED_ROOMS_NONE_STATUS);
  });
});

describe("officialAppendRoomsFromDxfClosedPolylines LWPOLYLINE bulges", () => {
  it("creates a room from an open LWPOLYLINE bulge plus a closing LINE", () => {
    const entities = parseDxfEntities(
      dxfFile(
        "  0\nLWPOLYLINE\n  70\n0\n  90\n2\n" +
          "  10\n2\n  20\n0\n  42\n1\n" +
          "  10\n-2\n  20\n0\n" +
          "  0\nLINE\n  10\n-2\n  20\n0\n  11\n2\n  21\n0\n"
      )
    );
    expect(entities).toHaveLength(2);
    expect(entities[0]?.closed).toBeUndefined();
    expect(entities[0]?.points.length).toBe(25);
    const scene = sceneWithDxf(entities);
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(true);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    const created = out.scene.rooms[0]!;
    expect(created.polygon.length).toBeGreaterThanOrEqual(24);
    const expected = 0.5 * 24 * 2 * 2 * Math.sin(Math.PI / 24);
    expect(roomAreaM2(created)).toBeCloseTo(expected, 5);
  });

  it("creates one official room from a closed two-bulge capsule LWPOLYLINE", () => {
    // 4×2 rectangle with semicircular caps of radius 1 on the short sides.
    const entities = parseDxfEntities(
      dxfFile(
        "  0\nLWPOLYLINE\n  70\n1\n  90\n4\n" +
          "  10\n0\n  20\n0\n" +
          "  10\n4\n  20\n0\n  42\n1\n" +
          "  10\n4\n  20\n2\n" +
          "  10\n0\n  20\n2\n  42\n1\n"
      )
    );
    expect(entities).toHaveLength(1);
    expect(entities[0]?.closed).toBe(true);
    expect(entities[0]?.points.length).toBeGreaterThan(4);
    const scene = sceneWithDxf(entities);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    const created = out.scene.rooms[0]!;
    expect(created.polygon.length).toBeGreaterThan(4);
    const caps = 24 * Math.sin(Math.PI / 24);
    expect(roomAreaM2(created)).toBeCloseTo(8 + caps, 5);
  });
});

describe("officialAppendRoomsFromDxfClosedPolylines ELLIPSE", () => {
  it("creates a room from a closed axis-aligned ELLIPSE", () => {
    const entities = parseDxfEntities(
      dxfFile(
        "  0\nELLIPSE\n  10\n0\n  20\n0\n  11\n2\n  21\n0\n  40\n0.5\n  41\n0\n  42\n" +
          `${Math.PI * 2}\n`
      )
    );
    expect(entities[0]?.closed).toBe(true);
    expect(entities[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    const scene = sceneWithDxf(entities);
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(true);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    expect(out.status).toBe("Created 1 room from DXF");
    const created = out.scene.rooms[0]!;
    expect(created.polygon).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    const expectedArea =
      0.5 *
      DXF_CURVE_SEGMENTS_PER_TURN *
      2 *
      1 *
      Math.sin((2 * Math.PI) / DXF_CURVE_SEGMENTS_PER_TURN);
    expect(roomAreaM2(created)).toBeCloseTo(expectedArea, 6);
    expect(roomAreaM2(created)).toBeGreaterThan(DXF_CLOSED_ROOM_MIN_AREA_M2);
  });

  it("creates a room from an open elliptical arc plus a closing LINE", () => {
    const entities = parseDxfEntities(
      dxfFile(
        "  0\nELLIPSE\n  10\n0\n  20\n0\n  11\n2\n  21\n0\n  40\n0.5\n  41\n0\n  42\n" +
          `${Math.PI}\n` +
          "  0\nLINE\n  10\n-2\n  20\n0\n  11\n2\n  21\n0\n"
      )
    );
    expect(entities).toHaveLength(2);
    expect(entities[0]?.closed).toBeUndefined();
    expect(entities[0]?.points).toHaveLength(25);
    const scene = sceneWithDxf(entities);
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(true);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    const created = out.scene.rooms[0]!;
    expect(created.polygon.length).toBeGreaterThanOrEqual(24);
    const expected = 24 * Math.sin(Math.PI / 24);
    expect(roomAreaM2(created)).toBeCloseTo(expected, 5);
  });

  it("does not invent a room from an open elliptical arc alone, or from an empty DXF", () => {
    const open = parseDxfEntities(
      dxfFile(
        "  0\nELLIPSE\n  10\n0\n  20\n0\n  11\n2\n  21\n0\n  40\n0.5\n  41\n0\n  42\n" +
          `${Math.PI / 2}\n`
      )
    );
    expect(open).toHaveLength(1);
    expect(open[0]?.closed).toBeUndefined();
    const openScene = sceneWithDxf(open);
    const openOut = officialAppendRoomsFromDxfClosedPolylines(openScene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(openOut.created).toBe(0);
    expect(openOut.scene.rooms).toEqual([]);
    expect(openOut.status).toBe(DXF_CLOSED_ROOMS_NONE_STATUS);

    expect(parseDxfEntities("")).toEqual([]);
    expect(parseDxfEntities(dxfFile(""))).toEqual([]);
    const emptyScene = sceneWithDxf(parseDxfEntities(dxfFile("")));
    expect(officialCanCreateRoomsFromDxf(emptyScene.underlays[0])).toBe(false);
    const emptyOut = officialAppendRoomsFromDxfClosedPolylines(emptyScene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(emptyOut.created).toBe(0);
    expect(emptyOut.scene.rooms).toEqual([]);
    expect(emptyOut.status).toBe(DXF_CLOSED_ROOMS_NONE_STATUS);
  });
});

function splineEnt(opts: {
  flags?: number;
  degree: number;
  knots: number[];
  points: Array<{ x: number; y: number }>;
  weights?: number[];
}): string {
  const flags = opts.flags ?? 0;
  let s =
    `  0\nSPLINE\n  70\n${flags}\n  71\n${opts.degree}\n` +
    `  72\n${opts.knots.length}\n  73\n${opts.points.length}\n`;
  for (const k of opts.knots) s += `  40\n${k}\n`;
  if (opts.weights) {
    for (const w of opts.weights) s += `  41\n${w}\n`;
  }
  for (const pt of opts.points) s += `  10\n${pt.x}\n  20\n${pt.y}\n`;
  return s;
}

describe("officialAppendRoomsFromDxfClosedPolylines SPLINE", () => {
  const circleW = Math.SQRT1_2;
  const circlePts = [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 0 },
  ];
  const circleKnots = [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4];
  const circleWeights = [1, circleW, 1, circleW, 1, circleW, 1, circleW, 1];

  it("creates a room from a closed rational quadratic SPLINE circle", () => {
    const entities = parseDxfEntities(
      dxfFile(
        splineEnt({
          flags: 1 | 4,
          degree: 2,
          knots: circleKnots,
          points: circlePts,
          weights: circleWeights,
        })
      )
    );
    expect(entities[0]?.closed).toBe(true);
    expect(entities[0]?.points).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    const scene = sceneWithDxf(entities);
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(true);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    expect(out.status).toBe("Created 1 room from DXF");
    const created = out.scene.rooms[0]!;
    expect(created.polygon).toHaveLength(DXF_CURVE_SEGMENTS_PER_TURN);
    expect(roomAreaM2(created)).toBeGreaterThan(DXF_CLOSED_ROOM_MIN_AREA_M2);
    // On the unit circle, a 48-gon area is a little under π.
    expect(roomAreaM2(created)).toBeGreaterThan(3);
    expect(roomAreaM2(created)).toBeLessThan(Math.PI + 1e-6);
  });

  it("creates a room from a periodic closed SPLINE", () => {
    const entities = parseDxfEntities(
      dxfFile(
        splineEnt({
          flags: 1 | 2,
          degree: 2,
          knots: [0, 1, 2, 3, 4],
          points: [
            { x: 3, y: 3 },
            { x: -3, y: 3 },
            { x: -3, y: -3 },
            { x: 3, y: -3 },
          ],
        })
      )
    );
    expect(entities[0]?.closed).toBe(true);
    const scene = sceneWithDxf(entities);
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(true);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    expect(out.scene.rooms[0]!.polygon.length).toBeGreaterThanOrEqual(3);
    expect(roomAreaM2(out.scene.rooms[0]!)).toBeGreaterThan(DXF_CLOSED_ROOM_MIN_AREA_M2);
  });

  it("creates a room from an open SPLINE plus a closing LINE", () => {
    const w = Math.SQRT1_2;
    const entities = parseDxfEntities(
      dxfFile(
        splineEnt({
          flags: 4,
          degree: 2,
          knots: [0, 0, 0, 1, 1, 1],
          points: [
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ],
          weights: [1, w, 1],
        }) + "  0\nLINE\n  10\n0\n  20\n1\n  11\n1\n  21\n0\n"
      )
    );
    expect(entities).toHaveLength(2);
    expect(entities[0]?.closed).toBeUndefined();
    const scene = sceneWithDxf(entities);
    expect(officialCanCreateRoomsFromDxf(scene.underlays[0])).toBe(true);
    const out = officialAppendRoomsFromDxfClosedPolylines(scene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(out.created).toBe(1);
    const created = out.scene.rooms[0]!;
    expect(created.polygon.length).toBeGreaterThanOrEqual(3);
    expect(roomAreaM2(created)).toBeGreaterThan(DXF_CLOSED_ROOM_MIN_AREA_M2);
  });

  it("does not invent a room from an open SPLINE alone, or from an empty DXF", () => {
    const open = parseDxfEntities(
      dxfFile(
        splineEnt({
          degree: 3,
          knots: [0, 0, 0, 0, 1, 1, 1, 1],
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 2 },
            { x: 3, y: 2 },
            { x: 4, y: 0 },
          ],
        })
      )
    );
    expect(open).toHaveLength(1);
    expect(open[0]?.closed).toBeUndefined();
    const openScene = sceneWithDxf(open);
    const openOut = officialAppendRoomsFromDxfClosedPolylines(openScene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(openOut.created).toBe(0);
    expect(openOut.scene.rooms).toEqual([]);
    expect(openOut.status).toBe(DXF_CLOSED_ROOMS_NONE_STATUS);

    expect(parseDxfEntities("")).toEqual([]);
    expect(parseDxfEntities(dxfFile(""))).toEqual([]);
    const emptyScene = sceneWithDxf(parseDxfEntities(dxfFile("")));
    expect(officialCanCreateRoomsFromDxf(emptyScene.underlays[0])).toBe(false);
    const emptyOut = officialAppendRoomsFromDxfClosedPolylines(emptyScene, {
      heightM: 2.8,
      nextId: ids().nextId,
    });
    expect(emptyOut.created).toBe(0);
    expect(emptyOut.scene.rooms).toEqual([]);
    expect(emptyOut.status).toBe(DXF_CLOSED_ROOMS_NONE_STATUS);
  });
});
