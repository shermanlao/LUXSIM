/**
 * Fixed AB / Dialux comparison room — constants for docs and tests.
 * See docs/ab-golden-room/
 */
import { rectPolygon } from "./geometry";
import type { FixtureInstance, RoomV2 } from "./types";

export const GOLDEN_ROOM_ID = "ab_golden_room";

export const GOLDEN_ROOM: RoomV2 = {
  id: GOLDEN_ROOM_ID,
  storeyId: "ab_golden_storey",
  name: "AB golden 5×4 m",
  polygon: rectPolygon(0, 0, 5, 4),
  heightM: 2.8,
  workplaneHeightM: 0.75,
  reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
  calc: {
    gridSpacing: 0.5,
    interreflection: true,
    bounces: 2,
    computeUgr: true,
    maintenanceFactor: 0.8,
    en12464TemplateId: "office",
  },
};

export const GOLDEN_FIXTURES: FixtureInstance[] = [
  {
    instanceId: "ab_inst_1",
    luminaireId: "ab_lum",
    storeyId: "ab_golden_storey",
    roomId: GOLDEN_ROOM_ID,
    name: "Sample downlight A",
    position: { x: 2.5, y: 2.0, z: 2.7 },
    rotationDeg: 30,
  },
  {
    instanceId: "ab_inst_2",
    luminaireId: "ab_lum",
    storeyId: "ab_golden_storey",
    roomId: GOLDEN_ROOM_ID,
    name: "Sample downlight B",
    position: { x: 1.2, y: 3.1, z: 2.7 },
    rotationDeg: 120,
  },
];

/** Published reference (regenerate via `npm run ab-golden:refresh`). */
export const GOLDEN_LUXSIM_EXPECTED = {
  eave_lx: 186.11,
  emin_lx: 59.49,
  emax_lx: 405.56,
  uo: 0.32,
  ugr: 27.73,
  maintained_eave_lx: 148.89,
  lpd_w_m2: 3.0,
  total_watts: 60,
  area_m2: 20,
} as const;
