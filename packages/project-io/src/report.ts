import { jsPDF } from "jspdf";
import type { PhotometricData } from "../../photometry/src/types";
import { polarPlane, polarToXY } from "../../photometry/src/interpolate";
import { formatCct, formatDimensions, luminaireBody, resolvedFlux } from "../../photometry/src/flux";
import type { ProjectSceneV2, ResultsV2, RoomV2 } from "./types";
import { roomAreaM2 } from "./geometry";
import { legendStopsForRange } from "./isolux-map";
import { choosePlanLayout, drawLightingPlan, storeysWithRooms, unionRoomBounds } from "./lighting-plan";
import {
  REPORT_CALC_TYPE,
  REPORT_MAINTENANCE_FACTOR,
  DESIGN_ASSIST_DISCLAIMER,
  aggregateProjectLuminaires,
  enrichSummaryWithPolygonArea,
  formatAreaM2,
  formatEfficacy,
  formatLpd,
  formatLpdPer100Lx,
  formatLux,
  formatLuminousFlux,
  formatReflectancePct,
  formatWatts,
  luminairesInRoom,
  projectTotals,
  roomContextLabel,
  roomInstalledWatts,
  roomLpdFromPolygon,
  roomPolygonArea,
  typicalMountingHeightM,
  uniformitiesFromResults,
  wallZoneM,
  workplaneHeightM,
} from "./report-model";

export interface ReportInput {
  projectName: string;
  orgName?: string;
  luxsimVersion?: string;
  scene: ProjectSceneV2;
  results: ResultsV2;
  photometry: Record<string, PhotometricData>;
  wattsById?: Record<string, number | null | undefined>;
  /** data URLs keyed by roomId */
  falseColorSnapshots?: Record<string, string>;
  /** Isolux line drawing (white background) for Summary pages */
  isoluxSnapshots?: Record<string, string>;
  planSnapshots?: Record<string, string>;
  persp3dSnapshots?: Record<string, string>;
  projectPerspectiveSnapshot?: string;
}

const MARGIN = 20;
const PAGE_W = 210;
const PAGE_H = 297;
const FOOTER_Y = 290;
const CONTENT_W = PAGE_W - MARGIN * 2;

function decodeBase64(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(b64, "base64"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0
  );
}

function rasterInfo(dataUrl: string): { format: "PNG" | "JPEG"; width: number; height: number } | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const header = dataUrl.slice(0, comma).toLowerCase();
  const buf = decodeBase64(dataUrl.slice(comma + 1));
  const isJpeg =
    header.includes("jpeg") || header.includes("jpg") || (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8);
  if (isJpeg) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1]!;
      const size = (buf[i + 2]! << 8) + buf[i + 3]!;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = (buf[i + 5]! << 8) + buf[i + 6]!;
        const width = (buf[i + 7]! << 8) + buf[i + 8]!;
        return { format: "JPEG", width, height };
      }
      i += 2 + size;
    }
    return null;
  }
  if (buf.length >= 24 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { format: "PNG", width: readU32BE(buf, 16), height: readU32BE(buf, 20) };
  }
  return null;
}


class ReportPdfBuilder {
  readonly doc: jsPDF;
  readonly input: ReportInput;
  page = 0;

  constructor(input: ReportInput) {
    this.doc = new jsPDF();
    this.input = input;
  }

  private pageWidth(): number {
    return this.doc.internal.pageSize.getWidth();
  }

  private pageHeight(): number {
    return this.doc.internal.pageSize.getHeight();
  }

  private footerY(): number {
    return this.pageHeight() - 7;
  }

  private contentWidth(): number {
    return this.pageWidth() - MARGIN * 2;
  }

  private addReportPage(orientation: "portrait" | "landscape" = "portrait") {
    this.doc.addPage("a4", orientation);
  }

  /** Draw an image fitted inside a box, preserving aspect ratio. Returns the bottom y. */
  private drawFittedImage(dataUrl: string, x: number, y: number, maxW: number, maxH: number): number {
    const info = rasterInfo(dataUrl);
    const iw = info?.width ?? 1200;
    const ih = info?.height ?? 800;
    const s = Math.min(maxW / Math.max(iw, 1), maxH / Math.max(ih, 1));
    const dw = iw * s;
    const dh = ih * s;
    try {
      this.doc.addImage(dataUrl, info?.format ?? "PNG", x, y, dw, dh);
    } catch {
      return y;
    }
    return y + dh;
  }

  private drawLuxLegend(y: number, emin: number, emax: number): number {
    const stops = legendStopsForRange(emin, emax);
    if (stops.length < 2) return y;
    const barW = Math.min(CONTENT_W * 0.62, 18 + stops.length * 16);
    const barH = 4.2;
    const cell = barW / stops.length;
    for (let i = 0; i < stops.length; i += 1) {
      const c = stops[i]!.color;
      const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(c);
      if (m) this.doc.setFillColor(Number(m[1]), Number(m[2]), Number(m[3]));
      this.doc.rect(MARGIN + i * cell, y, cell, barH, "F");
    }
    this.doc.setDrawColor(180);
    this.doc.rect(MARGIN, y, barW, barH, "S");
    this.doc.setFontSize(7);
    this.doc.setTextColor(60);
    stops.forEach((s, i) => {
      const label = i === stops.length - 1 ? `${s.lux} [lx]` : String(s.lux);
      this.doc.text(label, MARGIN + (i + 0.5) * cell, y + barH + 4, { align: "center" });
    });
    this.doc.setTextColor(0);
    return y + barH + 8;
  }

  private finishPage(sectionTitle?: string, contextLine?: string) {
    const { doc } = this;
    const pageW = this.pageWidth();
    const footerY = this.footerY();
    const contentW = this.contentWidth();
    doc.setDrawColor(200);
    doc.line(MARGIN, footerY - 6, pageW - MARGIN, footerY - 6);
    doc.setFontSize(8);
    doc.setTextColor(110);
    if (contextLine) {
      doc.text(contextLine, MARGIN, footerY - 2, { maxWidth: contentW * 0.72 });
    }
    doc.text(this.input.projectName, MARGIN, footerY + 3, { maxWidth: contentW * 0.72 });
    if (sectionTitle) {
      doc.text(sectionTitle, pageW - MARGIN, footerY + 3, { align: "right" });
    }
    doc.text(String(this.page), pageW - MARGIN, footerY - 2, { align: "right" });
    doc.setTextColor(0);
  }

  private pageHeader(sectionTitle: string, contextLine?: string) {
    const { doc } = this;
    const contentW = this.contentWidth();
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(this.input.projectName, MARGIN, 14);
    if (contextLine) {
      doc.text(contextLine, MARGIN, 20, { maxWidth: contentW * 0.85 });
    }
    doc.setTextColor(40);
    doc.setFontSize(15);
    doc.text(sectionTitle, MARGIN, contextLine ? 32 : 26);
    doc.setTextColor(0);
    return contextLine ? 40 : 34;
  }

  newPage(sectionTitle?: string, contextLine?: string): number {
    if (this.page > 0) {
      this.finishPage(sectionTitle, contextLine);
      const landscape = this.pageWidth() > this.pageHeight();
      this.addReportPage(landscape ? "landscape" : "portrait");
      this.page += 1;
    }
    return sectionTitle ? this.pageHeader(sectionTitle, contextLine) : MARGIN;
  }

  ensureY(y: number, need: number, section: string, context?: string): number {
    if (y + need > this.footerY() - 14) {
      this.newPage(section, context);
      return 40;
    }
    return y;
  }

  build(): jsPDF {
    this.cover();
    this.contents();
    this.projectSummary();
    this.luminaireList();
    this.roomList();
    this.calculationObjects();
    this.lightingPlan();
    for (const room of this.input.scene.rooms) {
      this.roomSummaryProperties(room);
      this.roomSummaryResults(room);
      this.roomWorkingPlane(room);
    }
    this.productSheets();
    this.scheduleAppendix();
    this.finishPage("Luminaire schedule");
    return this.doc;
  }

  private cover() {
    const { doc, input } = this;
    const date = new Date().toLocaleDateString();
    doc.setFontSize(22);
    doc.text("LUXSIM Lighting Report", MARGIN, 42);
    doc.setFontSize(17);
    doc.text(input.projectName, MARGIN, 58);
    doc.setFontSize(11);
  let y = 72;
    if (input.orgName?.trim()) {
      doc.text(`Organization: ${input.orgName.trim()}`, MARGIN, y);
      y += 8;
    }
    doc.text(`Date: ${date}`, MARGIN, y);
    y += 8;
    if (input.luxsimVersion) {
      doc.text(`Generated with LUXSIM ${input.luxsimVersion}`, MARGIN, y);
      y += 8;
    } else {
      doc.text("Generated with LUXSIM", MARGIN, y);
      y += 8;
    }
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(DESIGN_ASSIST_DISCLAIMER, MARGIN, y + 6, { maxWidth: CONTENT_W });
    doc.setTextColor(0);

    const snap = input.projectPerspectiveSnapshot;
    if (snap) {
      try {
        doc.addImage(snap, "PNG", MARGIN, 105, CONTENT_W, 95);
      } catch {
        /* ignore */
      }
    }
    this.page = 1;
    this.finishPage("Cover");
  }

  private contents() {
    this.doc.addPage();
    this.page = 2;
    let y = this.pageHeader("Contents");
    this.doc.setFontSize(11);
    const items = [
      "Project summary",
      "Luminaire list",
      "Room list",
      "Calculation objects",
      "Lighting Plan",
      "Per-room summary and working plane",
      "Product sheets",
      "Luminaire schedule appendix",
    ];
    items.forEach((t, i) => {
      this.doc.text(`${i + 1}. ${t}`, MARGIN, y + i * 8);
    });
    this.finishPage("Contents");
  }

  private projectSummary() {
    this.doc.addPage();
    this.page += 1;
    let y = this.pageHeader("Project summary");
    const { scene, photometry, wattsById } = this.input;
    const totalArea = scene.rooms.reduce((s, r) => s + roomAreaM2(r), 0);
    const agg = aggregateProjectLuminaires(scene, photometry, wattsById);
    const totals = projectTotals(agg);
    const lines = [
      `Storeys: ${scene.storeys.length}`,
      `Rooms: ${scene.rooms.length}`,
      `Fixture instances: ${scene.instances.length}`,
      `Distinct products in library: ${scene.fixtureLibraryIds.length}`,
      `Total floor area (polygon): ${totalArea.toFixed(2)} m²`,
      `Installed power: ${totals.totalWatts.toFixed(1)} W`,
      totals.totalFlux != null
        ? `Total luminous flux: ${Math.round(totals.totalFlux)} lm`
        : "Total luminous flux: — (absolute photometry in project)",
      totals.efficacy != null
        ? `Overall luminous efficacy: ${totals.efficacy.toFixed(1)} lm/W`
        : "Overall luminous efficacy: —",
    ];
    this.doc.setFontSize(10);
    lines.forEach((t, i) => {
      this.doc.text(t, MARGIN, y + i * 7);
    });
    const snap = this.input.projectPerspectiveSnapshot;
    if (snap) {
      try {
        this.doc.addImage(snap, "PNG", MARGIN, y + lines.length * 7 + 8, CONTENT_W, 85);
      } catch {
        /* ignore */
      }
    }
    this.finishPage("Project summary");
  }

  private luminaireList() {
    this.doc.addPage();
    this.page += 1;
    let y = this.pageHeader("Luminaire list");
    const { scene, photometry, wattsById } = this.input;
    const rows = aggregateProjectLuminaires(scene, photometry, wattsById);
    const totals = projectTotals(rows);
    this.doc.setFontSize(10);
    const boxes = [
      `Phi total: ${totals.totalFlux != null ? `${Math.round(totals.totalFlux)} lm` : "—"}`,
      `Ptotal: ${totals.totalWatts.toFixed(1)} W`,
      `Luminous efficacy: ${totals.efficacy != null ? `${totals.efficacy.toFixed(1)} lm/W` : "—"}`,
    ];
    boxes.forEach((b, i) => {
      const x = MARGIN + i * 58;
      this.doc.setDrawColor(210);
      this.doc.setFillColor(245, 245, 245);
      this.doc.rect(x, y, 54, 14, "FD");
      this.doc.setFontSize(8);
      this.doc.text(b, x + 3, y + 9, { maxWidth: 48 });
    });
    y += 22;
    const cols = [
      { key: "pcs", label: "pcs.", w: 12 },
      { key: "mfr", label: "Manufacturer", w: 32 },
      { key: "cat", label: "Article No.", w: 28 },
      { key: "name", label: "Article name", w: 52 },
      { key: "flux", label: "Flux", w: 20 },
      { key: "p", label: "P", w: 16 },
      { key: "eff", label: "lm/W", w: 16 },
    ] as const;
    this.doc.setFontSize(8);
    this.doc.setFont("helvetica", "bold");
    let x = MARGIN;
    this.doc.setFillColor(236, 236, 236);
    this.doc.rect(MARGIN, y - 4, CONTENT_W, 7, "F");
    for (const c of cols) {
      this.doc.text(c.label, x + 1, y);
      x += c.w;
    }
    this.doc.setFont("helvetica", "normal");
    y += 6;
    for (const row of rows) {
      const nameLines = this.doc.splitTextToSize(row.articleName || "—", cols[3].w - 2) as string[];
      const rowH = Math.max(6, nameLines.length * 4 + 2);
      y = this.ensureY(y, rowH, "Luminaire list");
      const flux = row.flux != null ? `${Math.round(row.flux)} lm` : "—";
      const eff = row.efficacy != null ? row.efficacy.toFixed(1) : "—";
      const cells = [
        String(row.count),
        row.manufacturer || "—",
        row.catalogNumber || "—",
        nameLines,
        flux,
        formatWatts(row.watts),
        eff,
      ];
      x = MARGIN;
      this.doc.setDrawColor(220);
      this.doc.line(MARGIN, y + rowH - 2, PAGE_W - MARGIN, y + rowH - 2);
      cells.forEach((cell, i) => {
        const w = cols[i]!.w;
        if (Array.isArray(cell)) {
          this.doc.text(cell, x + 1, y);
        } else {
          const lines = this.doc.splitTextToSize(cell, w - 2) as string[];
          this.doc.text(lines[0] ?? "—", x + 1, y);
        }
        x += w;
      });
      y += rowH;
    }
    this.finishPage("Luminaire list");
  }

  private roomList() {
    this.doc.addPage();
    this.page += 1;
    let y = this.pageHeader("Room list");
    const { scene, results, photometry, wattsById, projectName } = this.input;
    for (const room of scene.rooms) {
      y = this.ensureY(y, 42, "Room list");
      const res = results.byRoomId[room.id];
      const area = roomPolygonArea(room);
      const pTotal = roomInstalledWatts(room.id, scene, photometry, wattsById);
      const lpd = roomLpdFromPolygon(room, scene, photometry, wattsById);
      const eave = res?.summary.eave ?? 0;
      this.doc.setFontSize(11);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(room.name.toUpperCase(), MARGIN, y);
      this.doc.setFont("helvetica", "normal");
      y += 7;
      this.doc.setFontSize(9);
      const stats = [
        `Ptotal: ${pTotal.toFixed(1)} W`,
        `ARoom: ${formatAreaM2(area)}`,
        `LPD: ${formatLpd(lpd)} (= ${formatLpdPer100Lx(lpd, eave)} room)`,
        `E perpendicular: ${res ? formatLux(eave) : "—"}`,
      ];
      stats.forEach((s, i) => {
        const x = MARGIN + (i % 2) * 88;
        const yy = y + Math.floor(i / 2) * 10;
        this.doc.setFillColor(245, 245, 245);
        this.doc.rect(x, yy - 5, 82, 9, "F");
        this.doc.text(s, x + 2, yy);
      });
      y += 24;
      this.doc.text(
        "pcs.  Manufacturer  Article  Flux  P",
        MARGIN,
        y
      );
      y += 5;
      for (const row of luminairesInRoom(room.id, scene, photometry, wattsById)) {
        y = this.ensureY(y, 6, "Room list");
        const flux = row.flux != null ? `${Math.round(row.flux)} lm` : "n/a";
        this.doc.text(
          `${row.count}  ${row.manufacturer}  ${row.articleName.slice(0, 28)}  ${flux}  ${formatWatts(row.watts)}`,
          MARGIN,
          y
        );
        y += 5;
      }
      y += 6;
      void projectName;
    }
    this.finishPage("Room list");
  }

  private calculationObjects() {
    this.doc.addPage();
    this.page += 1;
    let y = this.pageHeader("Calculation objects", "Working planes");
    const { scene, results } = this.input;
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(
      "Workplane  Type  Height  Wall zone  Eavg  Emin  Emax  Uo (g1)  g2",
      MARGIN,
      y
    );
    this.doc.setFont("helvetica", "normal");
    y += 6;
    for (const room of scene.rooms) {
      const res = results.byRoomId[room.id];
      if (!res) continue;
      const summary = enrichSummaryWithPolygonArea(
        room,
        res,
        scene,
        this.input.photometry,
        this.input.wattsById
      );
      const { g2 } = uniformitiesFromResults({ ...res, summary });
      y = this.ensureY(y, 14, "Calculation objects");
      const wpName = `Working plane (${room.name})`;
      const lines = [
        `${wpName.slice(0, 38)}`,
        `${REPORT_CALC_TYPE}`,
        `Height: ${workplaneHeightM(room).toFixed(3)} m, Wall zone: ${wallZoneM(room).toFixed(3)} m`,
      ];
      this.doc.text(lines[0]!, MARGIN, y);
      this.doc.text(lines[1]!, MARGIN, y + 4);
      this.doc.text(lines[2]!, MARGIN, y + 8);
      const vals = [
        formatLux(summary.eave),
        formatLux(summary.emin),
        formatLux(summary.emax),
        summary.uo.toFixed(2),
        g2.toFixed(2),
      ];
      this.doc.text(vals.join("   "), MARGIN + 95, y + 4);
      y += 14;
    }
    this.finishPage("Calculation objects");
  }

  private lightingPlan() {
    const groups = storeysWithRooms(this.input.scene);
    const targets = groups.length ? groups : [{ storey: { id: "none", name: "Storey", elevationM: 0, heightM: 0 }, rooms: [] }];
    for (const { storey, rooms } of targets) {
      const portraitBox = { w: 210 - MARGIN * 2 - 12, h: 297 - 40 - 24 - 8 };
      const landscapeBox = { w: 297 - MARGIN * 2 - 12, h: 210 - 40 - 24 - 8 };
      const bounds = unionRoomBounds(rooms);
      const worldW = bounds?.width ?? 10;
      const worldD = bounds?.depth ?? 10;
      const layout = choosePlanLayout(worldW, worldD, portraitBox, landscapeBox);
      this.addReportPage(layout.orientation);
      this.page += 1;
      const ctx = `${this.input.projectName} · ${storey.name}`;
      const y = this.pageHeader("Lighting Plan", ctx);
      const footerTop = this.footerY() - 12;
      drawLightingPlan(this.doc, {
        scene: this.input.scene,
        photometry: this.input.photometry,
        wattsById: this.input.wattsById,
        rooms,
        storeyName: storey.name,
        content: {
          x: MARGIN,
          y,
          w: this.contentWidth(),
          h: Math.max(40, footerTop - y),
        },
      });
      this.finishPage("Lighting Plan", ctx);
    }
  }

  private roomSummaryProperties(room: RoomV2) {
    const ctx = roomContextLabel(this.input.projectName, this.input.scene, room);
    this.addReportPage("portrait");
    this.page += 1;
    let y = this.pageHeader("Summary", ctx);
    const area = roomPolygonArea(room);
    const mount = typicalMountingHeightM(room.id, this.input.scene);
    this.doc.setFontSize(10);
    const left = [
      `Ground area: ${formatAreaM2(area)}`,
      `Reflection factors — Ceiling: ${formatReflectancePct(room.reflectance.ceiling)} · Walls: ${formatReflectancePct(room.reflectance.walls)} · Floor: ${formatReflectancePct(room.reflectance.floor)}`,
      `Maintenance factor: ${REPORT_MAINTENANCE_FACTOR.toFixed(2)} (fixed)`,
    ];
    const right = [
      `Clearance height: ${room.heightM.toFixed(3)} m`,
      `Mounting height (typical): ${mount != null ? `${mount.toFixed(3)} m` : "—"}`,
      `Height (working plane): ${room.workplaneHeightM.toFixed(3)} m`,
      `Wall zone (working plane): ${wallZoneM(room).toFixed(3)} m`,
    ];
    this.doc.text(left[0]!, MARGIN, y);
    this.doc.text(right[0]!, MARGIN + 95, y);
    y += 7;
    this.doc.text(left[1]!, MARGIN, y, { maxWidth: CONTENT_W });
    y += 7;
    this.doc.text(left[2]!, MARGIN, y);
    this.doc.text(right[1]!, MARGIN + 95, y);
    y += 7;
    this.doc.text(right[2]!, MARGIN + 95, y);
    y += 7;
    this.doc.text(right[3]!, MARGIN + 95, y);
    y += 10;

    const isolux = this.input.isoluxSnapshots?.[room.id];
    if (isolux) {
      this.doc.setFontSize(10);
      this.doc.text("Working plane — isolux diagram", MARGIN, y);
      y = this.drawFittedImage(isolux, MARGIN, y + 3, CONTENT_W, 150) + 4;
    }

    const plan = this.input.planSnapshots?.[room.id];
    if (plan) {
      y = this.ensureY(y, 70, "Summary", ctx);
      this.doc.setFontSize(10);
      this.doc.text("Plan view", MARGIN, y);
      y = this.drawFittedImage(plan, MARGIN, y + 3, 80, 55) + 4;
      const persp = this.input.persp3dSnapshots?.[room.id];
      if (persp) {
        this.doc.text("3D perspective", MARGIN + 90, y - 4);
        this.drawFittedImage(persp, MARGIN + 90, y - 1, 80, 55);
      }
    }
    this.finishPage("Summary", ctx);
  }

  private roomSummaryResults(room: RoomV2) {
    const ctx = roomContextLabel(this.input.projectName, this.input.scene, room);
    this.doc.addPage();
    this.page += 1;
    let y = this.pageHeader("Summary — Results", ctx);
    const res = this.input.results.byRoomId[room.id];
    this.doc.setFontSize(10);
    if (!res) {
      this.doc.text("Not calculated", MARGIN, y);
      this.finishPage("Summary — Results", ctx);
      return;
    }
    const summary = enrichSummaryWithPolygonArea(
      room,
      res,
      this.input.scene,
      this.input.photometry,
      this.input.wattsById
    );
    const lpd = summary.lpd;
    const rows = [
      `E perpendicular (working plane): ${formatLux(summary.eave)}`,
      `Uo (g1): ${summary.uo.toFixed(2)}`,
      `Lighting power density: ${formatLpd(lpd)} (= ${formatLpdPer100Lx(lpd, summary.eave)} working plane)`,
      `Room lighting power density: ${formatLpd(lpd)} (= ${formatLpdPer100Lx(lpd, summary.eave)} room)`,
    ];
    if (summary.ugr != null) {
      rows.push(`UGR: ${summary.ugr.toFixed(1)}`);
    }
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Results", MARGIN, y);
    this.doc.setFont("helvetica", "normal");
    y += 8;
    rows.forEach((t, i) => {
      this.doc.text(t, MARGIN, y + i * 7);
    });
    y += rows.length * 7 + 6;
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Luminaire list", MARGIN, y);
    this.doc.setFont("helvetica", "normal");
    y += 7;
    this.doc.setFontSize(9);
    this.doc.text("pcs.  Manufacturer  Article name  Flux  P  Efficacy", MARGIN, y);
    y += 5;
    for (const row of luminairesInRoom(
      room.id,
      this.input.scene,
      this.input.photometry,
      this.input.wattsById
    )) {
      y = this.ensureY(y, 6, "Summary — Results", ctx);
      this.doc.text(
        `${row.count}  ${row.manufacturer}  ${row.articleName.slice(0, 30)}  ${
          row.flux != null ? `${Math.round(row.flux)} lm` : "n/a"
        }  ${formatWatts(row.watts)}  ${formatEfficacy(row.flux, row.watts)}`,
        MARGIN,
        y
      );
      y += 5;
    }
    this.finishPage("Summary — Results", ctx);
  }

  private roomWorkingPlane(room: RoomV2) {
    const ctx = roomContextLabel(this.input.projectName, this.input.scene, room);
    this.doc.addPage();
    this.page += 1;
    let y = this.pageHeader(`Working plane (${room.name})`, ctx);
    const res = this.input.results.byRoomId[room.id];
    if (!res) {
      this.doc.text("Not calculated", MARGIN, y);
      this.finishPage("Working plane", ctx);
      return;
    }
    const summary = enrichSummaryWithPolygonArea(
      room,
      res,
      this.input.scene,
      this.input.photometry,
      this.input.wattsById
    );
    const { g2 } = uniformitiesFromResults({ ...res, summary });
    const snap = this.input.falseColorSnapshots?.[room.id];
    if (snap) {
      y = this.drawFittedImage(snap, MARGIN, y, CONTENT_W, 155) + 4;
    }
    y = this.drawLuxLegend(y, summary.emin, summary.emax);

    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Properties", MARGIN, y);
    this.doc.setFont("helvetica", "normal");
    y += 6;
    const colW = [0, 32, 32, 32, 28, 22];
    const headers = ["Eavg", "Emin", "Emax", "Uo (g1)", "g2"];
    const values = [
      formatLux(summary.eave),
      formatLux(summary.emin),
      formatLux(summary.emax),
      summary.uo.toFixed(2),
      g2.toFixed(2),
    ];
    const startX = MARGIN + 8;
    this.doc.setFontSize(8);
    this.doc.setTextColor(80);
    let x = startX;
    headers.forEach((label, i) => {
      this.doc.text(label, x, y);
      x += colW[i + 1] ?? 28;
    });
    this.doc.setTextColor(0);
    y += 2;
    this.doc.setDrawColor(40);
    this.doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 6;
    this.doc.setFontSize(9);
    x = startX;
    values.forEach((v, i) => {
      this.doc.text(v, x, y);
      x += colW[i + 1] ?? 28;
    });
    y += 6;
    this.doc.setFontSize(8);
    this.doc.setTextColor(90);
    this.doc.text(
      `${REPORT_CALC_TYPE}    Height: ${room.workplaneHeightM.toFixed(3)} m, Wall zone: ${wallZoneM(room).toFixed(3)} m`,
      MARGIN,
      y
    );
    this.doc.setTextColor(0);
    this.finishPage("Working plane", ctx);
  }

  private productSheets() {
    const usedIds = [...new Set(this.input.scene.instances.map((i) => i.luminaireId))];
    for (const lid of usedIds.length ? usedIds : this.input.scene.fixtureLibraryIds) {
      const photo = this.input.photometry[lid];
      if (!photo) continue;
      this.doc.addPage();
      this.page += 1;
      let y = this.pageHeader("Product sheet");
      const body = luminaireBody(photo);
      const flux = resolvedFlux(photo);
      const watts = photo.watts;
      const efficacy = flux != null && watts != null && watts > 0 ? flux / watts : null;
      const cct = formatCct(photo);

      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(12);
      const title = photo.description || photo.catalogNumber || lid;
      this.doc.text(this.doc.splitTextToSize(title, CONTENT_W) as string[], MARGIN, y);
      y += 10;

      const props: [string, string][] = [
        ["Manufacturer", photo.manufacturer || "—"],
        ["Article No.", photo.catalogNumber || "—"],
        ["Luminaire luminous flux", flux != null ? `${Math.round(flux)} lm` : "—"],
        ["Connected load", formatWatts(watts)],
        ["Luminous efficacy", efficacy != null ? `${efficacy.toFixed(1)} lm/W` : "—"],
        ["Dimensions", formatDimensions(body)],
      ];
      if (cct) props.push(["Colour temperature", cct]);
      if (photo.catalogFluxLm && photo.catalogFluxLm > 0 && (flux == null || Math.abs(photo.catalogFluxLm - flux) > Math.max(50, flux * 0.1))) {
        props.push(["Catalog flux", `${Math.round(photo.catalogFluxLm)} lm`]);
      }

      const tableW = 108;
      const rowH = 6.6;
      this.doc.setFontSize(8);
      this.doc.setDrawColor(210);
      props.forEach(([k, v], i) => {
        const yy = y + i * rowH;
        if (i % 2 === 0) {
          this.doc.setFillColor(246, 246, 246);
          this.doc.rect(MARGIN, yy - 4.2, tableW, rowH, "F");
        }
        this.doc.setDrawColor(220);
        this.doc.rect(MARGIN, yy - 4.2, tableW, rowH);
        this.doc.setFont("helvetica", "normal");
        this.doc.setTextColor(90);
        this.doc.text(k, MARGIN + 2, yy);
        this.doc.setTextColor(0);
        this.doc.setFont("helvetica", "bold");
        this.doc.text(v, MARGIN + 58, yy, { maxWidth: tableW - 60 });
      });

      const symbolX = MARGIN + tableW + 18;
      const symbolY = y + 4;
      drawPlanSymbol(this.doc, body, symbolX + 22, symbolY + 18, 18);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.setTextColor(90);
      this.doc.text("Plan symbol  1:5", symbolX + 22, symbolY + 48, { align: "center" });
      this.doc.setTextColor(0);

      y += props.length * rowH + 10;
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(10);
      this.doc.text("Luminous intensity distribution", MARGIN, y);
      y += 4;
      drawPolar(this.doc, photo, MARGIN + (CONTENT_W - 120) / 2, y, 120);
      this.finishPage("Product sheet");
    }
  }

  private scheduleAppendix() {
    this.doc.addPage();
    this.page += 1;
    let y = this.pageHeader("Luminaire schedule appendix");
    this.doc.setFontSize(9);
    this.doc.text("#  Name  Storey  Room  X  Y  Z  Rot", MARGIN, y);
    y += 6;
    this.input.scene.instances.forEach((inst, idx) => {
      y = this.ensureY(y, 6, "Luminaire schedule");
      const storey = this.input.scene.storeys.find((s) => s.id === inst.storeyId)?.name ?? "";
      const room = this.input.scene.rooms.find((r) => r.id === inst.roomId)?.name ?? "—";
      this.doc.text(
        `${idx + 1}  ${inst.name.slice(0, 16)}  ${storey}  ${room}  ${inst.position.x.toFixed(2)}  ${inst.position.y.toFixed(2)}  ${inst.position.z.toFixed(2)}  ${inst.rotationDeg.toFixed(0)}`,
        MARGIN,
        y
      );
      y += 5;
    });
  }
}

export function buildFullReportPdf(input: ReportInput): jsPDF {
  return new ReportPdfBuilder(input).build();
}

function drawPlanSymbol(doc: jsPDF, body: ReturnType<typeof luminaireBody>, cx: number, cy: number, _rMax: number) {
  // 1:5 so Ø 55 mm and Ø 244 mm stay in proportion on the sheet.
  const paperMmPerM = 1000 / 5;
  const rx = Math.max((body.widthM / 2) * paperMmPerM, 2);
  const ry = Math.max((body.lengthM / 2) * paperMmPerM, 2);
  const black = body.housing === "black";
  doc.setDrawColor(40);
  doc.setFillColor(black ? 45 : 230, black ? 45 : 228, black ? 48 : 222);
  if (body.isCircular) {
    const r = Math.max(rx, ry);
    doc.circle(cx, cy, r, "FD");
    doc.setFillColor(243, 226, 176);
    doc.circle(cx, cy, r * 0.62, "F");
  } else {
    doc.rect(cx - rx, cy - ry, rx * 2, ry * 2, "FD");
  }
}

function strokeChain(doc: jsPDF, points: { x: number; y: number }[], dashed: boolean) {
  if (points.length < 2) return;
  doc.setLineDashPattern(dashed ? [1.2, 1.0] : [], 0);
  for (let i = 1; i < points.length; i += 1) {
    doc.line(points[i - 1]!.x, points[i - 1]!.y, points[i]!.x, points[i]!.y);
  }
  doc.setLineDashPattern([], 0);
}

function drawPolar(doc: jsPDF, photo: PhotometricData, x: number, y: number, size = 120) {
  const typeB = (photo.verticalAngles[0] ?? 0) < -1e-6;
  const c0 = polarPlane(photo, 0, 91);
  const c90 = polarPlane(photo, 90, 91);
  const c180 = typeB ? [] : polarPlane(photo, 180, 91);
  const c270 = typeB ? [] : polarPlane(photo, 270, 91);
  const maxCd = Math.max(
    1,
    ...c0.map((s) => s.cd),
    ...c90.map((s) => s.cd),
    ...c180.map((s) => s.cd),
    ...c270.map((s) => s.cd)
  );
  const cx = x + size / 2;
  const cy = y + size / 2 + 2;
  const rMax = size * 0.38;

  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  for (const f of [0.25, 0.5, 0.75, 1]) {
    doc.circle(cx, cy, rMax * f);
  }
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    doc.line(cx, cy, cx + rMax * Math.sin(rad), cy + rMax * Math.cos(rad));
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(90);
  doc.text(`${Math.round(maxCd * 0.5)}`, cx + 1.2, cy - rMax * 0.5 + 2);
  doc.text(`${Math.round(maxCd)}`, cx + 1.2, cy - rMax + 2);
  doc.text("0°", cx, cy + rMax + 4, { align: "center" });
  doc.text("180°", cx, cy - rMax - 2, { align: "center" });
  doc.text("90°", cx + rMax + 2, cy + 1);
  doc.text("270°", cx - rMax - 2, cy + 1, { align: "right" });
  doc.setTextColor(0);

  const pts = (plane: typeof c0, flipX = false) =>
    plane.map((s) => {
      const p = polarToXY(s.gamma, s.cd, maxCd, rMax);
      return { x: cx + (flipX ? -p.x : p.x), y: cy + p.y };
    });

  doc.setLineWidth(0.65);
  doc.setDrawColor(31, 78, 121);
  strokeChain(doc, pts(c0), false);
  if (!typeB) strokeChain(doc, pts(c180, true), false);
  doc.setDrawColor(196, 92, 38);
  strokeChain(doc, pts(c90), true);
  if (!typeB) strokeChain(doc, pts(c270, true), true);

  const legendY = y + size + 2;
  doc.setLineWidth(0.7);
  doc.setDrawColor(31, 78, 121);
  doc.line(x + 8, legendY, x + 20, legendY);
  doc.setFontSize(7);
  doc.setTextColor(40);
  doc.text("C0–C180", x + 22, legendY + 1);
  doc.setDrawColor(196, 92, 38);
  doc.setLineDashPattern([1.2, 1.0], 0);
  doc.line(x + 52, legendY, x + 64, legendY);
  doc.setLineDashPattern([], 0);
  doc.text("C90–C270", x + 66, legendY + 1);
  doc.setTextColor(90);
  doc.text(`Imax ${Math.round(maxCd)} cd`, x + size - 8, legendY + 1, { align: "right" });
  doc.setTextColor(0);
  doc.setLineWidth(0.2);
}
