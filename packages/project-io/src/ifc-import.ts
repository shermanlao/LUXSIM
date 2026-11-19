import type { ProjectSceneV2, RoomV2, Storey } from "./types";
import { defaultSceneV2 } from "./migrate";
import { rectPolygon } from "./geometry";

export interface IfcImportResult {
  scene: ProjectSceneV2;
  warnings: string[];
}

/**
 * Lightweight IFC STEP text import:
 * - IfcBuildingStorey → storeys (Name, then LongName; never the GlobalId token)
 * - IfcSpace → rooms (same label rule; default 5×4 m box at origin / tagged coords)
 * - IfcRelAggregates / IfcRelContainedInSpatialStructure assign spaces to storeys
 * Full mesh visualization is out of scope for this parser; underlay kind "ifc" marks source.
 */
export function importIfcText(text: string, projectName = "IFC Import"): IfcImportResult {
  const warnings: string[] = [];
  const entities = parseIfcEntities(text);
  const storeys: Storey[] = [];
  const storeyEntityIds = new Set<string>();

  for (const entity of entities) {
    if (entity.type !== "IFCBUILDINGSTOREY") continue;
    const name = ifcDisplayName(entity.args) || `Storey ${storeys.length + 1}`;
    const elev = extractStoreyElevation(entity.args);
    storeys.push({
      id: `ifc_storey_${entity.id}`,
      name,
      elevationM: elev,
      heightM: 3.0,
    });
    storeyEntityIds.add(entity.id);
  }

  if (!storeys.length) {
    warnings.push("No IfcBuildingStorey found — created default GF");
    storeys.push(...defaultSceneV2().storeys);
  }

  const parentOf = buildSpatialParentMap(entities);
  const rooms: RoomV2[] = [];
  const spaceEntities = entities.filter((entity) => entity.type === "IFCSPACE");
  let unassigned = 0;

  spaceEntities.forEach((entity, spaceIndex) => {
    const name = ifcDisplayName(entity.args) || `Space ${spaceIndex + 1}`;
    const storeyEntityId = resolveStoreyEntityId(entity.id, parentOf, storeyEntityIds);
    const storey = storeyEntityId
      ? storeys.find((item) => item.id === `ifc_storey_${storeyEntityId}`)
      : undefined;
    if (!storey) unassigned += 1;
    const assigned = storey ?? storeys[0]!;
    const ox = (spaceIndex % 4) * 6;
    const oy = Math.floor(spaceIndex / 4) * 6;
    const room: RoomV2 = {
      id: `ifc_space_${entity.id}`,
      storeyId: assigned.id,
      name,
      polygon: rectPolygon(ox, oy, 5, 4),
      heightM: assigned.heightM,
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
  });

  if (!rooms.length) {
    warnings.push("No IfcSpace found — draw rooms manually on imported storeys");
  } else if (unassigned > 0) {
    const fallback = storeys[0]!.name;
    warnings.push(
      unassigned === 1
        ? `No spatial containment for 1 space — placed on ${fallback}`
        : `No spatial containment for ${unassigned} spaces — placed on ${fallback}`
    );
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

interface IfcEntity {
  id: string;
  type: string;
  args: string[];
}

function parseIfcEntities(text: string): IfcEntity[] {
  const entities: IfcEntity[] = [];
  const re = /#(\d+)\s*=\s*([A-Z][A-Z0-9]*)\s*\(([^;]*)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    entities.push({
      id: match[1]!,
      type: match[2]!.toUpperCase(),
      args: splitIfcArgs(match[3] ?? ""),
    });
  }
  return entities;
}

/** Split a STEP argument list, keeping quoted strings and nested tuples intact. */
function splitIfcArgs(raw: string): string[] {
  const args: string[] = [];
  let current = "";
  let depth = 0;
  let inQuote = false;
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]!;
    if (inQuote) {
      current += char;
      if (char === "'") {
        if (raw[i + 1] === "'") {
          current += raw[i + 1]!;
          i += 1;
        } else {
          inQuote = false;
        }
      }
      continue;
    }
    if (char === "'") {
      inQuote = true;
      current += char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (char === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim() !== "") args.push(current.trim());
  return args;
}

function unquoteIfc(token: string | undefined): string {
  const value = (token ?? "").trim();
  if (!value || value === "$") return "";
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value
      .slice(1, -1)
      .replace(/''/g, "'")
      .replace(/\\X\\../g, "");
  }
  return "";
}

/** Prefer IfcRoot.Name, then IfcSpatialStructureElement.LongName. Never the GlobalId. */
function ifcDisplayName(args: string[]): string {
  return unquoteIfc(args[2]) || unquoteIfc(args[7]);
}

function extractStoreyElevation(args: string[]): number {
  const explicit = Number(args[9]);
  if (Number.isFinite(explicit)) return explicit;
  const nums = args
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value));
  for (const value of nums.reverse()) {
    if (value > -50 && value < 200) return value;
  }
  return 0;
}

function parseIfcRefs(token: string | undefined): string[] {
  if (!token) return [];
  return [...token.matchAll(/#(\d+)/g)].map((match) => match[1]!);
}

/**
 * Map each related element to its relating spatial parent.
 * IfcRelAggregates: RelatingObject, RelatedObjects
 * IfcRelContainedInSpatialStructure: RelatedElements, RelatingStructure
 * When both exist, a direct storey parent wins over a non-storey parent.
 */
function buildSpatialParentMap(entities: IfcEntity[]): Map<string, string> {
  const storeyIds = new Set(
    entities.filter((entity) => entity.type === "IFCBUILDINGSTOREY").map((entity) => entity.id)
  );
  const parentOf = new Map<string, string>();

  const remember = (child: string, parent: string) => {
    if (!child || !parent || child === parent) return;
    const existing = parentOf.get(child);
    if (!existing || (!storeyIds.has(existing) && storeyIds.has(parent))) {
      parentOf.set(child, parent);
    }
  };

  for (const entity of entities) {
    if (entity.type === "IFCRELAGGREGATES") {
      const parent = parseIfcRefs(entity.args[4])[0];
      if (!parent) continue;
      for (const child of parseIfcRefs(entity.args[5])) remember(child, parent);
    } else if (entity.type === "IFCRELCONTAINEDINSPATIALSTRUCTURE") {
      const parent = parseIfcRefs(entity.args[5])[0];
      if (!parent) continue;
      for (const child of parseIfcRefs(entity.args[4])) remember(child, parent);
    }
  }

  return parentOf;
}

function resolveStoreyEntityId(
  spaceId: string,
  parentOf: Map<string, string>,
  storeyEntityIds: Set<string>
): string | undefined {
  const seen = new Set<string>();
  let current: string | undefined = parentOf.get(spaceId);
  while (current && !seen.has(current)) {
    seen.add(current);
    if (storeyEntityIds.has(current)) return current;
    current = parentOf.get(current);
  }
  return undefined;
}
