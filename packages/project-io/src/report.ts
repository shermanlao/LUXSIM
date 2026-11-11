import { jsPDF } from "jspdf";
import type { PhotometricData } from "../../photometry/src/types";
import { polarPreview } from "../../photometry/src/interpolate";
import type { ProjectSceneV2, ResultsV2, RoomV2 } from "./types";
import { roomAreaM2 } from "./geometry";
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
  planSnapshots?: Record<string, string>;
  persp3dSnapshots?: Record<string, string>;
  projectPerspectiveSnapshot?: string;
}

const MARGIN = 20;
const PAGE_W = 210;
const PAGE_H = 297;
const FOOTER_Y = 290;
const CONTENT_W = PAGE_W - MARGIN * 2;

class ReportPdfBuilder {
  readonly doc: jsPDF;
  readonly input: ReportInput;
  page = 0;

  constructor(input: ReportInput) {
    this.doc = new jsPDF();
    this.input = input;
  }

  private finishPage(sectionTitle?: string, contextLine?: string) {
    this.page += 1;
    const { doc } = this;
    doc.setDrawColor(200);
    doc.line(MARGIN, FOOTER_Y - 6, PAGE_W - MARGIN, FOOTER_Y - 6);
    doc.setFontSize(8);
    doc.setTextColor(110);
    if (contextLine) {
      doc.text(contextLine, MARGIN, FOOTER_Y - 2, { maxWidth: CONTENT_W * 0.72 });
    }
    doc.text(this.input.projectName, MARGIN, FOOTER_Y + 3, { maxWidth: CONTENT_W * 0.72 });
    if (sectionTitle) {
      doc.text(sectionTitle, PAGE_W - MARGIN, FOOTER_Y + 3, { align: "right" });
    }
    doc.text(String(this.page), PAGE_W - MARGIN, FOOTER_Y - 2, { align: "right" });
    doc.setTextColor(0);
  }

  private pageHeader(sectionTitle: string, contextLine?: string) {
    const { doc } = this;
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(this.input.projectName, MARGIN, 14);
    if (contextLine) {
      doc.text(contextLine, MARGIN, 20, { maxWidth: CONTENT_W * 0.85 });
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
      this.doc.addPage();
    }
    return sectionTitle ? this.pageHeader(sectionTitle, contextLine) : MARGIN;
  }

  ensureY(y: number, need: number, section: string, context?: string): number {
    if (y + need > FOOTER_Y - 14) {
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
      `Φtotal: ${totals.totalFlux != null ? `${Math.round(totals.totalFlux)} lm` : "—"}`,
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
    this.doc.setFontSize(9);
    const header =
      "pcs.  Manufacturer  Article No.  Article name  Φ  P  Luminous efficacy";
    this.doc.setFont("helvetica", "bold");
    this.doc.text(header, MARGIN, y);
    this.doc.setFont("helvetica", "normal");
    y += 6;
    for (const row of rows) {
      y = this.ensureY(y, 6, "Luminaire list");
      const flux = row.flux != null ? `${Math.round(row.flux)} lm` : "n/a";
      const eff = row.efficacy != null ? `${row.efficacy.toFixed(1)} lm/W` : "—";
      this.doc.text(
        `${row.count}  ${row.manufacturer.slice(0, 12)}  ${row.catalogNumber.slice(0, 10)}  ${row.articleName.slice(0, 36)}  ${flux}  ${formatWatts(row.watts)}  ${eff}`,
        MARGIN,
        y,
        { maxWidth: CONTENT_W }
      );
      y += 5;
    }
    this.finishPage("Luminaire list");
  }

  private roomList() {
    this.doc.addPage();
    this.page += 1;
    let y = this.pageHeader("Room list");
    const { scene, results, photometry, wattsById, projectName } = this.input;
    for (const room of scene.rooms) {
      y = this.ensureY(y, 42, "Room list", room.name);
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
        `Ēperpendicular: ${res ? formatLux(eave) : "—"}`,
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
        "pcs.  Manufacturer  Article  Φ  P",
        MARGIN,
        y
      );
      y += 5;
      for (const row of luminairesInRoom(room.id, scene, photometry, wattsById)) {
        y = this.ensureY(y, 6, "Room list", room.name);
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
      "Workplane  Type  Height  Wall zone  Ē  Emin  Emax  Uo (g1)  g2",
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

  private roomSummaryProperties(room: RoomV2) {
    const ctx = roomContextLabel(this.input.projectName, this.input.scene, room);
    this.doc.addPage();
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
    left.forEach((t, i) => this.doc.text(t, MARGIN, y + i * 7));
    right.forEach((t, i) => this.doc.text(t, MARGIN + 95, y + i * 7));
    y += 28;

    const plan = this.input.planSnapshots?.[room.id];
    if (plan) {
      try {
        this.doc.text("Plan view", MARGIN, y);
        this.doc.addImage(plan, "PNG", MARGIN, y + 4, 80, 60);
        const persp = this.input.persp3dSnapshots?.[room.id];
        if (persp) {
          this.doc.text("3D perspective", MARGIN + 90, y);
          this.doc.addImage(persp, "PNG", MARGIN + 90, y + 4, 80, 60);
        }
        y += 72;
      } catch {
        /* ignore */
      }
    }

    const snap = this.input.falseColorSnapshots?.[room.id];
    if (snap) {
      y = this.ensureY(y, 100, "Summary", ctx);
      this.doc.setFontSize(11);
      this.doc.text("Isolux / false-color working plane", MARGIN, y);
      try {
        this.doc.addImage(snap, "PNG", MARGIN, y + 4, CONTENT_W, 85);
      } catch {
        /* ignore */
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
      `Ēperpendicular (working plane): ${formatLux(summary.eave)}`,
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
    this.doc.text("pcs.  Manufacturer  Article name  Φ  P  Efficacy", MARGIN, y);
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
    this.doc.setFontSize(10);
    this.doc.text(`Calculation type: ${REPORT_CALC_TYPE}`, MARGIN, y);
    y += 7;
    this.doc.text(
      `Height: ${room.workplaneHeightM.toFixed(3)} m · Wall zone: ${wallZoneM(room).toFixed(3)} m`,
      MARGIN,
      y
    );
    y += 8;
    const props = [
      ["Ē", formatLux(summary.eave)],
      ["Emin", formatLux(summary.emin)],
      ["Emax", formatLux(summary.emax)],
      ["Uo (g1)", summary.uo.toFixed(2)],
      ["g2", g2.toFixed(2)],
    ];
    props.forEach(([k, v], i) => {
      this.doc.text(`${k}: ${v}`, MARGIN + (i % 3) * 58, y + Math.floor(i / 3) * 7);
    });
    y += 18;

    const snap = this.input.falseColorSnapshots?.[room.id];
    if (snap) {
      try {
        this.doc.text("False-color workplane", MARGIN, y);
        this.doc.addImage(snap, "PNG", MARGIN, y + 4, CONTENT_W, 90);
        y += 100;
      } catch {
        /* ignore */
      }
    }

    y = this.ensureY(y, 40, "Working plane", ctx);
    this.doc.setFontSize(9);
    this.doc.text("Luminaire schedule (coordinates)", MARGIN, y);
    y += 6;
    const roomInst = this.input.scene.instances.filter((i) => i.roomId === room.id);
    for (const inst of roomInst) {
      y = this.ensureY(y, 5, "Working plane", ctx);
      this.doc.text(
        `${inst.name} @ (${inst.position.x.toFixed(2)}, ${inst.position.y.toFixed(2)}, ${inst.position.z.toFixed(2)}) m · rot ${inst.rotationDeg.toFixed(0)}°`,
        MARGIN,
        y
      );
      y += 5;
    }
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
      this.doc.setFontSize(11);
      this.doc.text(photo.description || lid, MARGIN, y);
      y += 10;
      this.doc.setFontSize(10);
      this.doc.text(`Manufacturer: ${photo.manufacturer || "—"}`, MARGIN, y);
      y += 7;
      this.doc.text(`Catalog / article No.: ${photo.catalogNumber || "—"}`, MARGIN, y);
      y += 7;
      this.doc.text(`Luminous flux: ${formatLuminousFlux(photo)}`, MARGIN, y);
      y += 7;
      this.doc.text(`Watts: ${formatWatts(photo.watts)}`, MARGIN, y);
      y += 7;
      const eff = efficacyFromPhoto(photo, lid);
      if (eff != null) {
        this.doc.text(`Luminous efficacy: ${eff.toFixed(1)} lm/W`, MARGIN, y);
        y += 7;
      }
      drawPolar(this.doc, photo, MARGIN, y + 4);
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

function efficacyFromPhoto(photo: PhotometricData, _lid: string): number | null {
  if (photo.luminousFlux != null && photo.watts != null && photo.luminousFlux > 0 && photo.watts > 0) {
    return photo.luminousFlux / photo.watts;
  }
  return null;
}

export function buildFullReportPdf(input: ReportInput): jsPDF {
  return new ReportPdfBuilder(input).build();
}

function drawPolar(doc: jsPDF, photo: PhotometricData, x: number, y: number) {
  const samples = polarPreview(photo, 37);
  const maxCd = Math.max(...samples.map((s) => s.cd), 1);
  const size = 80;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const rMax = size * 0.4;
  doc.setDrawColor(180);
  doc.circle(cx, cy, rMax);
  doc.circle(cx, cy, rMax * 0.5);
  doc.setDrawColor(30, 100, 140);
  let prev: { x: number; y: number } | null = null;
  for (const s of samples) {
    const r = (s.cd / maxCd) * rMax;
    const rad = (s.theta * Math.PI) / 180;
    const px = cx + r * Math.sin(rad);
    const py = cy + r * Math.cos(rad);
    if (prev) doc.line(prev.x, prev.y, px, py);
    prev = { x: px, y: py };
  }
  doc.setFontSize(8);
  doc.text(`Polar (C0) · max ${Math.round(maxCd)} cd`, x, y + size + 6);
}
