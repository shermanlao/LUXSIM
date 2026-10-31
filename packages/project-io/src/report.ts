import { jsPDF } from "jspdf";
import type { PhotometricData } from "../../photometry/src/types";
import { polarPreview } from "../../photometry/src/interpolate";
import type { ProjectSceneV2, ResultsV2 } from "./types";
import { roomAreaM2 } from "./geometry";

export interface ReportInput {
  projectName: string;
  orgName?: string;
  scene: ProjectSceneV2;
  results: ResultsV2;
  photometry: Record<string, PhotometricData>;
  wattsById?: Record<string, number | null | undefined>;
  /** data URLs keyed by roomId */
  falseColorSnapshots?: Record<string, string>;
}

export function buildFullReportPdf(input: ReportInput): jsPDF {
  const doc = new jsPDF();
  const date = new Date().toLocaleDateString();
  let page = 1;

  // Cover
  doc.setFontSize(22);
  doc.text("LUXSIM Lighting Report", 20, 40);
  doc.setFontSize(16);
  doc.text(input.projectName, 20, 55);
  doc.setFontSize(11);
  doc.text(`Organization: ${input.orgName ?? "—"}`, 20, 70);
  doc.text(`Date: ${date}`, 20, 78);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    "Design-assist only. Not tender-certified. Verify critical projects in DIALux or equivalent.",
    20,
    95,
    { maxWidth: 170 }
  );
  doc.setTextColor(0);
  footer(doc, page++);

  // Contents
  doc.addPage();
  doc.setFontSize(16);
  doc.text("Contents", 20, 20);
  doc.setFontSize(11);
  const toc = [
    "1. Project summary",
    "2. Room results",
    "3. Product sheets",
    "4. Luminaire schedule appendix",
  ];
  toc.forEach((t, i) => doc.text(t, 20, 35 + i * 8));
  footer(doc, page++);

  // Summary
  doc.addPage();
  doc.setFontSize(16);
  doc.text("1. Project summary", 20, 20);
  doc.setFontSize(10);
  const totalArea = input.scene.rooms.reduce((s, r) => s + roomAreaM2(r), 0);
  let totalW = 0;
  for (const inst of input.scene.instances) {
    const w =
      input.wattsById?.[inst.luminaireId] ??
      input.photometry[inst.luminaireId]?.watts;
    if (w) totalW += w;
  }
  const lines = [
    `Storeys: ${input.scene.storeys.length}`,
    `Rooms: ${input.scene.rooms.length}`,
    `Fixture instances: ${input.scene.instances.length}`,
    `Distinct products in library: ${input.scene.fixtureLibraryIds.length}`,
    `Total floor area (rooms): ${totalArea.toFixed(1)} m²`,
    `Installed power (known): ${totalW.toFixed(0)} W`,
  ];
  lines.forEach((t, i) => doc.text(t, 20, 35 + i * 7));
  footer(doc, page++);

  // Per room
  for (const room of input.scene.rooms) {
    doc.addPage();
    doc.setFontSize(14);
    doc.text(`2. Room — ${room.name}`, 20, 20);
    doc.setFontSize(10);
    const storey = input.scene.storeys.find((s) => s.id === room.storeyId);
    doc.text(`Storey: ${storey?.name ?? "—"} · Area ${roomAreaM2(room).toFixed(1)} m²`, 20, 30);
    doc.text(
      `Height ${room.heightM.toFixed(2)} m · Workplane ${room.workplaneHeightM.toFixed(2)} m`,
      20,
      37
    );

    const res = input.results.byRoomId[room.id];
    let y = 50;
    doc.setFontSize(12);
    doc.text("Results", 20, y);
    y += 8;
    doc.setFontSize(10);
    if (!res) {
      doc.text("Not calculated", 20, y);
      y += 10;
    } else {
      const s = res.summary;
      doc.text(`Eave ${s.eave.toFixed(1)} lx`, 20, y);
      y += 6;
      doc.text(
        `Emin ${s.emin.toFixed(1)} lx · Emax ${s.emax.toFixed(1)} lx · Uo ${s.uo.toFixed(2)}`,
        20,
        y
      );
      y += 6;
      doc.text(
        `UGR ${s.ugr != null ? s.ugr.toFixed(1) : "—"} · LPD ${s.lpd != null ? s.lpd.toFixed(2) : "—"} W/m²`,
        20,
        y
      );
      y += 10;
    }

    doc.setFontSize(12);
    doc.text("Luminaire schedule", 20, y);
    y += 7;
    doc.setFontSize(9);
    const roomInst = input.scene.instances.filter((i) => i.roomId === room.id);
    if (!roomInst.length) {
      doc.text("(none)", 20, y);
      y += 8;
    }
    for (const inst of roomInst) {
      if (y > 270) {
        footer(doc, page++);
        doc.addPage();
        y = 20;
      }
      doc.text(
        `${inst.name} @ (${inst.position.x.toFixed(2)}, ${inst.position.y.toFixed(2)}, ${inst.position.z.toFixed(2)})`,
        20,
        y
      );
      y += 5;
    }

    const snap = input.falseColorSnapshots?.[room.id];
    if (snap) {
      try {
        if (y > 160) {
          footer(doc, page++);
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(12);
        doc.text("False-color workplane", 20, y);
        y += 4;
        doc.addImage(snap, "PNG", 20, y, 160, 90);
      } catch {
        /* ignore */
      }
    }
    footer(doc, page++);
  }

  // Product sheets
  const usedIds = [...new Set(input.scene.instances.map((i) => i.luminaireId))];
  for (const lid of usedIds.length ? usedIds : input.scene.fixtureLibraryIds) {
    const photo = input.photometry[lid];
    if (!photo) continue;
    doc.addPage();
    doc.setFontSize(14);
    doc.text("3. Product sheet", 20, 20);
    doc.setFontSize(11);
    doc.text(photo.description || lid, 20, 30);
    doc.setFontSize(10);
    doc.text(`Manufacturer: ${photo.manufacturer || "—"}`, 20, 40);
    doc.text(`Catalog: ${photo.catalogNumber || "—"}`, 20, 47);
    doc.text(
      `Flux: ${photo.luminousFlux != null ? `${photo.luminousFlux.toFixed(0)} lm` : "—"} · Watts: ${photo.watts != null ? `${photo.watts.toFixed(1)} W` : "—"}`,
      20,
      54
    );
    drawPolar(doc, photo, 30, 70);
    footer(doc, page++);
  }

  // Appendix schedule
  doc.addPage();
  doc.setFontSize(14);
  doc.text("4. Global luminaire schedule", 20, 20);
  doc.setFontSize(9);
  let y = 30;
  doc.text("#  Name  Storey  Room  X  Y  Z  Rot", 20, y);
  y += 6;
  input.scene.instances.forEach((inst, idx) => {
    if (y > 280) {
      footer(doc, page++);
      doc.addPage();
      y = 20;
    }
    const storey = input.scene.storeys.find((s) => s.id === inst.storeyId)?.name ?? "";
    const room = input.scene.rooms.find((r) => r.id === inst.roomId)?.name ?? "—";
    doc.text(
      `${idx + 1}  ${inst.name.slice(0, 18)}  ${storey}  ${room}  ${inst.position.x.toFixed(2)}  ${inst.position.y.toFixed(2)}  ${inst.position.z.toFixed(2)}  ${inst.rotationDeg.toFixed(0)}`,
      20,
      y
    );
    y += 5;
  });
  footer(doc, page);

  return doc;
}

function footer(doc: jsPDF, page: number) {
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(`LUXSIM · page ${page}`, 20, 290);
  doc.setTextColor(0);
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
