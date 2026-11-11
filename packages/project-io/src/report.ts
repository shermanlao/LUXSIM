import { jsPDF } from "jspdf";
import type { PhotometricData } from "../../photometry/src/types";
import { polarPreview } from "../../photometry/src/interpolate";
import type { ProjectSceneV2, ResultsV2 } from "./types";
import { roomAreaM2 } from "./geometry";
import { drawFalseColorOnPdf, drawRoomPlanOnPdf } from "./plan-render";
import {
  drawRoomPerspective3dOnPdf,
  drawStoreyPerspective3dOnPdf,
} from "./view-3d-render";

export interface ReportInput {
  projectName: string;
  orgName?: string;
  scene: ProjectSceneV2;
  results: ResultsV2;
  photometry: Record<string, PhotometricData>;
  wattsById?: Record<string, number | null | undefined>;
  /** Optional pre-rendered PNGs keyed by roomId (browser snapshots). */
  falseColorSnapshots?: Record<string, string>;
  /** Optional WebGL PNG snapshots keyed by storeyId / roomId (browser export). */
  threeDSnapshots?: {
    byStoreyId?: Record<string, string>;
    byRoomId?: Record<string, string>;
  };
}

export interface ReportSectionPlan {
  tocEntries: string[];
  productSheetIds: string[];
  hasProductSection: boolean;
}

export function planReportSections(input: ReportInput): ReportSectionPlan {
  const usedIds = [...new Set(input.scene.instances.map((i) => i.luminaireId))];
  const libraryIds = input.scene.fixtureLibraryIds;
  const candidateIds = usedIds.length ? usedIds : libraryIds;
  const productSheetIds = candidateIds.filter((id) => Boolean(input.photometry[id]));
  const hasProductSection = productSheetIds.length > 0;

  const tocEntries = [
    "1. Project summary",
    "2. Room results",
    ...(hasProductSection ? ["3. Product sheets"] : []),
    `${hasProductSection ? "4" : "3"}. Luminaire schedule appendix`,
  ];

  return { tocEntries, productSheetIds, hasProductSection };
}

export function buildFullReportPdf(input: ReportInput): jsPDF {
  const doc = new jsPDF();
  const date = new Date().toLocaleDateString();
  const { tocEntries, productSheetIds, hasProductSection } = planReportSections(input);
  let page = 1;

  // Cover
  doc.setFontSize(22);
  doc.text("LUXSIM Lighting Report", 20, 40);
  doc.setFontSize(16);
  doc.text(input.projectName, 20, 55);
  doc.setFontSize(11);
  doc.text(`Organization: ${input.orgName?.trim() || "—"}`, 20, 70);
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
  tocEntries.forEach((t, i) => doc.text(t, 20, 35 + i * 8));
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

  let summaryY = 35 + lines.length * 7 + 8;
  for (const storey of input.scene.storeys) {
    const roomsOnStorey = input.scene.rooms.filter((r) => r.storeyId === storey.id);
    if (!roomsOnStorey.length) continue;
    if (summaryY > 210) {
      footer(doc, page++);
      doc.addPage();
      summaryY = 25;
    }
    doc.setFontSize(11);
    doc.text(`3D perspective — storey ${storey.name}`, 20, summaryY);
    summaryY += 5;
    const snap = input.threeDSnapshots?.byStoreyId?.[storey.id];
    const box = { x: 20, y: summaryY, w: 170, h: 55 };
    if (snap) {
      try {
        doc.addImage(snap, "PNG", box.x, box.y, box.w, box.h);
      } catch {
        drawStoreyPerspective3dOnPdf(doc, input.scene, storey.id, box);
      }
    } else {
      drawStoreyPerspective3dOnPdf(doc, input.scene, storey.id, box);
    }
    summaryY += box.h + 4;
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      snap
        ? "Shaded WebGL capture from export (design-assist illustration, not CAD)."
        : "Vector perspective from room geometry (no WebGL snapshot in this build).",
      20,
      summaryY,
      { maxWidth: 170 }
    );
    doc.setTextColor(0);
    summaryY += 8;
  }

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

    doc.setFontSize(11);
    doc.text("Plan (fixtures)", 20, 48);
    drawRoomPlanOnPdf(doc, room, input.scene.instances, { x: 20, y: 52, w: 75, h: 55 });

    doc.setFontSize(11);
    doc.text("3D perspective", 105, 48);
    const room3dSnap = input.threeDSnapshots?.byRoomId?.[room.id];
    const room3dBox = { x: 105, y: 52, w: 85, h: 55 };
    if (room3dSnap) {
      try {
        doc.addImage(room3dSnap, "PNG", room3dBox.x, room3dBox.y, room3dBox.w, room3dBox.h);
      } catch {
        drawRoomPerspective3dOnPdf(doc, input.scene, room, room3dBox);
      }
    } else {
      drawRoomPerspective3dOnPdf(doc, input.scene, room, room3dBox);
    }

    const res = input.results.byRoomId[room.id];
    let y = 112;
    doc.setFontSize(12);
    doc.text("Results", 20, y);
    y += 8;
    doc.setFontSize(10);
    if (!res) {
      doc.text("Not calculated — run Calculate in LUXSIM", 20, y);
      y += 10;
    } else {
      const s = res.summary;
      if (input.scene.instances.filter((i) => i.roomId === room.id).length === 0) {
        doc.text("No luminaires in this room (0 lx workplane).", 20, y);
        y += 6;
      }
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
      y += 6;
      doc.text(`Calculated ${res.meta.calculatedAt} (client-side)`, 20, y);
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
    if (res) {
      if (y > 155) {
        footer(doc, page++);
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.text("False-color workplane", 20, y);
      y += 5;
      if (snap) {
        try {
          doc.addImage(snap, "PNG", 105, y - 2, 85, 48);
        } catch {
          drawFalseColorOnPdf(doc, room, res, { x: 105, y: y + 2, w: 85, h: 48 });
        }
      } else {
        drawFalseColorOnPdf(doc, room, res, { x: 20, y: y + 2, w: 170, h: 55 });
        y += 58;
      }
    }
    footer(doc, page++);
  }

  // Product sheets
  for (const lid of productSheetIds) {
    const photo = input.photometry[lid]!;
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
  doc.text(
    `${hasProductSection ? "4" : "3"}. Global luminaire schedule`,
    20,
    20
  );
  doc.setFontSize(9);
  let y = 30;
  if (!input.scene.instances.length) {
    doc.text("No luminaire instances placed.", 20, y);
    y += 8;
  } else {
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
  }
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
