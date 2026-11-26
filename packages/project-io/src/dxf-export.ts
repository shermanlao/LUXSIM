import type { FixtureInstance, RoomV2, Storey, Vec2 } from "./types";

/** Minimal ASCII DXF for walls, fixtures, and calc grid points (metres). */
export function buildVerificationDxf(opts: {
  storeys: Storey[];
  rooms: RoomV2[];
  instances: FixtureInstance[];
  /** World-space measure points (e.g. calc grid centres) */
  measurePoints: { x: number; y: number; z: number; lux: number; roomId: string }[];
}): string {
  const lines: string[] = [];
  const push = (...parts: (string | number)[]) => {
    for (let i = 0; i < parts.length; i += 2) {
      lines.push(String(parts[i]), String(parts[i + 1]));
    }
  };

  push(0, "SECTION", 2, "HEADER", 0, "ENDSEC");
  push(0, "SECTION", 2, "TABLES");
  push(0, "TABLE", 2, "LAYER", 70, 3);
  for (const [name, color] of [
    ["LUXSIM_WALLS", 8],
    ["LUXSIM_FIXTURES", 1],
    ["LUXSIM_GRID", 3],
  ] as const) {
    push(0, "LAYER", 2, name, 70, 0, 62, color, 6, "CONTINUOUS");
  }
  push(0, "ENDTAB", 0, "ENDSEC");
  push(0, "SECTION", 2, "ENTITIES");

  const storeyName = (id: string) =>
    opts.storeys.find((s) => s.id === id)?.name ?? id;

  for (const room of opts.rooms) {
    if (room.polygon.length >= 2) {
      polyline(push, "LUXSIM_WALLS", room.polygon, true);
      push(
        0,
        "TEXT",
        8,
        "LUXSIM_WALLS",
        10,
        room.polygon[0]!.x,
        20,
        room.polygon[0]!.y,
        30,
        0,
        40,
        0.25,
        1,
        `${room.name} (${storeyName(room.storeyId)})`
      );
    }
  }

  for (const inst of opts.instances) {
    push(
      0,
      "CIRCLE",
      8,
      "LUXSIM_FIXTURES",
      10,
      inst.position.x,
      20,
      inst.position.y,
      30,
      inst.position.z,
      40,
      0.15
    );
    push(
      0,
      "TEXT",
      8,
      "LUXSIM_FIXTURES",
      10,
      inst.position.x + 0.2,
      20,
      inst.position.y,
      30,
      inst.position.z,
      40,
      0.12,
      1,
      inst.name.slice(0, 32)
    );
  }

  for (const pt of opts.measurePoints) {
    push(
      0,
      "POINT",
      8,
      "LUXSIM_GRID",
      10,
      pt.x,
      20,
      pt.y,
      30,
      pt.z
    );
  }

  push(0, "ENDSEC", 0, "EOF");
  return lines.join("\n");
}

type PushFn = (...parts: (string | number)[]) => void;

function polyline(push: PushFn, layer: string, pts: Vec2[], closed: boolean) {
  push(
    0,
    "LWPOLYLINE",
    8,
    layer,
    90,
    pts.length,
    70,
    closed ? 1 : 0
  );
  for (const p of pts) {
    push(10, p.x, 20, p.y);
  }
}
