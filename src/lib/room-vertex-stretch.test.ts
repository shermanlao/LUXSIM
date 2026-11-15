import { describe, expect, it, vi } from "vitest";
import { rectPolygon } from "@luxsim/project-io";
import {
  DXF_OBJECT_SNAP_CSS_PX,
  dxfObjectSnapRadiusM,
} from "@/lib/official-dxf-object-snap";
import { shouldBeginRoomDrag } from "@/lib/room-drag";
import {
  VERTEX_HANDLE_CSS_PX,
  hitRoomVertexHandle,
  shouldBeginVertexStretch,
  vertexHandleRadiusM,
} from "@/lib/room-vertex-stretch";

const ready = {
  tool: "select" as const,
  drawing: false,
  calibrating: false,
  linePickActive: false,
  circlePickActive: false,
  polygonPickActive: false,
};

const RECT = rectPolygon(0, 0, 5, 4);

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
    expect(shouldBeginRoomDrag({ ...ready, onMoveRoom })).toBe(true);
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
    expect(shouldBeginRoomDrag({ ...ready, onMoveRoom })).toBe(true);
  });
});
