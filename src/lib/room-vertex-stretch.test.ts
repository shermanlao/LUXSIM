import { describe, expect, it, vi } from "vitest";
import { rectPolygon } from "@luxsim/project-io";
import {
  DXF_OBJECT_SNAP_CSS_PX,
  dxfObjectSnapRadiusM,
} from "@/lib/official-dxf-object-snap";
import { shouldBeginRoomDrag } from "@/lib/room-drag";
import {
  VERTEX_HANDLE_CSS_PX,
  hitRoomEdgeInsert,
  hitRoomOutlineEdit,
  hitRoomVertexHandle,
  officialVertexDeleteKeyAction,
  resolveVertexDeleteTarget,
  roomEdgeInsertAffordances,
  shouldBeginEdgeInsert,
  shouldBeginVertexStretch,
  vertexHandleRadiusM,
} from "@/lib/room-vertex-stretch";
import type { Vec2 } from "@luxsim/project-io";

const ready = {
  tool: "select" as const,
  drawing: false,
  calibrating: false,
  linePickActive: false,
  circlePickActive: false,
  polygonPickActive: false,
};

const RECT = rectPolygon(0, 0, 5, 4);

const L_POLYGON: Vec2[] = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 4 },
  { x: 4, y: 4 },
  { x: 4, y: 8 },
  { x: 0, y: 8 },
];

describe("vertex handle hit testing", () => {
  it("uses the official 8 CSS pixel snap aperture in world metres", () => {
    expect(VERTEX_HANDLE_CSS_PX).toBe(8);
    expect(VERTEX_HANDLE_CSS_PX).toBe(DXF_OBJECT_SNAP_CSS_PX);
    expect(vertexHandleRadiusM(0.01)).toBeCloseTo(0.08);
    expect(vertexHandleRadiusM(0.01)).toBe(dxfObjectSnapRadiusM(0.01));
    expect(vertexHandleRadiusM(0)).toBe(0);
    expect(vertexHandleRadiusM(-1)).toBe(0);
  });

  it("hits a corner within the aperture and misses the room interior", () => {
    const radiusM = vertexHandleRadiusM(0.01);
    expect(hitRoomVertexHandle({ x: 0.05, y: -0.02 }, RECT, radiusM)).toBe(0);
    expect(hitRoomVertexHandle({ x: 5, y: 4 }, RECT, radiusM)).toBe(2);
    expect(hitRoomVertexHandle({ x: 2.5, y: 2 }, RECT, radiusM)).toBeNull();
    expect(hitRoomVertexHandle({ x: 0.2, y: 0 }, RECT, radiusM)).toBeNull();
  });

  it("does not treat a closing duplicate as a second handle", () => {
    const closed = [...RECT, { x: 0, y: 0 }];
    expect(hitRoomVertexHandle({ x: 0, y: 0 }, closed, 0.08)).toBe(0);
  });
});

describe("shouldBeginVertexStretch vs whole-room drag", () => {
  it("starts only with Select, a handle hit, and a set-polygon handler", () => {
    const onSetRoomPolygon = vi.fn();
    const onMoveRoom = vi.fn();
    expect(
      shouldBeginVertexStretch({ ...ready, onSetRoomPolygon, handleIndex: 0 })
    ).toBe(true);
    expect(shouldBeginVertexStretch({ ...ready, onSetRoomPolygon })).toBe(false);
    expect(shouldBeginVertexStretch({ ...ready, handleIndex: 0 })).toBe(false);
    expect(
      shouldBeginVertexStretch({ ...ready, onSetRoomPolygon, handleIndex: 0, tool: "drawRoom" })
    ).toBe(false);
    expect(
      shouldBeginVertexStretch({ ...ready, onSetRoomPolygon, handleIndex: 0, drawing: true })
    ).toBe(false);
    expect(
      shouldBeginVertexStretch({
        ...ready,
        onSetRoomPolygon,
        handleIndex: 0,
        polygonPickActive: true,
      })
    ).toBe(false);
    expect(
      shouldBeginVertexStretch({
        ...ready,
        onSetRoomPolygon,
        handleIndex: 0,
        unionPickActive: true,
      })
    ).toBe(false);
    expect(
      shouldBeginVertexStretch({
        ...ready,
        onSetRoomPolygon,
        handleIndex: 0,
        filletPickActive: true,
      })
    ).toBe(false);
    expect(shouldBeginRoomDrag({ ...ready, onMoveRoom })).toBe(false);
  });

  it("does not start a whole-room drag from a handle hit", () => {
    const onSetRoomPolygon = vi.fn();
    const onMoveRoom = vi.fn();
    const handleIndex = hitRoomVertexHandle({ x: 0, y: 0 }, RECT, 0.08);
    expect(handleIndex).toBe(0);
    expect(shouldBeginVertexStretch({ ...ready, onSetRoomPolygon, handleIndex })).toBe(true);
    const interior = hitRoomVertexHandle({ x: 2.5, y: 2 }, RECT, 0.08);
    expect(interior).toBeNull();
    expect(shouldBeginVertexStretch({ ...ready, onSetRoomPolygon, handleIndex: interior })).toBe(
      false
    );
    expect(shouldBeginRoomDrag({ ...ready, onMoveRoom })).toBe(false);
  });
});

describe("mid-edge insert hit testing and priority", () => {
  const radiusM = vertexHandleRadiusM(0.01); // 0.08 m

  it("hits a rectangle edge and an L-shaped closing edge within the 8 CSS px aperture", () => {
    expect(hitRoomEdgeInsert({ x: 2.5, y: 0 }, RECT, radiusM)).toEqual({
      edgeIndex: 0,
      point: { x: 2.5, y: 0 },
    });
    expect(hitRoomEdgeInsert({ x: 2.5, y: -0.05 }, RECT, radiusM)?.edgeIndex).toBe(0);
    expect(hitRoomEdgeInsert({ x: 2.5, y: -0.05 }, RECT, radiusM)?.point).toEqual({ x: 2.5, y: 0 });
    const closing = hitRoomEdgeInsert({ x: 0, y: 4 }, L_POLYGON, radiusM);
    expect(closing).toEqual({ edgeIndex: 5, point: { x: 0, y: 4 } });
    expect(roomEdgeInsertAffordances(RECT, radiusM)).toHaveLength(4);
    expect(roomEdgeInsertAffordances([...RECT, { x: 0, y: 0 }], radiusM)).toHaveLength(4);
  });

  it("does not insert on a point coincident with an endpoint, or steal a corner", () => {
    expect(hitRoomEdgeInsert({ x: 0, y: 0 }, RECT, radiusM)).toBeNull();
    expect(hitRoomEdgeInsert({ x: 0.05, y: 0 }, RECT, radiusM)).toBeNull();
    expect(hitRoomVertexHandle({ x: 0.05, y: 0 }, RECT, radiusM)).toBe(0);
    expect(hitRoomEdgeInsert({ x: 0.2, y: 0 }, RECT, 0.08)).toEqual({
      edgeIndex: 0,
      point: { x: 0.2, y: 0 },
    });
    const short = rectPolygon(0, 0, 0.1, 4);
    expect(hitRoomEdgeInsert({ x: 0.05, y: 0 }, short, radiusM)).toBeNull();
  });

  it("lets a corner handle win over mid-edge, and mid-edge win over whole-room drag", () => {
    const onSetRoomPolygon = vi.fn();
    const onMoveRoom = vi.fn();
    const nearCorner = hitRoomOutlineEdit({ x: 0.04, y: -0.02 }, RECT, radiusM);
    expect(nearCorner).toEqual({ kind: "vertex", index: 0 });
    const midEdge = hitRoomOutlineEdit({ x: 2.5, y: 0.02 }, RECT, radiusM);
    expect(midEdge).toEqual({ kind: "edge-insert", edgeIndex: 0, point: { x: 2.5, y: 0 } });
    const interior = hitRoomOutlineEdit({ x: 2.5, y: 2 }, RECT, radiusM);
    expect(interior).toBeNull();

    expect(
      shouldBeginVertexStretch({ ...ready, onSetRoomPolygon, handleIndex: 0 })
    ).toBe(true);
    expect(
      shouldBeginEdgeInsert({ ...ready, onSetRoomPolygon, edgeIndex: midEdge && midEdge.kind === "edge-insert" ? midEdge.edgeIndex : null })
    ).toBe(true);
    expect(shouldBeginEdgeInsert({ ...ready, onSetRoomPolygon })).toBe(false);
    expect(shouldBeginEdgeInsert({ ...ready, edgeIndex: 0 })).toBe(false);
    expect(
      shouldBeginEdgeInsert({ ...ready, onSetRoomPolygon, edgeIndex: 0, tool: "drawRoom" })
    ).toBe(false);
    expect(
      shouldBeginEdgeInsert({ ...ready, onSetRoomPolygon, edgeIndex: 0, drawing: true })
    ).toBe(false);
    expect(
      shouldBeginEdgeInsert({
        ...ready,
        onSetRoomPolygon,
        edgeIndex: 0,
        polygonPickActive: true,
      })
    ).toBe(false);
    expect(
      shouldBeginEdgeInsert({
        ...ready,
        onSetRoomPolygon,
        edgeIndex: 0,
        unionPickActive: true,
      })
    ).toBe(false);
    expect(
      shouldBeginEdgeInsert({
        ...ready,
        onSetRoomPolygon,
        edgeIndex: 0,
        filletPickActive: true,
      })
    ).toBe(false);
    expect(shouldBeginRoomDrag({ ...ready, onMoveRoom })).toBe(false);
    expect(shouldBeginVertexStretch({ ...ready, onSetRoomPolygon, handleIndex: null })).toBe(
      false
    );
  });
});

describe("official vertex delete target and keys", () => {
  const radiusM = vertexHandleRadiusM(0.01);

  it("prefers a hovered corner handle, then a click-selected active vertex, and never a mid-edge hit", () => {
    expect(
      resolveVertexDeleteTarget({ pointer: { x: 0.05, y: -0.02 }, polygon: RECT, radiusM })
    ).toBe(0);
    expect(
      resolveVertexDeleteTarget({
        pointer: { x: 2.5, y: 2 },
        polygon: RECT,
        radiusM,
        activeVertexIndex: 2,
      })
    ).toBe(2);
    expect(
      resolveVertexDeleteTarget({
        pointer: { x: 2.5, y: 0 },
        polygon: RECT,
        radiusM,
        activeVertexIndex: 1,
      })
    ).toBe(1);
    expect(hitRoomEdgeInsert({ x: 2.5, y: 0 }, RECT, radiusM)?.edgeIndex).toBe(0);
    expect(
      resolveVertexDeleteTarget({ pointer: { x: 2.5, y: 2 }, polygon: RECT, radiusM })
    ).toBeNull();
    expect(
      resolveVertexDeleteTarget({
        pointer: { x: 2.5, y: 2 },
        polygon: RECT,
        radiusM,
        activeVertexIndex: 9,
      })
    ).toBeNull();
    expect(
      resolveVertexDeleteTarget({ pointer: null, polygon: RECT, radiusM, activeVertexIndex: 3 })
    ).toBe(3);
  });

  it("uses Delete, or Backspace only when Select is idle and no draw-room draft is active", () => {
    expect(
      officialVertexDeleteKeyAction({ key: "Delete", tool: "select", drawing: false })
    ).toBe("delete");
    expect(
      officialVertexDeleteKeyAction({ key: "Backspace", tool: "select", drawing: false })
    ).toBe("delete");
    expect(
      officialVertexDeleteKeyAction({ key: "Backspace", tool: "select", drawing: true })
    ).toBe("pass");
    expect(
      officialVertexDeleteKeyAction({ key: "Delete", tool: "select", drawing: true })
    ).toBe("pass");
    expect(
      officialVertexDeleteKeyAction({ key: "Backspace", tool: "drawRoom", drawing: true })
    ).toBe("pass");
    expect(
      officialVertexDeleteKeyAction({ key: "Delete", tool: "select", drawing: false, calibrating: true })
    ).toBe("pass");
    expect(
      officialVertexDeleteKeyAction({
        key: "Delete",
        tool: "select",
        drawing: false,
        polygonPickActive: true,
      })
    ).toBe("pass");
    expect(
      officialVertexDeleteKeyAction({
        key: "Delete",
        tool: "select",
        drawing: false,
        unionPickActive: true,
      })
    ).toBe("pass");
    expect(
      officialVertexDeleteKeyAction({
        key: "Delete",
        tool: "select",
        drawing: false,
        filletPickActive: true,
      })
    ).toBe("pass");
    expect(
      officialVertexDeleteKeyAction({ key: "Delete", tool: "select", drawing: false, stretching: true })
    ).toBe("pass");
    expect(
      officialVertexDeleteKeyAction({ key: "Enter", tool: "select", drawing: false })
    ).toBe("pass");
    expect(officialVertexDeleteKeyAction({ key: "Delete", drawing: false })).toBe("pass");
  });
});
