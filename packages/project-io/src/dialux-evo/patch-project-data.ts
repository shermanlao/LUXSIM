import { readFileSync } from "fs";
import path from "path";
import type { ProjectSceneV2, RoomV2, Storey } from "../types";
import { roomBounds } from "../geometry";
import {
  MAX_TEMPLATE_ROOMS,
  TEMPLATE_BUILDING_COORD_IDS,
  TEMPLATE_ROOM_ORIGIN_COORD_IDS,
  TEMPLATE_SLOT_INNER_VERTICES,
  TEMPLATE_SLOT_OUTER_VERTICES,
} from "./constants";

export interface EvoRoomInput {
  room: RoomV2;
  storey: Storey;
}

export interface PatchProjectDataResult {
  dat: string;
  roomCount: number;
  warnings: string[];
}

function fmtCoord(n: number): string {
  const s = n.toFixed(12).replace(/\.?0+$/, "");
  if (!s.includes(".")) return `${s}.`;
  return s;
}

function polygonTuple(points: { x: number; y: number }[]): string {
  return `(${points.map((p) => `(${fmtCoord(p.x)}, ${fmtCoord(p.y)})`).join(", ")})`;
}

/** Outer contour = axis-aligned bounds with small margin (storey element envelope). */
function outerFromInner(inner: { x: number; y: number }[], margin = 0.05): { x: number; y: number }[] {
  const xs = inner.map((p) => p.x);
  const ys = inner.map((p) => p.y);
  const minX = Math.min(...xs) - margin;
  const maxX = Math.max(...xs) + margin;
  const minY = Math.min(...ys) - margin;
  const maxY = Math.max(...ys) + margin;
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function escapeStepString(value: string): string {
  return value.replace(/%/g, "%25").replace(/;/g, "%3B");
}

function patchHeader(dat: string, projectName: string, description: string): string {
  const now = new Date();
  const iso = now.toISOString();
  const fileName = escapeStepString(`${projectName}.evo`);
  const desc = escapeStepString(description);
  return dat
    .replace(
      /FILE_DESCRIPTION \([^)]+\);/,
      `FILE_DESCRIPTION ('${projectName.replace(/'/g, "''")}', '${desc}');`
    )
    .replace(/FILE_NAME \([^)]+\);/, `FILE_NAME ('${fileName}', '', '${iso.replace(/\.\d{3}Z$/, "Z")}');`);
}

function patchArchiveTitle(dat: string, _projectName: string): string {
  return dat;
}

const CONTOUR_ENTITY_PREFIX =
  /(StoreyContourRepresentationData \(#[0-9]+, 0, \$?, \$?, False, \(1\., 1\., 1\.\), )/;

function vertexRefList(refList: string, vertexCount: number): string {
  const refId = refList.match(/#\d+/)?.[0] ?? "#1238";
  if (vertexCount <= 0) return "()";
  return `(${Array.from({ length: vertexCount }, () => refId).join(", ")})`;
}

/** Replace .Inner. / .Outer. storey contours when vertex counts match the template slot (keeps STEP topology valid). */
function patchContours(
  dat: string,
  rooms: EvoRoomInput[],
  warnings: string[]
): string {
  const innerRe = new RegExp(
    CONTOUR_ENTITY_PREFIX.source +
      `(\\(\\([^;]+?\\)\\))(, #[0-9]+, )\\((#[0-9]+(?:, #[0-9]+)*)\\)(, \\.Inner\\.)`,
    "g"
  );
  const outerRe = new RegExp(
    CONTOUR_ENTITY_PREFIX.source +
      `(\\(\\([^;]+?\\)\\))(, #[0-9]+, )\\((#[0-9]+(?:, #[0-9]+)*)\\)(, \\.Outer\\.)`,
    "g"
  );

  let innerIdx = 0;
  let dat1 = dat.replace(innerRe, (full, pre, _coords, hashPart, refList, post) => {
    const slot = rooms[innerIdx];
    const templateVerts = TEMPLATE_SLOT_INNER_VERTICES[innerIdx];
    innerIdx += 1;
    if (!slot || templateVerts === undefined) return full;
    const b = roomBounds(slot.room);
    const local = slot.room.polygon.map((p) => ({
      x: p.x - b.minX,
      y: p.y - b.minY,
    }));
    if (local.length !== templateVerts) {
      warnings.push(
        `Room "${slot.room.name}" has ${local.length} polygon vertices; template slot ${innerIdx} expects ${templateVerts} — kept DIALux reference outline for load safety.`
      );
      return full;
    }
    return `${pre}${polygonTuple(local)}${hashPart}${vertexRefList(refList, local.length)}${post}`;
  });

  let outerIdx = 0;
  dat1 = dat1.replace(outerRe, (full, pre, _coords, hashPart, refList, post) => {
    const slot = rooms[outerIdx];
    const slotIndex = outerIdx;
    outerIdx += 1;
    const templateOuter = TEMPLATE_SLOT_OUTER_VERTICES[slotIndex];
    const templateInner = TEMPLATE_SLOT_INNER_VERTICES[slotIndex];
    if (!slot || templateOuter === undefined || templateInner === undefined) return full;
    const b = roomBounds(slot.room);
    const local = slot.room.polygon.map((p) => ({
      x: p.x - b.minX,
      y: p.y - b.minY,
    }));
    if (local.length !== templateInner) return full;
    const outer = outerFromInner(local);
    if (outer.length !== templateOuter) return full;
    return `${pre}${polygonTuple(outer)}${hashPart}${vertexRefList(refList, outer.length)}${post}`;
  });

  return dat1;
}

function patchCoordEntity(
  dat: string,
  entityId: number,
  x: number,
  y: number,
  z: number
): string {
  const re = new RegExp(
    `#${entityId} = CoordSys3D \\(\\([^)]+\\), \\(1\\., 0\\., 0\\.\\), \\(0\\., 1\\., 0\\.\\), \\(0\\., 0\\., 1\\.\\)\\);`
  );
  return dat.replace(
    re,
    `#${entityId} = CoordSys3D ((${fmtCoord(x)}, ${fmtCoord(y)}, ${fmtCoord(z)}), (1., 0., 0.), (0., 1., 0.), (0., 0., 1.));`
  );
}

/** Building world origins + room local origins at (0,0,0) in building CSYS. */
function patchBuildingOrigins(dat: string, rooms: EvoRoomInput[]): string {
  let out = dat;
  for (let i = 0; i < TEMPLATE_BUILDING_COORD_IDS.length; i += 1) {
    const slot = rooms[i];
    if (!slot) continue;
    const b = roomBounds(slot.room);
    const elev = slot.storey.elevationM;
    out = patchCoordEntity(out, TEMPLATE_BUILDING_COORD_IDS[i]!, b.minX, b.minY, elev);
    const roomCoord = TEMPLATE_ROOM_ORIGIN_COORD_IDS[i];
    if (roomCoord) out = patchCoordEntity(out, roomCoord, 0, 0, 0);
  }
  return out;
}

function patchStoreyHeights(dat: string, rooms: EvoRoomInput[]): string {
  let out = dat;
  const re = /StoreyRepresentationData \(#[0-9]+, 0, \$?, \$?, False, \(1\., 1\., 1\.\), ([0-9.]+)\)/g;
  let i = 0;
  out = out.replace(re, (line, h) => {
    const slot = rooms[i];
    i += 1;
    if (!slot) return line;
    return line.replace(h, fmtCoord(slot.room.heightM));
  });
  return out;
}

/** Workplane entity z per room (9 Workplane CoordSys in template). */
const TEMPLATE_WORKPLANE_COORD_IDS = [
  665, 704, 743, 782, 821, 860, 899, 938, 977,
] as const;

function patchWorkplaneHeights(dat: string, rooms: EvoRoomInput[]): string {
  let out = dat;
  for (let i = 0; i < TEMPLATE_WORKPLANE_COORD_IDS.length; i += 1) {
    const slot = rooms[i];
    if (!slot) continue;
    const id = TEMPLATE_WORKPLANE_COORD_IDS[i]!;
    const re = new RegExp(`#${id} = CoordSys3D \\(\\(0\\., 0\\., ([0-9.]+)\\),`);
    out = out.replace(re, `#${id} = CoordSys3D ((0., 0., ${fmtCoord(slot.room.workplaneHeightM)}),`);
  }
  return out;
}

/** Room + building display names (template order). */
const TEMPLATE_ROOM_NAME_PROP_IDS = [178, 196, 214, 232, 250, 268, 286, 304, 322];
const TEMPLATE_BUILDING_NAME_PROP_IDS = [169, 187, 205, 223, 241, 259, 277, 295, 313];

function patchRoomNames(dat: string, rooms: EvoRoomInput[]): string {
  let out = dat;
  for (let i = 0; i < TEMPLATE_ROOM_NAME_PROP_IDS.length; i += 1) {
    const slot = rooms[i];
    if (!slot) continue;
    const propId = TEMPLATE_ROOM_NAME_PROP_IDS[i]!;
    const safe = slot.room.name.replace(/'/g, "''");
    const re = new RegExp(
      `(#${propId} = CommonInformationPropertySet \\([0-9]+, '[^']+', ')([^']*)(', ')([^']*)(', \\$\\))`
    );
    out = out.replace(re, `$1${safe}$3${safe}$5`);
    const bId = TEMPLATE_BUILDING_NAME_PROP_IDS[i];
    if (bId) {
      const bname = `Building ${safe}`.replace(/'/g, "''");
      const bre = new RegExp(
        `(#${bId} = CommonInformationPropertySet \\([0-9]+, '[^']+', ')([^']*)(', \\$\\))`
      );
      out = out.replace(bre, `$1${bname}$3`);
    }
  }
  return out;
}

export function patchProjectDataDat(
  templateDat: string,
  projectName: string,
  rooms: EvoRoomInput[],
  description?: string
): PatchProjectDataResult {
  const warnings: string[] = [];
  if (rooms.length > MAX_TEMPLATE_ROOMS) {
    warnings.push(
      `DIALux evo template supports up to ${MAX_TEMPLATE_ROOMS} room zones per export; extra rooms were omitted.`
    );
  }
  const slice = rooms.slice(0, MAX_TEMPLATE_ROOMS);
  let dat = templateDat;
  dat = patchHeader(
    dat,
    projectName,
    description ??
      `${projectName} exported from LUXSIM (geometry faithful; luminaires not encoded in this build).`
  );
  dat = patchContours(dat, slice, warnings);
  dat = patchBuildingOrigins(dat, slice);
  dat = patchStoreyHeights(dat, slice);
  dat = patchWorkplaneHeights(dat, slice);
  dat = patchRoomNames(dat, slice);
  patchArchiveTitle(dat, projectName);
  if (rooms.length < MAX_TEMPLATE_ROOMS) {
    warnings.push(
      `Exported ${rooms.length} room(s); unused template room slots remain in the archive (open in DIALux and delete extras if needed).`
    );
  }
  return { dat, roomCount: slice.length, warnings };
}

function stripUtf8Bom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

export function loadReferenceProjectDataDat(fixtureRoot: string): string {
  return stripUtf8Bom(
    readFileSync(path.join(fixtureRoot, "Project/ProjectData/ProjectData.dat"), "utf8")
  );
}

export function roomsForStorey(scene: ProjectSceneV2, storeyId: string): EvoRoomInput[] {
  const storey = scene.storeys.find((s) => s.id === storeyId);
  if (!storey) return [];
  return scene.rooms
    .filter((r) => r.storeyId === storeyId)
    .map((room) => ({ room, storey }));
}

export function allEvoRooms(scene: ProjectSceneV2): EvoRoomInput[] {
  const out: EvoRoomInput[] = [];
  for (const storey of scene.storeys) {
    out.push(...roomsForStorey(scene, storey.id));
  }
  return out;
}
