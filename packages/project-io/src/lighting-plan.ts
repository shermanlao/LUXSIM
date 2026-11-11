import type { jsPDF } from "jspdf";
import type { PhotometricData } from "../../photometry/src/types";
import { luminaireBody } from "../../photometry/src/flux";
import { pointInPolygon, roomAreaM2, roomBounds } from "./geometry";
import {
  aggregateProjectLuminaires,
  formatWatts,
  type LuminaireAggregateRow,
} from "./report-model";
import type { FixtureInstance, ProjectSceneV2, RoomV2, Storey, Vec2 } from "./types";

export const STANDARD_PLAN_SCALES = [50, 100, 125, 150, 200, 250, 300, 400, 500, 1000] as const;

export interface PlanBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  depth: number;
}

export interface PlanLayout {
  orientation: "portrait" | "landscape";
  scale: number;
  paperW: number;
  paperH: number;
}

export interface TypeStyle {
  luminaireId: string;
  fill: [number, number, number];
  stroke: [number, number, number];
  number: [number, number, number];
}

const TYPE_PALETTE: Omit<TypeStyle, "luminaireId">[] = [
  { fill: [186, 52, 48], stroke: [96, 22, 20], number: [255, 255, 255] },
  { fill: [26, 102, 74], stroke: [12, 48, 34], number: [255, 255, 255] },
  { fill: [40, 72, 128], stroke: [20, 36, 72], number: [255, 255, 255] },
  { fill: [140, 92, 28], stroke: [70, 44, 12], number: [255, 255, 255] },
];

/** Minimum typified diameter so a two-digit number stays inside the circle. */
const MIN_SYMBOL_MM = 6.2;
const MAX_SYMBOL_MM = 11;
const TYPIFY = 5;

/** Reserved legend strip below (or beside) the floor plate — never on the drawing. */
export const LEGEND_STRIP_H_MM = 24;
export const LEGEND_GAP_MM = 4;
export const LEGEND_SIDE_W_MM = 78;

export function unionRoomBounds(rooms: RoomV2[]): PlanBounds | null {
  if (!rooms.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const room of rooms) {
    if (room.polygon.length < 2) continue;
    for (const p of room.polygon) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0.1, maxX - minX),
    depth: Math.max(0.1, maxY - minY),
  };
}

export function choosePlanScale(worldW: number, worldD: number, paperWmm: number, paperHmm: number): number {
  const w = Math.max(worldW, 0.1);
  const d = Math.max(worldD, 0.1);
  const maxW = Math.max(paperWmm, 1);
  const maxH = Math.max(paperHmm, 1);
  for (const scale of STANDARD_PLAN_SCALES) {
    if ((w * 1000) / scale <= maxW && (d * 1000) / scale <= maxH) return scale;
  }
  return Math.ceil(Math.max((w * 1000) / maxW, (d * 1000) / maxH));
}

export function choosePlanLayout(
  worldW: number,
  worldD: number,
  portraitBox: { w: number; h: number },
  landscapeBox: { w: number; h: number }
): PlanLayout {
  const sPortrait = choosePlanScale(worldW, worldD, portraitBox.w, portraitBox.h);
  const sLandscape = choosePlanScale(worldW, worldD, landscapeBox.w, landscapeBox.h);
  if (sLandscape < sPortrait) {
    return { orientation: "landscape", scale: sLandscape, paperW: landscapeBox.w, paperH: landscapeBox.h };
  }
  return { orientation: "portrait", scale: sPortrait, paperW: portraitBox.w, paperH: portraitBox.h };
}

/** Paper diameter (mm) for a typified plan symbol. True IES size is enlarged to stay readable. */
export function typifiedPlanSizeMm(sizeM: number, scale: number): number {
  const trueMm = (Math.max(sizeM, 0) * 1000) / Math.max(scale, 1);
  return Math.min(MAX_SYMBOL_MM, Math.max(MIN_SYMBOL_MM, trueMm * TYPIFY));
}

export interface PlanBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlanLegendSplit {
  placement: "bottom" | "right";
  scale: number;
  planBox: PlanBox;
  legendBox: PlanBox;
  gapMm: number;
}

/**
 * Fit the floor plate first, after reserving a legend strip *outside* the
 * drawing (below when that keeps a larger scale; otherwise to the right).
 */
export function splitPlanAndLegend(
  content: PlanBox,
  worldW: number,
  worldD: number
): PlanLegendSplit {
  const gap = LEGEND_GAP_MM;
  const pad = 2;
  const bottomPlan: PlanBox = {
    x: content.x,
    y: content.y,
    w: content.w,
    h: Math.max(20, content.h - LEGEND_STRIP_H_MM - gap),
  };
  const bottomLegend: PlanBox = {
    x: content.x,
    y: content.y + bottomPlan.h + gap,
    w: content.w,
    h: LEGEND_STRIP_H_MM,
  };
  const scaleBottom = choosePlanScale(
    worldW,
    worldD,
    Math.max(1, bottomPlan.w - pad * 2),
    Math.max(1, bottomPlan.h - pad * 2)
  );

  const rightPlan: PlanBox = {
    x: content.x,
    y: content.y,
    w: Math.max(20, content.w - LEGEND_SIDE_W_MM - gap),
    h: content.h,
  };
  const rightLegend: PlanBox = {
    x: content.x + rightPlan.w + gap,
    y: content.y,
    w: LEGEND_SIDE_W_MM,
    h: content.h,
  };
  const scaleRight = choosePlanScale(
    worldW,
    worldD,
    Math.max(1, rightPlan.w - pad * 2),
    Math.max(1, rightPlan.h - pad * 2)
  );

  if (scaleRight < scaleBottom) {
    return { placement: "right", scale: scaleRight, planBox: rightPlan, legendBox: rightLegend, gapMm: gap };
  }
  return { placement: "bottom", scale: scaleBottom, planBox: bottomPlan, legendBox: bottomLegend, gapMm: gap };
}

/** Font size that keeps a fixture number inside a typified circle. */
export function numberFontSizePt(diameterMm: number, digits: number): number {
  const innerW = Math.max(2, diameterMm - 1.8);
  const widthPt = innerW / (Math.max(1, digits) * 0.58) / 0.3528;
  const heightPt = Math.max(2, diameterMm - 1.5) / 0.3528;
  return Math.max(4.8, Math.min(7.2, widthPt, heightPt));
}

export function firstFixtureNumber(
  luminaireId: string,
  instances: FixtureInstance[],
  numbers: Map<string, number>
): number | null {
  for (const inst of instances) {
    if (inst.luminaireId !== luminaireId) continue;
    const n = numbers.get(inst.instanceId);
    if (n != null) return n;
  }
  return null;
}

export function worldToPaper(
  x: number,
  y: number,
  bounds: PlanBounds,
  originX: number,
  originY: number,
  mmPerM: number
): Vec2 {
  return {
    x: originX + (x - bounds.minX) * mmPerM,
    y: originY + (bounds.maxY - y) * mmPerM,
  };
}

/** 1-based fixture numbers, same order as the luminaire schedule appendix. */
export function fixtureNumbers(instances: FixtureInstance[]): Map<string, number> {
  const map = new Map<string, number>();
  instances.forEach((inst, idx) => {
    map.set(inst.instanceId, idx + 1);
  });
  return map;
}

export function typicalMountingHeightLabel(instances: FixtureInstance[]): string | null {
  const zs = instances.map((i) => i.position.z).filter((z) => Number.isFinite(z));
  if (!zs.length) return null;
  const min = Math.min(...zs);
  const max = Math.max(...zs);
  if (max - min < 0.005) return `Mounting height ${min.toFixed(2)} m`;
  const avg = zs.reduce((a, b) => a + b, 0) / zs.length;
  return `Mounting height ${min.toFixed(2)}–${max.toFixed(2)} m (typical ${avg.toFixed(2)} m)`;
}

export function storeysWithRooms(scene: ProjectSceneV2): { storey: Storey; rooms: RoomV2[] }[] {
  const byId = new Map<string, Storey>();
  for (const s of scene.storeys) byId.set(s.id, s);
  const grouped = new Map<string, RoomV2[]>();
  for (const room of scene.rooms) {
    const list = grouped.get(room.storeyId) ?? [];
    list.push(room);
    grouped.set(room.storeyId, list);
  }
  const out: { storey: Storey; rooms: RoomV2[] }[] = [];
  for (const [id, rooms] of grouped) {
    const storey = byId.get(id) ?? { id, name: "Storey", elevationM: 0, heightM: 0 };
    out.push({ storey, rooms });
  }
  // Keep scene storey order, then any unknown ids.
  out.sort((a, b) => {
    const ia = scene.storeys.findIndex((s) => s.id === a.storey.id);
    const ib = scene.storeys.findIndex((s) => s.id === b.storey.id);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return out;
}

export function typeStylesFor(rows: LuminaireAggregateRow[]): TypeStyle[] {
  return rows.map((row, i) => {
    const pal = TYPE_PALETTE[i % TYPE_PALETTE.length]!;
    return { luminaireId: row.luminaireId, ...pal };
  });
}

export function polygonCentroid(polygon: Vec2[]): Vec2 {
  if (!polygon.length) return { x: 0, y: 0 };
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const cross = a.x * b.y - b.x * a.y;
    area2 += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area2) < 1e-12) {
    const sx = polygon.reduce((s, p) => s + p.x, 0) / polygon.length;
    const sy = polygon.reduce((s, p) => s + p.y, 0) / polygon.length;
    return { x: sx, y: sy };
  }
  return { x: cx / (3 * area2), y: cy / (3 * area2) };
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-18) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function minEdgeDistance(p: Vec2, polygon: Vec2[]): number {
  let d = Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    d = Math.min(d, distToSegment(p, polygon[i]!, polygon[(i + 1) % polygon.length]!));
  }
  return d;
}

/** Interior point suitable for a room name — stays inside the room and off fixtures. */
export function interiorLabelPoint(
  room: RoomV2,
  otherRooms: RoomV2[],
  fixtures: Vec2[]
): Vec2 {
  const b = roomBounds(room);
  const fallback = polygonCentroid(room.polygon);
  const usable = (p: Vec2) =>
    pointInPolygon(p, room.polygon) && !otherRooms.some((o) => pointInPolygon(p, o.polygon));
  let best = usable(fallback) ? fallback : { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  let bestScore = -Infinity;
  const nx = 28;
  const ny = 28;
  for (let iy = 1; iy < ny; iy += 1) {
    for (let ix = 1; ix < nx; ix += 1) {
      const p = {
        x: b.minX + (ix / nx) * b.width,
        y: b.minY + (iy / ny) * b.depth,
      };
      if (!usable(p)) continue;
      const edge = minEdgeDistance(p, room.polygon);
      let fixtureDist = 4;
      for (const f of fixtures) {
        fixtureDist = Math.min(fixtureDist, Math.hypot(p.x - f.x, p.y - f.y));
      }
      // Prefer a central, inset point. Cap fixture repulsion so labels do not
      // flee to a narrow end of a tall room and collide with neighbours.
      const centre = Math.hypot(p.x - fallback.x, p.y - fallback.y);
      const score = edge * 2.0 + Math.min(fixtureDist, 1.1) * 0.7 - centre * 0.85;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
  }
  if (bestScore === -Infinity && !usable(best)) {
    // Last resort: any inside sample
    for (let iy = 1; iy < ny; iy += 1) {
      for (let ix = 1; ix < nx; ix += 1) {
        const p = {
          x: b.minX + (ix / nx) * b.width,
          y: b.minY + (iy / ny) * b.depth,
        };
        if (pointInPolygon(p, room.polygon)) return p;
      }
    }
  }
  return best;
}

function closePolygon(doc: jsPDF, points: Vec2[], style: "S" | "F" | "FD") {
  if (points.length < 2) return;
  doc.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i += 1) {
    doc.lineTo(points[i]!.x, points[i]!.y);
  }
  doc.close();
  if (style === "F") doc.fill();
  else if (style === "FD") doc.fillStroke();
  else doc.stroke();
}

function rotatedRect(cx: number, cy: number, width: number, height: number, rotationDeg: number): Vec2[] {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = width / 2;
  const hh = height / 2;
  const corners: Vec2[] = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
  // Y is flipped on the page, so negate the rotation's y contribution already handled by paper Y;
  // world CCW appears CW after the flip — negate angle via sin sign.
  return corners.map((c) => ({
    x: cx + c.x * cos + c.y * sin,
    y: cy - c.x * sin + c.y * cos,
  }));
}

interface Occupied {
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: Occupied, b: Occupied): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

function pickScaleBarLengthM(scale: number, maxPaperMm: number): number {
  const maxM = (maxPaperMm * scale) / 1000;
  const candidates = [1, 2, 5, 10, 20, 25, 50];
  let best = candidates[0]!;
  for (const c of candidates) {
    if (c <= maxM) best = c;
  }
  return best;
}

export interface DrawLightingPlanArgs {
  scene: ProjectSceneV2;
  photometry: Record<string, PhotometricData>;
  wattsById?: Record<string, number | null | undefined>;
  rooms: RoomV2[];
  storeyName: string;
  content: { x: number; y: number; w: number; h: number };
}

/**
 * Vector lighting plan for one storey, drawn into `content`.
 * Returns the scale actually used.
 */
export function drawLightingPlan(doc: jsPDF, args: DrawLightingPlanArgs): number {
  const { rooms, scene, photometry, wattsById, content } = args;
  const bounds = unionRoomBounds(rooms);
  const split = splitPlanAndLegend(content, bounds?.width ?? 10, bounds?.depth ?? 10);
  const scale = split.scale;
  const mmPerM = 1000 / scale;
  const pad = 2;

  if (!bounds) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text("No rooms on this storey.", content.x, content.y + 10);
    drawLegendStrip(doc, split.legendBox, split.placement, scale, [], new Map(), new Map(), [], photometry, []);
    doc.setTextColor(0);
    return scale;
  }

  const planW = bounds.width * mmPerM;
  const boxW = Math.max(20, split.planBox.w - pad * 2);
  const boxH = Math.max(20, split.planBox.h - pad * 2);
  const originX = split.planBox.x + pad + Math.max(0, (boxW - planW) / 2);
  // Top-align so leftover space in the plan box increases the gap above the legend.
  const originY = split.planBox.y + pad;
  void boxH;
  const toPaper = (x: number, y: number) => worldToPaper(x, y, bounds, originX, originY, mmPerM);

  const roomIds = new Set(rooms.map((r) => r.id));
  const storeyIds = new Set(rooms.map((r) => r.storeyId));
  const instances = scene.instances.filter(
    (inst) => storeyIds.has(inst.storeyId) || (inst.roomId != null && roomIds.has(inst.roomId))
  );

  const rows = aggregateProjectLuminaires(
    { ...scene, instances, rooms },
    photometry,
    wattsById
  );
  const styles = typeStylesFor(rows);
  const styleById = new Map(styles.map((s) => [s.luminaireId, s]));
  const numbers = fixtureNumbers(scene.instances);

  const othersOf = (room: RoomV2) => rooms.filter((r) => r.id !== room.id);
  const fixturesIn = (room: RoomV2) =>
    instances.filter((i) => i.roomId === room.id).map((i) => ({ x: i.position.x, y: i.position.y }));

  // Largest rooms first so partitions stroke on top.
  const drawRooms = [...rooms].sort((a, b) => roomAreaM2(b) - roomAreaM2(a));

  doc.setLineWidth(0.35);
  doc.setLineJoin("miter");
  doc.setDrawColor(40, 50, 62);
  doc.setFillColor(248, 248, 247);
  for (const room of drawRooms) {
    const pts = room.polygon.map((p) => toPaper(p.x, p.y));
    closePolygon(doc, pts, "FD");
  }

  const occupied: Occupied[] = [];

  // Fixture symbols first so room names can dodge them.
  const symbolOcc: Occupied[] = [];

  for (const inst of instances) {
    const photo = photometry[inst.luminaireId];
    const body = luminaireBody(photo);
    const sizeM = body.isCircular
      ? (body.diameterM ?? Math.max(body.widthM, body.lengthM))
      : Math.max(body.widthM, body.lengthM);
    const paperSize = typifiedPlanSizeMm(sizeM, scale);
    const p = toPaper(inst.position.x, inst.position.y);
    const style = styleById.get(inst.luminaireId) ?? { luminaireId: inst.luminaireId, ...TYPE_PALETTE[0]! };
    const n = numbers.get(inst.instanceId);
    const label = n != null ? String(n) : "";
    const w = body.isCircular ? paperSize : typifiedPlanSizeMm(body.widthM, scale);
    const h = body.isCircular ? paperSize : typifiedPlanSizeMm(body.lengthM, scale);
    drawNumberedFixture(doc, p.x, p.y, body, style, w, h, inst.rotationDeg, label);
    const r = Math.max(w, h) / 2;
    symbolOcc.push({ x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 });
  }

  const blockers: Occupied[] = symbolOcc.map((s) => ({
    x: s.x - 1.2,
    y: s.y - 1.2,
    w: s.w + 2.4,
    h: s.h + 2.4,
  }));

  // Room names (after symbols, so they stay off fixtures and the legend)
  doc.setFont("helvetica", "normal");
  doc.setTextColor(55, 62, 72);
  for (const room of rooms) {
    const b = roomBounds(room);
    const roomWmm = b.width * mmPerM;
    const roomHmm = b.depth * mmPerM;
    const fontSize = roomWmm < 16 || roomHmm < 14 ? 6 : roomWmm < 28 ? 7 : 8;
    doc.setFontSize(fontSize);
    // Wrap early so long names (e.g. Reception & Waiting) stay inside the room.
    const wrapW = Math.max(11, Math.min(28, roomWmm * 0.62, roomWmm - 3));
    let lines = doc.splitTextToSize(room.name, wrapW) as string[];
    if (lines.length > 3) lines = lines.slice(0, 3);
    const lineH = fontSize * 0.38;
    const blockH = lines.length * lineH;
    const maxLineW = Math.max(0, ...lines.map((ln) => doc.getTextWidth(ln)));
    const preferred = interiorLabelPoint(room, othersOf(room), fixturesIn(room));
    const others = othersOf(room);
    const usable = (world: Vec2) =>
      pointInPolygon(world, room.polygon) && !others.some((o) => pointInPolygon(world, o.polygon));

    let best: { tx: number; ty: number; score: number; pad: Occupied } | null = null;
    const consider = (world: Vec2, bonus = 0) => {
      if (!usable(world)) return;
      const c = toPaper(world.x, world.y);
      const pad: Occupied = {
        x: c.x - maxLineW / 2 - 0.7,
        y: c.y - blockH / 2 - 0.6,
        w: maxLineW + 1.4,
        h: blockH + 1.2,
      };
      if (blockers.some((s) => overlaps(pad, s)) || occupied.some((s) => overlaps(pad, s))) return;
      const edge = minEdgeDistance(world, room.polygon);
      const centre = Math.hypot(world.x - preferred.x, world.y - preferred.y);
      const score = edge * 2 + bonus - centre * 0.5;
      const ty = c.y - blockH / 2 + lineH * 0.7;
      if (!best || score > best.score) best = { tx: c.x, ty, score, pad };
    };

    consider(preferred, 1.2);
    for (let iy = 2; iy <= 12; iy += 1) {
      for (let ix = 2; ix <= 12; ix += 1) {
        consider({
          x: b.minX + (ix / 14) * b.width,
          y: b.minY + (iy / 14) * b.depth,
        });
      }
    }
    // Skinny rooms: allow the label to sit just inside, or just toward the plate centre.
    if (!best && maxLineW > roomWmm * 0.9) {
      const roomCentre = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
      const planCx = bounds.minX + bounds.width / 2;
      const dir = roomCentre.x > planCx ? -1 : 1;
      consider({ x: roomCentre.x + dir * (maxLineW / mmPerM / 2 + 0.15), y: roomCentre.y }, 0.2);
    }

    const fallbackP = toPaper(preferred.x, preferred.y);
    const tx = best?.tx ?? fallbackP.x;
    const ty = best?.ty ?? fallbackP.y - blockH / 2 + lineH * 0.7;
    const pad = best?.pad ?? {
      x: tx - maxLineW / 2 - 0.7,
      y: ty - lineH,
      w: maxLineW + 1.4,
      h: blockH + 1.2,
    };
    doc.setFillColor(248, 248, 247);
    doc.rect(pad.x, pad.y, pad.w, pad.h, "F");
    doc.setTextColor(55, 62, 72);
    doc.text(lines, tx, ty, { align: "center" });
    occupied.push(pad);
  }

  drawLegendStrip(
    doc,
    split.legendBox,
    split.placement,
    scale,
    rows,
    styleById,
    numbers,
    scene.instances,
    photometry,
    instances
  );

  doc.setTextColor(0);
  doc.setLineWidth(0.2);
  return scale;
}


function ellipsisLine(doc: jsPDF, text: string, maxW: number): string {
  if (!text) return "";
  if (doc.getTextWidth(text) <= maxW) return text;
  const ell = "…";
  let s = text;
  while (s.length > 1 && doc.getTextWidth(s + ell) > maxW) s = s.slice(0, -1);
  const cut = s.lastIndexOf(" ");
  if (cut >= 10) s = s.slice(0, cut);
  return `${s.trimEnd()}${ell}`;
}

function drawNumberedFixture(
  doc: jsPDF,
  cx: number,
  cy: number,
  body: ReturnType<typeof luminaireBody>,
  style: TypeStyle,
  widthMm: number,
  heightMm: number,
  rotationDeg: number,
  label: string
) {
  doc.setFillColor(...style.fill);
  doc.setDrawColor(...style.stroke);
  doc.setLineWidth(0.32);
  if (body.isCircular) {
    const r = Math.max(widthMm, heightMm) / 2;
    doc.circle(cx, cy, r, "FD");
  } else {
    closePolygon(doc, rotatedRect(cx, cy, widthMm, heightMm, rotationDeg), "FD");
  }
  if (!label) return;
  const fontSize = numberFontSizePt(Math.min(widthMm, heightMm), label.length);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  doc.setTextColor(...style.number);
  doc.text(label, cx, cy, { align: "center", baseline: "middle" });
}

function drawLegendStrip(
  doc: jsPDF,
  box: PlanBox,
  placement: "bottom" | "right",
  scale: number,
  rows: LuminaireAggregateRow[],
  styleById: Map<string, TypeStyle>,
  numbers: Map<string, number>,
  allInstances: FixtureInstance[],
  photometry: Record<string, PhotometricData>,
  storeyInstances: FixtureInstance[]
) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(210, 212, 216);
  doc.setLineWidth(0.2);
  doc.rect(box.x, box.y, box.w, box.h, "FD");

  const mountLabel = typicalMountingHeightLabel(storeyInstances);
  const barMaxW = Math.min(52, Math.max(28, box.w * 0.22));
  const barLenM = pickScaleBarLengthM(scale, barMaxW);
  const barW = (barLenM * 1000) / scale;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30);
  doc.text("Legend", box.x + 3.5, box.y + 5.2);

  // Scale bar on the right of a bottom strip (or under the title on a side strip).
  const barX = placement === "bottom" ? box.x + box.w - barW - 4 : box.x + 4;
  const barY = placement === "bottom" ? box.y + 4.8 : box.y + box.h - 9;
  drawScaleBar(doc, barX, barY, barW, barLenM, scale);
  if (mountLabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(70);
    if (placement === "bottom") {
      doc.text(mountLabel, barX - 4, box.y + 6.6, { align: "right" });
    } else {
      doc.text(mountLabel, box.x + 3.5, barY - 4.2);
    }
  }

  const typeCount = Math.max(1, rows.length);
  const colW =
    placement === "bottom"
      ? Math.min(95, (box.w - barW - 36) / typeCount)
      : Math.max(40, box.w - 8);
  let startX = box.x + 3.5;
  let startY = box.y + (placement === "bottom" ? 11.5 : 9.5);

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    const col = placement === "bottom" ? i : 0;
    const rowI = placement === "bottom" ? 0 : i;
    const x = startX + col * colW;
    const y = startY + rowI * 11.5;
    const style = styleById.get(row.luminaireId) ?? { luminaireId: row.luminaireId, ...TYPE_PALETTE[0]! };
    const photo = photometry[row.luminaireId];
    const body = luminaireBody(photo);
    const sizeM = body.isCircular
      ? (body.diameterM ?? Math.max(body.widthM, body.lengthM))
      : Math.max(body.widthM, body.lengthM);
    const dia = Math.min(7.4, Math.max(6.2, typifiedPlanSizeMm(sizeM, scale) * 0.75));
    const sample = firstFixtureNumber(row.luminaireId, allInstances, numbers);
    const label = sample != null ? String(sample) : "";
    const w = body.isCircular ? dia : dia;
    const h = body.isCircular ? dia : dia * 0.85;
    drawNumberedFixture(doc, x + dia / 2, y + 2.2, body, style, w, h, 0, label);

    const textX = x + dia + 2.2;
    const textW = colW - dia - 4;
    const watts = formatWatts(row.watts);
    const title = `${row.count} × ${row.manufacturer}  ${row.catalogNumber}${
      watts !== "—" ? `   ${watts}` : ""
    }`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(25);
    const titleLines = doc.splitTextToSize(title, textW) as string[];
    doc.text(titleLines[0] ?? title, textX, y + 1.4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(80);
    doc.text(ellipsisLine(doc, row.articleName, textW), textX, y + 5);
  }

  doc.setTextColor(0);
}

function drawScaleBar(doc: jsPDF, x: number, y: number, width: number, lengthM: number, scale: number) {
  const h = 2.2;
  const half = width / 2;
  doc.setDrawColor(30);
  doc.setFillColor(30, 30, 32);
  doc.rect(x, y, half, h, "FD");
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(30);
  doc.rect(x + half, y, half, h, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(40);
  doc.text("0", x, y + h + 3);
  doc.text(String(lengthM / 2), x + half, y + h + 3, { align: "center" });
  doc.text(`${lengthM} m`, x + width, y + h + 3, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(`Scale 1:${scale}`, x, y - 1.6);
  doc.setTextColor(0);
}

export const lightingPlanInternals = {
  MIN_SYMBOL_MM,
  MAX_SYMBOL_MM,
  TYPIFY,
  pickScaleBarLengthM,
};
