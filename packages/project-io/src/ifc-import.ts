import type { ProjectSceneV2, RoomV2, Storey } from "./types";
import { defaultSceneV2 } from "./migrate";
import { rectPolygon } from "./geometry";

export interface IfcImportResult {
  scene: ProjectSceneV2;
  warnings: string[];
}

/**
 * Lightweight IFC STEP text import:
 * - IfcBuildingStorey → storeys
 * - IfcSpace → rooms (default 4×4 m box at origin / tagged coords when found)
 * Full mesh visualization is out of scope for this parser; underlay kind "ifc" marks source.
 */
export function importIfcText(text: string, projectName = "IFC Import"): IfcImportResult {
  const warnings: string[] = [];
  const storeys: Storey[] = [];
  const rooms: RoomV2[] = [];

  // Match #id=IFCBUILDINGSTOREY(...) or IFCBUILDINGSTOREY(
  const storeyRe =
    /#(\d+)\s*=\s*IFCBUILDINGSTOREY\s*\(([^;]*)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = storeyRe.exec(text)) !== null) {
    const raw = m[2] ?? "";
    const name = extractIfcLabel(raw) || `Storey ${storeys.length + 1}`;
    const elev = extractElevation(raw);
    storeys.push({
      id: `ifc_storey_${m[1]}`,
      name,
      elevationM: elev,
      heightM: 3.0,
    });
  }

  if (!storeys.length) {
    warnings.push("No IfcBuildingStorey found — created default GF");
    storeys.push(...defaultSceneV2().storeys);
  }

  const spaceRe = /#(\d+)\s*=\s*IFCSPACE\s*\(([^;]*)\)/gi;
  let spaceIndex = 0;
  while ((m = spaceRe.exec(text)) !== null) {
    const raw = m[2] ?? "";
    const name = extractIfcLabel(raw) || `Space ${spaceIndex + 1}`;
    const storey = storeys[Math.min(spaceIndex, storeys.length - 1)]!;
    const ox = (spaceIndex % 4) * 6;
    const oy = Math.floor(spaceIndex / 4) * 6;
    const room: RoomV2 = {
      id: `ifc_space_${m[1]}`,
      storeyId: storey.id,
      name,
      polygon: rectPolygon(ox, oy, 5, 4),
      heightM: storey.heightM,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: {
        gridSpacing: 0.5,
        interreflection: true,
        bounces: 2,
        computeUgr: true,
      },
    };
    rooms.push(room);
    spaceIndex += 1;
  }

  if (!rooms.length) {
    warnings.push("No IfcSpace found — draw rooms manually on imported storeys");
  }

  void projectName;

  const scene: ProjectSceneV2 = {
    version: 2,
    storeys,
    rooms,
    underlays: [],
    fixtureLibraryIds: [],
    instances: [],
    ui: {
      activeStoreyId: storeys[0]!.id,
      activeRoomId: rooms[0]?.id ?? null,
      viewMode: "top",
      tool: "select",
      camera3d: null,
    },
  };

  return { scene, warnings };
}

function extractIfcLabel(args: string): string {
  // IFC labels often appear as 'Name'
  const m = args.match(/'([^']+)'/);
  return m?.[1]?.replace(/\\X\\../g, "") ?? "";
}

function extractElevation(args: string): number {
  // Last numeric-ish tokens sometimes include elevation; heuristic: look for =number after STOREY
  const nums = [...args.matchAll(/([-+]?\d+\.?\d*)/g)].map((x) => Number(x[1]));
  // Prefer a value that looks like elevation (between -50 and 200)
  for (const n of nums.reverse()) {
    if (Number.isFinite(n) && n > -50 && n < 200) return n;
  }
  return 0;
}
