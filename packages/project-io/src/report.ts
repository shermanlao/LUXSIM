import { jsPDF } from "jspdf";
import type { PhotometricData } from "../../photometry/src/types";
import { polarPlane, polarToXY } from "../../photometry/src/interpolate";
import { formatCct, formatDimensions, luminaireBody, resolvedFlux } from "../../photometry/src/flux";
import type { ProjectSceneV2, ResultsV2, RoomV2 } from "./types";
import { roomAreaM2 } from "./geometry";
import { legendStopsForScale, luxToRgb, OFFICIAL_FALSE_COLOR_SCALE } from "./isolux-map";
import { choosePlanLayout, drawLightingPlan, storeysWithRooms, unionRoomBounds } from "./lighting-plan";
import {
  REPORT_CALC_TYPE,
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
  maintainedAverageLux,
  projectTotals,
  roomContextLabel,
  roomInstalledWatts,
  roomLpdFromPolygon,
  roomMaintenanceFactor,
  roomPolygonArea,
  typicalMountingHeightM,
  uniformitiesFromResults,
  wallZoneM,
  workplaneHeightM,
} from "./report-model";
import {
  TYPE,
  INK,
  ACCENT,
  MUTED,
  RULE,
  TABLE_HEAD,
  TABLE_ALT,
  HEADER_LINE,
  loadReportFonts,
  loadReportFontsSync,
  registerReportFonts,
  reportFontFamily,
  setReportRgb,
} from "./report-style";
import { attachReportTextLog } from "./report-text-log";
import { drawQrCode } from "./qr-code";

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
  /** Project-wide 3D greyscale (JPEG/PNG data URL). */
  projectPerspectiveGreyscale?: string;
  /** Project-wide 3D false-colour (JPEG/PNG data URL). Legend is drawn in the PDF. */
  projectPerspectiveFalseColor?: string;
  /** Per-room 3D greyscale, keyed by roomId. */
  persp3dGreyscale?: Record<string, string>;
  /** Per-room 3D false-colour, keyed by roomId. */
  persp3dFalseColor?: Record<string, string>;
  /** Project-wide 3D isolines (JPEG/PNG data URL). */
  projectPerspectiveIsolines?: string;
  /** Per-room 3D isolines, keyed by roomId. */
  persp3dIsolines?: Record<string, string>;
  /** @deprecated Prefer projectPerspectiveGreyscale. No longer drawn on the cover. */
  projectPerspectiveSnapshot?: string;
  /** @deprecated Prefer persp3dGreyscale. */
  persp3dSnapshots?: Record<string, string>;
  /** Plain-text site address for the report footer. Omitted when missing or blank. */
  website?: string;
  /** View-only project URL. When set, the cover shows a QR code and this link. */
  shareUrl?: string;
}

const MARGIN = 20;
const PAGE_W = 210;
const PAGE_H = 297;
const FOOTER_Y = 290;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** Product-sheet table and plan-symbol boxes: the symbol never overlaps the table. */
export function officialProductSheetColumns(contentWidth = CONTENT_W): {
  tableX: number;
  tableW: number;
  symbolX: number;
  symbolW: number;
  gap: number;
} {
  const gap = 8;
  const symbolW = 48;
  const tableW = contentWidth - symbolW - gap;
  return { tableX: MARGIN, tableW, symbolX: MARGIN + tableW + gap, symbolW, gap };
}



/** Line height and padding so a table row can grow with wrapped cell text. */
export const REPORT_TABLE_LINE_H = 4.2;
export const REPORT_TABLE_ROW_PAD = 3;
export const REPORT_TABLE_ROW_MIN_H = 7;

/** Wrap one table cell so the full value is kept; the row height should follow this. */
export function officialTableCellLines(doc: jsPDF, text: string, widthMm: number): string[] {
  const lines = doc.splitTextToSize(String(text || "—"), Math.max(4, widthMm)) as string[];
  return lines.length ? lines : ["—"];
}

export function officialTableRowHeight(lineCount: number): number {
  return Math.max(REPORT_TABLE_ROW_MIN_H, lineCount * REPORT_TABLE_LINE_H + REPORT_TABLE_ROW_PAD);
}

/** Visible footer label: trimmed, trailing slashes stripped. Blank input is omitted. */
export function formatReportWebsite(raw?: string | null): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, "");
}

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
  private fontName = "helvetica";

  constructor(input: ReportInput) {
    this.doc = new jsPDF({ compress: true });
    attachReportTextLog(this.doc);
    this.input = input;
  }

  private applyFonts(fonts: Parameters<typeof registerReportFonts>[1]) {
    const ok = registerReportFonts(this.doc, fonts);
    this.fontName = reportFontFamily(ok);
    this.font("normal");
  }

  private font(style: "normal" | "bold" = "normal", size?: number) {
    this.doc.setFont(this.fontName, style);
    if (size != null) this.doc.setFontSize(size);
  }

  private pageWidth(): number {
    return this.doc.internal.pageSize.getWidth();
  }

  private pageHeight(): number {
    return this.doc.internal.pageSize.getHeight();
  }

  private footerY(): number {
    // Reserve a third footer line when a website is shown so it does not
    // collide with the project name, section title, or page number.
    return this.pageHeight() - (formatReportWebsite(this.input.website) ? 12 : 7);
  }

  private contentWidth(): number {
    return this.pageWidth() - MARGIN * 2;
  }

  private addReportPage(orientation: "portrait" | "landscape" = "portrait") {
    this.doc.addPage("a4", orientation);
    this.font("normal");
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

  private drawLuxLegend(y: number, _emin?: number, _emax?: number): number {
    const range = OFFICIAL_FALSE_COLOR_SCALE;
    const stops = legendStopsForScale(range);
    if (stops.length < 2) return y;
    const barW = Math.min(this.contentWidth() * 0.62, 18 + stops.length * 16);
    const barH = 4.2;
    const slices = Math.max(96, Math.round(barW * 8));
    const lastSlice = Math.max(1, slices - 1);
    for (let i = 0; i < slices; i += 1) {
      const t = i / lastSlice;
      const lux = range.minLux + t * (range.maxLux - range.minLux);
      const [r, g, b] = luxToRgb(lux, range);
      this.doc.setFillColor(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
      const x = MARGIN + (i / slices) * barW;
      const w = barW / slices + 0.08;
      this.doc.rect(x, y, w, barH, "F");
    }
    this.doc.setDrawColor(180);
    this.doc.rect(MARGIN, y, barW, barH, "S");
    this.font("normal", TYPE.caption);
    setReportRgb(this.doc, "text", MUTED);
    const last = stops.length - 1;
    stops.forEach((s, i) => {
      const label = i === last ? `${s.lux} [lx]` : String(s.lux);
      const x = MARGIN + (i / last) * barW;
      const align = i === 0 ? "left" : i === last ? "right" : "center";
      this.doc.text(label, x, y + barH + 4, { align });
    });
    this.doc.setTextColor(0);
    return y + barH + 8;
  }

  private finishPage(sectionTitle?: string, contextLine?: string) {
    const { doc } = this;
    const pageW = this.pageWidth();
    const footerY = this.footerY();
    const contentW = this.contentWidth();
    const website = formatReportWebsite(this.input.website);
    setReportRgb(doc, "draw", RULE);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, footerY - 6, pageW - MARGIN, footerY - 6);
    this.font("normal", TYPE.footer);
    setReportRgb(doc, "text", MUTED);
    if (contextLine) {
      doc.text(contextLine, MARGIN, footerY - 2, { maxWidth: contentW * 0.72 });
    }
    doc.text(this.input.projectName, MARGIN, footerY + 3, { maxWidth: contentW * 0.72 });
    if (sectionTitle) {
      doc.text(sectionTitle, pageW - MARGIN, footerY + 3, { align: "right" });
    }
    doc.text(String(this.page), pageW - MARGIN, footerY - 2, { align: "right" });
    if (website) {
      // Plain visible text only — no link annotation that could hide the address.
      doc.text(website, pageW / 2, footerY + 8, { align: "center", maxWidth: contentW });
    }
    setReportRgb(doc, "text", INK);
    this.font("normal", TYPE.body);
  }

  private pageHeader(sectionTitle: string, contextLine?: string) {
    const { doc } = this;
    const contentW = this.contentWidth();
    const pageW = this.pageWidth();
    this.font("normal", TYPE.headerMeta);
    setReportRgb(doc, "text", MUTED);
    doc.text(this.input.projectName, MARGIN, 12);
    doc.text("LUXSIM", pageW - MARGIN, 12, { align: "right" });
    if (contextLine) {
      doc.text(contextLine, MARGIN, 17, { maxWidth: contentW * 0.85 });
    }
    const titleY = contextLine ? 28 : 23;
    this.font("bold", TYPE.section);
    setReportRgb(doc, "text", INK);
    doc.text(sectionTitle, MARGIN, titleY);
    setReportRgb(doc, "draw", HEADER_LINE);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, titleY + 3, pageW - MARGIN, titleY + 3);
    doc.setLineWidth(0.2);
    setReportRgb(doc, "text", INK);
    this.font("normal", TYPE.body);
    return titleY + 10;
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
      return this.newPage(section, context);
    }
    return y;
  }

  build(): jsPDF {
    return this.buildSync();
  }

  async buildAsync(yieldTo: () => Promise<void> = () => Promise.resolve()): Promise<jsPDF> {
    this.applyFonts(await loadReportFonts());
    this.cover();
    await yieldTo();
    this.contents();
    await yieldTo();
    this.projectSummary();
    await yieldTo();
    this.luminaireList();
    await yieldTo();
    this.roomList();
    await yieldTo();
    this.calculationObjects();
    await yieldTo();
    this.lightingPlan();
    await yieldTo();
    this.threeDViews();
    await yieldTo();
    this.threeDIsolines();
    await yieldTo();
    for (const room of this.input.scene.rooms) {
      this.roomSummaryProperties(room);
      this.roomSummaryResults(room);
      this.roomWorkingPlane(room);
      await yieldTo();
    }
    this.productSheets();
    await yieldTo();
    this.scheduleAppendix();
    this.finishPage("Luminaire schedule");
    return this.doc;
  }

  private buildSync(): jsPDF {
    this.applyFonts(loadReportFontsSync());
    this.cover();
    this.contents();
    this.projectSummary();
    this.luminaireList();
    this.roomList();
    this.calculationObjects();
    this.lightingPlan();
    this.threeDViews();
    this.threeDIsolines();
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
    const pageW = this.pageWidth();
    setReportRgb(doc, "fill", ACCENT);
    doc.rect(0, 0, pageW, 8, "F");
    this.font("bold", TYPE.coverKicker);
    setReportRgb(doc, "text", ACCENT);
    doc.text("LUXSIM", MARGIN, 28);
    this.font("bold", TYPE.coverTitle);
    setReportRgb(doc, "text", INK);
    doc.text("Lighting Report", MARGIN, 48);
    this.font("normal", TYPE.coverProject);
    doc.text(input.projectName, MARGIN, 64, { maxWidth: CONTENT_W });
    setReportRgb(doc, "draw", HEADER_LINE);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, 72, pageW - MARGIN, 72);
    doc.setLineWidth(0.2);
    this.font("normal", TYPE.body);
    setReportRgb(doc, "text", INK);
    let y = 86;
    if (input.orgName?.trim()) {
      doc.text(`Organization  ${input.orgName.trim()}`, MARGIN, y);
      y += 7;
    }
    doc.text(`Date  ${date}`, MARGIN, y);
    y += 7;
    if (input.luxsimVersion) {
      doc.text(`Generated with LUXSIM ${input.luxsimVersion}`, MARGIN, y);
      y += 7;
    } else {
      doc.text("Generated with LUXSIM", MARGIN, y);
      y += 7;
    }
    const shareUrl = input.shareUrl?.trim();
    if (shareUrl) {
      y += 14;
      const qrSize = 42;
      drawQrCode(doc, shareUrl, MARGIN, y, qrSize);
      this.font("bold", TYPE.body);
      doc.text("View this project", MARGIN + qrSize + 8, y + 8);
      this.font("normal", TYPE.caption);
      setReportRgb(doc, "text", MUTED);
      doc.text("Open the link or scan the QR code to browse. Editing is not allowed.", MARGIN + qrSize + 8, y + 16, {
        maxWidth: CONTENT_W - qrSize - 8,
      });
      this.font("normal", TYPE.body);
      setReportRgb(doc, "text", INK);
      const urlLines = doc.splitTextToSize(shareUrl, CONTENT_W - qrSize - 8) as string[];
      doc.text(urlLines, MARGIN + qrSize + 8, y + 26);
      y += Math.max(qrSize, 26 + urlLines.length * 5) + 8;
    }
    this.font("normal", TYPE.caption);
    setReportRgb(doc, "text", MUTED);
    doc.text(DESIGN_ASSIST_DISCLAIMER, MARGIN, Math.max(y + 10, 200), { maxWidth: CONTENT_W });
    setReportRgb(doc, "text", INK);
    this.font("normal", TYPE.body);
    this.page = 1;
    this.finishPage("Cover");
  }

  private contents() {
    this.addReportPage();
    this.page = 2;
    let y = this.pageHeader("Contents");
    this.font("normal", TYPE.body);
    setReportRgb(this.doc, "text", INK);
    const items = [
      "Project summary",
      "Luminaire list",
      "Room list",
      "Calculation objects",
      "Lighting Plan",
      ...(this.hasProject3dViews() ? (["3D views"] as const) : []),
      ...(this.hasProject3dIsolines() ? (["3D Isolines"] as const) : []),
      "Per-room summary and working plane",
      "Product sheets",
      "Luminaire schedule",
    ];
    items.forEach((label, i) => {
      const rowY = y + i * 8;
      this.doc.text(`${i + 1}. ${label}`, MARGIN, rowY);
    });
    this.finishPage("Contents");
  }

  private projectSummary() {
    this.addReportPage();
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
    this.doc.setFontSize(TYPE.body);
    lines.forEach((t, i) => {
      this.doc.text(t, MARGIN, y + i * 7);
    });
    this.finishPage("Project summary");
  }

  private luminaireList() {
    this.addReportPage();
    this.page += 1;
    let y = this.pageHeader("Luminaire list");
    const { scene, photometry, wattsById } = this.input;
    const rows = aggregateProjectLuminaires(scene, photometry, wattsById);
    const totals = projectTotals(rows);
    this.doc.setFontSize(TYPE.body);
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
      this.doc.setFontSize(TYPE.table);
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
    this.doc.setFontSize(TYPE.table);
    this.font("bold");
    let x = MARGIN;
    this.doc.setFillColor(236, 236, 236);
    this.doc.rect(MARGIN, y - 4, CONTENT_W, 7, "F");
    for (const c of cols) {
      this.doc.text(c.label, x + 1, y);
      x += c.w;
    }
    this.font("normal");
    y += 6;
    for (const row of rows) {
      const flux = row.flux != null ? `${Math.round(row.flux)} lm` : "—";
      const eff = row.efficacy != null ? row.efficacy.toFixed(1) : "—";
      const cells = [
        officialTableCellLines(this.doc, String(row.count), cols[0].w - 2),
        officialTableCellLines(this.doc, row.manufacturer || "—", cols[1].w - 2),
        officialTableCellLines(this.doc, row.catalogNumber || "—", cols[2].w - 2),
        officialTableCellLines(this.doc, row.articleName || "—", cols[3].w - 2),
        officialTableCellLines(this.doc, flux, cols[4].w - 2),
        officialTableCellLines(this.doc, formatWatts(row.watts), cols[5].w - 2),
        officialTableCellLines(this.doc, eff, cols[6].w - 2),
      ];
      const rowH = officialTableRowHeight(Math.max(...cells.map((c) => c.length)));
      y = this.ensureY(y, rowH, "Luminaire list");
      x = MARGIN;
      this.doc.setDrawColor(220);
      this.doc.line(MARGIN, y + rowH - 2, PAGE_W - MARGIN, y + rowH - 2);
      cells.forEach((lines, i) => {
        this.doc.text(lines, x + 1, y);
        x += cols[i]!.w;
      });
      y += rowH;
    }
    this.finishPage("Luminaire list");
  }

  private roomList() {
    this.addReportPage();
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
      this.doc.setFontSize(TYPE.body);
      this.font("bold");
      this.doc.text(room.name.toUpperCase(), MARGIN, y);
      this.font("normal");
      y += 7;
      this.doc.setFontSize(TYPE.caption);
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
    this.addReportPage();
    this.page += 1;
    let y = this.pageHeader("Calculation objects", "Working planes and wall surfaces");
    const { scene, results } = this.input;
    this.doc.setFontSize(TYPE.caption);
    this.font("bold");
    this.doc.text(
      "Workplane  Type  Height  Wall zone  Eavg  Emin  Emax  Uo (g1)  g2",
      MARGIN,
      y
    );
    this.font("normal");
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

    const hasWalls = scene.rooms.some((room) => (results.wallsByRoomId?.[room.id] ?? []).length > 0);
    if (hasWalls) {
      y += 4;
      y = this.ensureY(y, 16, "Calculation objects");
      this.doc.setFontSize(TYPE.body);
      this.font("bold");
      this.doc.text("Wall surfaces — vertical illuminance", MARGIN, y);
      y += 6;
      const wallCols = [MARGIN, 92, 108, 124, 138, 154, 170, 186];
      const wallHeads = ["Surface", "Width", "Height", "Inset", "Eavg", "Emin", "Emax", "Uo"];
      const paintWallHeader = (at: number) => {
        this.doc.setFontSize(TYPE.table);
        this.font("bold");
        wallHeads.forEach((h, i) => this.doc.text(h, wallCols[i]!, at));
        this.font("normal");
        return at + 4.5;
      };
      y = paintWallHeader(y);
      for (const room of scene.rooms) {
        const walls = results.wallsByRoomId?.[room.id] ?? [];
        for (const w of walls) {
          const pageBefore = this.page;
          y = this.ensureY(y, 5, "Calculation objects");
          if (this.page !== pageBefore) y = paintWallHeader(y);
          this.doc.setFontSize(TYPE.table);
          this.font("normal");
          const name = w.name.length > 36 ? `${w.name.slice(0, 35)}…` : w.name;
          const cells = [
            name,
            `${w.widthM.toFixed(2)} m`,
            `${w.heightM.toFixed(2)} m`,
            `${w.insetM.toFixed(2)} m`,
            formatLux(w.summary.eave),
            formatLux(w.summary.emin),
            formatLux(w.summary.emax),
            w.summary.uo.toFixed(2),
          ];
          cells.forEach((c, i) => this.doc.text(c, wallCols[i]!, y));
          y += 4.4;
        }
      }
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

  private projectGreyscale(): string | undefined {
    return this.input.projectPerspectiveGreyscale ?? this.input.projectPerspectiveSnapshot;
  }

  private projectFalseColor(): string | undefined {
    return this.input.projectPerspectiveFalseColor;
  }

  private hasProject3dViews(): boolean {
    return Boolean(this.projectGreyscale() || this.projectFalseColor());
  }

  private roomGreyscale(roomId: string): string | undefined {
    return this.input.persp3dGreyscale?.[roomId] ?? this.input.persp3dSnapshots?.[roomId];
  }

  private roomFalseColor(roomId: string): string | undefined {
    return this.input.persp3dFalseColor?.[roomId];
  }

  private threeDViews() {
    const grey = this.projectGreyscale();
    const color = this.projectFalseColor();
    if (!grey && !color) return;
    this.addReportPage("landscape");
    this.page += 1;
    let y = this.pageHeader("3D views");
    const contentW = this.contentWidth();
    const gap = 6;
    const colW = (contentW - gap) / 2;
    const footerTop = this.footerY() - 12;
    const { emin, emax } = this.projectRange();
    const legendH = 16;
    const labelH = 6;
    const imgMaxH = Math.max(40, footerTop - y - labelH - legendH - 8);
    this.doc.setFontSize(TYPE.body);
    this.font("bold");
    let imgBottom = y + 3;
    if (grey) {
      this.doc.text("3D greyscale", MARGIN, y);
      imgBottom = Math.max(imgBottom, this.drawFittedImage(grey, MARGIN, y + 3, colW, imgMaxH));
    }
    if (color) {
      const x = MARGIN + colW + gap;
      this.doc.text("3D false colour", x, y);
      imgBottom = Math.max(imgBottom, this.drawFittedImage(color, x, y + 3, colW, imgMaxH));
    }
    this.font("normal");
    this.drawLuxLegend(Math.min(imgBottom + 5, footerTop - legendH), emin, emax);
    this.finishPage("3D views");
  }

  private projectIsolines(): string | undefined {
    return this.input.projectPerspectiveIsolines;
  }

  private hasProject3dIsolines(): boolean {
    return Boolean(this.projectIsolines());
  }

  private roomIsolines(roomId: string): string | undefined {
    return this.input.persp3dIsolines?.[roomId];
  }

  private threeDIsolines() {
    const isolines = this.projectIsolines();
    if (!isolines) return;
    this.addReportPage("landscape");
    this.page += 1;
    const y = this.pageHeader("3D Isolines");
    const contentW = this.contentWidth();
    const footerTop = this.footerY() - 12;
    const labelH = 6;
    const imgMaxH = Math.max(40, footerTop - y - labelH - 8);
    this.doc.setFontSize(TYPE.body);
    this.font("bold");
    this.doc.text("3D isolines", MARGIN, y);
    this.font("normal");
    this.drawFittedImage(isolines, MARGIN, y + 3, contentW, imgMaxH);
    this.finishPage("3D Isolines");
  }

  private projectRange(): { emin: number; emax: number } {
    let emin = Infinity;
    let emax = -Infinity;
    for (const res of Object.values(this.input.results.byRoomId)) {
      if (!res) continue;
      emin = Math.min(emin, res.summary.emin);
      emax = Math.max(emax, res.summary.emax);
    }
    if (!Number.isFinite(emin) || !Number.isFinite(emax)) return { emin: 56, emax: 500 };
    return { emin, emax };
  }

  private roomSummaryProperties(room: RoomV2) {
    const ctx = roomContextLabel(this.input.projectName, this.input.scene, room);
    this.addReportPage("portrait");
    this.page += 1;
    let y = this.pageHeader("Summary", ctx);
    const area = roomPolygonArea(room);
    const mount = typicalMountingHeightM(room.id, this.input.scene);
    const mf = roomMaintenanceFactor(room);
    const res = this.input.results.byRoomId[room.id];
    this.doc.setFontSize(TYPE.body);
    const left = [
      `Ground area: ${formatAreaM2(area)}`,
      `Reflection factors — Ceiling: ${formatReflectancePct(room.reflectance.ceiling)} · Walls: ${formatReflectancePct(room.reflectance.walls)} · Floor: ${formatReflectancePct(room.reflectance.floor)}`,
      `Maintenance factor: ${mf.toFixed(2)}`,
    ];
    if (res) {
      left.push(`Maintained Em: ${formatLux(maintainedAverageLux(res.summary.eave, mf))}`);
    }
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
    if (left[3]) {
      this.doc.text(left[3]!, MARGIN, y);
    }
    this.doc.text(right[2]!, MARGIN + 95, y);
    y += 7;
    this.doc.text(right[3]!, MARGIN + 95, y);
    y += 10;

    const isolux = this.input.isoluxSnapshots?.[room.id];
    const grey = this.roomGreyscale(room.id);
    const color = this.roomFalseColor(room.id);
    const isolines = this.roomIsolines(room.id);
    const has3d = Boolean(grey || color);
    const has3dIsolines = Boolean(isolines);
    if (isolux) {
      this.doc.setFontSize(TYPE.body);
      this.doc.text("Working plane — isolux diagram", MARGIN, y);
      const isoluxH = has3d || has3dIsolines ? 92 : 150;
      y = this.drawFittedImage(isolux, MARGIN, y + 3, CONTENT_W, isoluxH) + 4;
    }

    if (has3d) {
      y = this.ensureY(y, 70, "Summary", ctx);
      this.doc.setFontSize(TYPE.body);
      this.font("bold");
      const colW = 82;
      if (grey) {
        this.doc.text("3D greyscale", MARGIN, y);
        this.drawFittedImage(grey, MARGIN, y + 3, colW, 56);
      }
      if (color) {
        this.doc.text("3D false colour", MARGIN + 90, y);
        this.drawFittedImage(color, MARGIN + 90, y + 3, colW, 56);
      }
      this.font("normal");
      y += 62;
    }

    if (isolines) {
      y = this.ensureY(y, 70, "Summary", ctx);
      this.doc.setFontSize(TYPE.body);
      this.font("bold");
      this.doc.text("3D isolines", MARGIN, y);
      this.font("normal");
      y = this.drawFittedImage(isolines, MARGIN, y + 3, 82, 56) + 4;
    }

    const plan = this.input.planSnapshots?.[room.id];
    if (plan) {
      y = this.ensureY(y, 70, "Summary", ctx);
      this.doc.setFontSize(TYPE.body);
      this.doc.text("Plan view", MARGIN, y);
      y = this.drawFittedImage(plan, MARGIN, y + 3, 80, 55) + 4;
    }
    this.finishPage("Summary", ctx);
  }

  private roomSummaryResults(room: RoomV2) {
    const ctx = roomContextLabel(this.input.projectName, this.input.scene, room);
    this.addReportPage();
    this.page += 1;
    let y = this.pageHeader("Summary — Results", ctx);
    const res = this.input.results.byRoomId[room.id];
    this.doc.setFontSize(TYPE.body);
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
    const mf = roomMaintenanceFactor(room);
    const rows = [
      `E perpendicular (working plane): ${formatLux(summary.eave)}`,
      `Maintained Em: ${formatLux(maintainedAverageLux(summary.eave, mf))}`,
      `Uo (g1): ${summary.uo.toFixed(2)}`,
      `Lighting power density: ${formatLpd(lpd)} (= ${formatLpdPer100Lx(lpd, summary.eave)} working plane)`,
      `Room lighting power density: ${formatLpd(lpd)} (= ${formatLpdPer100Lx(lpd, summary.eave)} room)`,
    ];
    if (summary.ugr != null) {
      rows.push(`UGR: ${summary.ugr.toFixed(1)}`);
    }
    this.font("bold");
    this.doc.text("Results", MARGIN, y);
    this.font("normal");
    y += 8;
    rows.forEach((t, i) => {
      this.doc.text(t, MARGIN, y + i * 7);
    });
    y += rows.length * 7 + 6;
    const walls = this.input.results.wallsByRoomId?.[room.id] ?? [];
    if (walls.length) {
      y = this.ensureY(y, 16, "Summary — Results", ctx);
      this.font("bold");
      this.doc.setFontSize(TYPE.body);
      this.doc.text("Wall surfaces — vertical illuminance", MARGIN, y);
      y += 6;
      const wallCols = [MARGIN, 88, 112, 132, 152, 172];
      const wallHeads = ["Surface", "Eavg", "Emin", "Emax", "Uo"];
      const paintWallHeader = (at: number) => {
        this.doc.setFontSize(TYPE.table);
        this.font("bold");
        wallHeads.forEach((h, i) => this.doc.text(h, wallCols[i]!, at));
        this.font("normal");
        return at + 4.5;
      };
      y = paintWallHeader(y);
      for (const w of walls) {
        const pageBefore = this.page;
        y = this.ensureY(y, 5, "Summary — Results", ctx);
        if (this.page !== pageBefore) y = paintWallHeader(y);
        this.doc.setFontSize(TYPE.table);
        this.font("normal");
        const label = w.name.replace(` (${room.name})`, "");
        const short = label.length > 34 ? `${label.slice(0, 33)}…` : label;
        const cells = [
          short,
          formatLux(w.summary.eave),
          formatLux(w.summary.emin),
          formatLux(w.summary.emax),
          w.summary.uo.toFixed(2),
        ];
        cells.forEach((c, i) => this.doc.text(c, wallCols[i]!, y));
        y += 4.4;
      }
      y += 4;
    }
    this.font("bold");
    this.doc.setFontSize(TYPE.body);
    this.doc.text("Luminaire list", MARGIN, y);
    this.font("normal");
    y += 7;
    this.doc.setFontSize(TYPE.caption);
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
    this.addReportPage();
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

    this.doc.setFontSize(TYPE.body);
    this.font("bold");
    this.doc.text("Properties", MARGIN, y);
    this.font("normal");
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
    this.doc.setFontSize(TYPE.table);
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
    this.doc.setFontSize(TYPE.caption);
    x = startX;
    values.forEach((v, i) => {
      this.doc.text(v, x, y);
      x += colW[i + 1] ?? 28;
    });
    y += 6;
    this.doc.setFontSize(TYPE.table);
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
      this.addReportPage();
      this.page += 1;
      this.font("normal");
      let y = this.pageHeader("Product sheet");
      const body = luminaireBody(photo);
      const flux = resolvedFlux(photo);
      const watts = photo.watts;
      const efficacy = flux != null && watts != null && watts > 0 ? flux / watts : null;
      const cct = formatCct(photo);

      const title = photo.description || photo.catalogNumber || lid;
      const titleLines = this.doc.splitTextToSize(title, this.contentWidth()) as string[];
      this.font("bold", TYPE.subhead);
      setReportRgb(this.doc, "text", INK);
      this.doc.text(titleLines, MARGIN, y);
      y += Math.max(8, titleLines.length * 5.5) + 4;

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

      const { gap, symbolW, tableW } = officialProductSheetColumns(this.contentWidth());
      const labelW = 62;
      const valueW = tableW - labelW - 4;
      this.font("normal", TYPE.table);
      const sheetRows = props.map(([k, v]) => {
        this.font("normal", TYPE.table);
        const keyLines = officialTableCellLines(this.doc, k, labelW - 4);
        this.font("bold", TYPE.table);
        const valueLines = officialTableCellLines(this.doc, v, valueW);
        return {
          keyLines,
          valueLines,
          h: officialTableRowHeight(Math.max(keyLines.length, valueLines.length)),
        };
      });
      const tableH = sheetRows.reduce((sum, row) => sum + row.h, 0);
      const symbolH = Math.max(tableH, 48);
      const tableRight = MARGIN + tableW;
      const symbolX = tableRight + gap;
      const symbolY = y - 4.5;
      let rowTop = symbolY;

      setReportRgb(this.doc, "draw", RULE);
      sheetRows.forEach((row, i) => {
        if (i % 2 === 0) {
          setReportRgb(this.doc, "fill", TABLE_ALT);
          this.doc.rect(MARGIN, rowTop, tableW, row.h, "F");
        }
        this.doc.rect(MARGIN, rowTop, tableW, row.h);
        const baseline = rowTop + 4.5;
        this.font("normal", TYPE.table);
        setReportRgb(this.doc, "text", MUTED);
        this.doc.text(row.keyLines, MARGIN + 2, baseline);
        this.font("bold", TYPE.table);
        setReportRgb(this.doc, "text", INK);
        this.doc.text(row.valueLines, MARGIN + labelW, baseline);
        rowTop += row.h;
      });

      const scaleLabel = drawPlanSymbol(this.doc, body, symbolX, symbolY, symbolW, symbolH);
      this.font("normal", TYPE.caption);
      setReportRgb(this.doc, "text", MUTED);
      this.doc.text(scaleLabel, symbolX + symbolW / 2, symbolY + symbolH - 3, { align: "center" });
      setReportRgb(this.doc, "text", INK);

      y += symbolH + 10;
      this.font("bold", TYPE.subhead);
      this.doc.text("Luminous intensity distribution", MARGIN, y);
      y += 6;
      drawPolar(this.doc, photo, MARGIN + (this.contentWidth() - 120) / 2, y, 120, this.fontName);
      this.finishPage("Product sheet");
    }
  }

  private scheduleAppendix() {
    this.addReportPage();
    this.page += 1;
    this.font("normal");
    let y = this.pageHeader("Luminaire schedule");
    const cols: { key: string; label: string; w: number; align?: "left" | "right" }[] = [
      { key: "n", label: "#", w: 10, align: "right" },
      { key: "name", label: "Name", w: 32 },
      { key: "storey", label: "Storey", w: 26 },
      { key: "room", label: "Room", w: 32 },
      { key: "x", label: "X", w: 18, align: "right" },
      { key: "y", label: "Y", w: 18, align: "right" },
      { key: "z", label: "Z", w: 16, align: "right" },
      { key: "rot", label: "Rot", w: 18, align: "right" },
    ];
    const tableW = cols.reduce((s, c) => s + c.w, 0);
    const rowH = 6.4;
    const drawHead = (top: number) => {
      setReportRgb(this.doc, "fill", TABLE_HEAD);
      setReportRgb(this.doc, "draw", RULE);
      this.doc.rect(MARGIN, top - 4.4, tableW, rowH, "FD");
      this.font("bold", TYPE.table);
      setReportRgb(this.doc, "text", INK);
      let x = MARGIN;
      for (const c of cols) {
        const tx = c.align === "right" ? x + c.w - 1.5 : x + 1.5;
        this.doc.text(c.label, tx, top, { align: c.align === "right" ? "right" : "left" });
        x += c.w;
      }
      return top + rowH;
    };
    y = drawHead(y);
    this.input.scene.instances.forEach((inst, idx) => {
      const storey = this.input.scene.storeys.find((s) => s.id === inst.storeyId)?.name ?? "—";
      const room = this.input.scene.rooms.find((r) => r.id === inst.roomId)?.name ?? "—";
      const values = [
        String(idx + 1),
        inst.name || "—",
        storey,
        room,
        inst.position.x.toFixed(2),
        inst.position.y.toFixed(2),
        inst.position.z.toFixed(2),
        inst.rotationDeg.toFixed(0),
      ];
      this.font("normal", TYPE.table);
      const wrapped = values.map((value, i) => officialTableCellLines(this.doc, value, cols[i]!.w - 3));
      const needed = officialTableRowHeight(Math.max(...wrapped.map((lines) => lines.length)));
      const before = y;
      y = this.ensureY(y, needed + 2, "Luminaire schedule");
      if (y !== before) y = drawHead(y);
      if (idx % 2 === 0) {
        setReportRgb(this.doc, "fill", TABLE_ALT);
        this.doc.rect(MARGIN, y - 4.4, tableW, needed, "F");
      }
      setReportRgb(this.doc, "draw", RULE);
      this.doc.rect(MARGIN, y - 4.4, tableW, needed);
      this.font("normal", TYPE.table);
      setReportRgb(this.doc, "text", INK);
      let x = MARGIN;
      wrapped.forEach((lines, i) => {
        const c = cols[i]!;
        const tx = c.align === "right" ? x + c.w - 1.5 : x + 1.5;
        this.doc.text(lines, tx, y, { align: c.align === "right" ? "right" : "left" });
        x += c.w;
      });
      y += needed;
    });
  }
}

export function buildFullReportPdf(input: ReportInput): jsPDF {
  return new ReportPdfBuilder(input).build();
}

/** Same official report as `buildFullReportPdf`, yielding between chapters and rooms. */
export async function buildFullReportPdfAsync(
  input: ReportInput,
  yieldTo: () => Promise<void> = () => Promise.resolve()
): Promise<jsPDF> {
  return new ReportPdfBuilder(input).buildAsync(yieldTo);
}

function drawPlanSymbol(
  doc: jsPDF,
  body: ReturnType<typeof luminaireBody>,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
): string {
  setReportRgb(doc, "fill", TABLE_ALT);
  setReportRgb(doc, "draw", RULE);
  doc.rect(boxX, boxY, boxW, boxH, "FD");
  const captionH = 6;
  const pad = 3;
  const innerW = Math.max(boxW - pad * 2, 4);
  const innerH = Math.max(boxH - pad * 2 - captionH, 4);
  const widthM = Math.max(body.widthM, 0.001);
  const lengthM = Math.max(body.lengthM, 0.001);
  // Prefer 1:5 when the fixture fits; otherwise tighten the scale so the
  // symbol stays inside this box and never overlays the product table.
  const naturalW = widthM * (1000 / 5);
  const naturalH = lengthM * (1000 / 5);
  const fit = Math.min(innerW / naturalW, innerH / naturalH, 1);
  const scaleDenom = fit >= 1 ? 5 : Math.max(6, Math.ceil(5 / Math.max(fit, 0.01)));
  const paperMmPerM = 1000 / scaleDenom;
  const rx = Math.min((widthM / 2) * paperMmPerM, innerW / 2);
  const ry = Math.min((lengthM / 2) * paperMmPerM, innerH / 2);
  const cx = boxX + boxW / 2;
  const cy = boxY + pad + innerH / 2;
  const black = body.housing === "black";
  doc.setDrawColor(40);
  doc.setFillColor(black ? 45 : 230, black ? 45 : 228, black ? 48 : 222);
  if (body.isCircular) {
    const r = Math.min(Math.max(rx, ry), innerW / 2, innerH / 2);
    doc.circle(cx, cy, r, "FD");
    doc.setFillColor(243, 226, 176);
    doc.circle(cx, cy, r * 0.62, "F");
  } else {
    doc.rect(cx - rx, cy - ry, rx * 2, ry * 2, "FD");
  }
  return `Plan symbol  1:${scaleDenom}`;
}

function strokeChain(doc: jsPDF, points: { x: number; y: number }[], dashed: boolean) {
  if (points.length < 2) return;
  doc.setLineDashPattern(dashed ? [1.2, 1.0] : [], 0);
  for (let i = 1; i < points.length; i += 1) {
    doc.line(points[i - 1]!.x, points[i - 1]!.y, points[i]!.x, points[i]!.y);
  }
  doc.setLineDashPattern([], 0);
}

function drawPolar(doc: jsPDF, photo: PhotometricData, x: number, y: number, size = 120, fontName = "helvetica") {
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
  doc.setFont(fontName, "normal");
  doc.setFontSize(TYPE.caption);
  setReportRgb(doc, "text", MUTED);
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
  doc.setFontSize(TYPE.caption);
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
