import { jsPDF } from "jspdf";
import {
  buildDialuxPack,
  downloadBlob,
  serializeLuxsim,
  type AnyScene,
  type LuxsimProjectFile,
  type SceneJson,
} from "@luxsim/project-io";
import type { CalcResults } from "@luxsim/solver";
import type { PhotometricData } from "@luxsim/photometry";

export function exportPdfReport(opts: {
  projectName: string;
  scene: SceneJson;
  results: CalcResults | null;
  snapshotDataUrl?: string | null;
}) {
  const doc = new jsPDF();
  const { projectName, scene, results } = opts;
  doc.setFontSize(18);
  doc.text("LUXSIM Report", 14, 20);
  doc.setFontSize(11);
  doc.text(projectName, 14, 28);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    "Design-assist only. Not tender-certified. Verify critical projects in DIALux.",
    14,
    36
  );
  doc.setTextColor(0);

  const room = scene.room;
  let y = 48;
  doc.setFontSize(12);
  doc.text("Room", 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(
    `${room.width.toFixed(2)} × ${room.depth.toFixed(2)} × ${room.height.toFixed(2)} m · workplane ${room.workplaneHeight.toFixed(2)} m`,
    14,
    y
  );
  y += 6;
  doc.text(
    `ρ floor ${room.reflectance.floor} · ceiling ${room.reflectance.ceiling} · walls ${room.reflectance.walls}`,
    14,
    y
  );

  y += 12;
  doc.setFontSize(12);
  doc.text("Results", 14, y);
  y += 7;
  doc.setFontSize(10);
  if (results) {
    const s = results.summary;
    doc.text(`Eave ${s.eave.toFixed(1)} lx`, 14, y);
    y += 5;
    doc.text(`Emin ${s.emin.toFixed(1)} lx · Emax ${s.emax.toFixed(1)} lx · Uo ${s.uo.toFixed(2)}`, 14, y);
    y += 5;
    doc.text(
      `UGR ${s.ugr != null ? s.ugr.toFixed(1) : "—"} · LPD ${s.lpd != null ? s.lpd.toFixed(2) : "—"} W/m²`,
      14,
      y
    );
    y += 5;
    doc.text(`Calculated ${results.meta.calculatedAt} (client-side)`, 14, y);
  } else {
    doc.text("No calculation results yet.", 14, y);
  }

  y += 12;
  doc.setFontSize(12);
  doc.text("Luminaire schedule", 14, y);
  y += 7;
  doc.setFontSize(9);
  for (const lum of scene.luminaires) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(
      `${lum.name} @ (${lum.position.x.toFixed(2)}, ${lum.position.y.toFixed(2)}, ${lum.position.z.toFixed(2)}) rot ${lum.rotationDeg.toFixed(0)}°`,
      14,
      y
    );
    y += 5;
  }

  if (opts.snapshotDataUrl) {
    try {
      doc.addPage();
      doc.text("Scene snapshot", 14, 20);
      doc.addImage(opts.snapshotDataUrl, "PNG", 14, 28, 180, 120);
    } catch {
      /* ignore bad snapshot */
    }
  }

  doc.save(`${sanitize(projectName)}.pdf`);
}

export function exportLuxsimFile(project: LuxsimProjectFile) {
  const text = serializeLuxsim(project);
  downloadBlob(
    `${sanitize(project.name)}.luxsim.json`,
    new Blob([text], { type: "application/json" })
  );
}

export async function exportDialuxEvo(projectId: string, projectName: string): Promise<string[]> {
  const res = await fetch(`/api/projects/${projectId}/export-evo`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Export failed (${res.status})`);
  }
  const warnings = res.headers.get("X-Luxsim-Evo-Warnings") ?? "";
  const blob = await res.blob();
  downloadBlob(`${sanitize(projectName)}.evo`, blob);
  return warnings ? warnings.split(" | ").filter(Boolean) : [];
}

export async function exportDialuxPack(opts: {
  projectName: string;
  scene: AnyScene;
  sourceFiles: Record<string, { filename: string; text: string }>;
  luminaireNames: Record<string, string>;
}) {
  const blob = await buildDialuxPack(opts);
  downloadBlob(`${sanitize(opts.projectName)}-dialux-pack.zip`, blob);
}

export function buildLuxsimProject(opts: {
  name: string;
  scene: AnyScene;
  results: CalcResults | LuxsimProjectFile["results"];
  photometry: Record<string, PhotometricData>;
  sourceFiles?: Record<string, { filename: string; text: string }>;
}): LuxsimProjectFile {
  const version = opts.scene.version === 2 ? 2 : 1;
  return {
    format: "luxsim",
    version,
    name: opts.name,
    scene: opts.scene,
    results: opts.results,
    photometry: opts.photometry,
    sourceFiles: opts.sourceFiles,
  };
}

function sanitize(name: string): string {
  return name.replace(/[^\w\-]+/g, "_").slice(0, 80) || "luxsim-project";
}
