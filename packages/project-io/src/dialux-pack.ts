import JSZip from "jszip";
import type { CalcResults } from "../../solver/src/types";
import { clampMf, evaluateEn12464 } from "./en12464";
import { buildVerificationDxf } from "./dxf-export";
import { roomBounds } from "./geometry";
import type { ProjectSceneV2, ResultsV2 } from "./types";

export interface DialuxPackInput {
  projectName: string;
  scene: ProjectSceneV2;
  results: ResultsV2 | null;
  sourceFiles: Record<string, { filename: string; text: string }>;
  luminaireNames: Record<string, string>;
}

export async function buildDialuxPack(input: DialuxPackInput): Promise<Blob> {
  const zip = new JSZip();
  const { scene, results } = input;

  zip.file(
    "rooms.json",
    JSON.stringify(
      {
        project: input.projectName,
        units: "metres",
        coordinateSystem: "origin at plan 0,0; Z up",
        storeys: scene.storeys.map((st) => ({
          id: st.id,
          name: st.name,
          elevationM: st.elevationM,
          heightM: st.heightM,
        })),
        rooms: scene.rooms.map((room) => ({
          id: room.id,
          storeyId: room.storeyId,
          name: room.name,
          polygon: room.polygon,
          heightM: room.heightM,
          workplaneHeightM: room.workplaneHeightM,
          reflectance: room.reflectance,
          calc: room.calc,
        })),
        note: "Recreate rooms in desktop DIALux using polygon vertices, then import luminaires and schedule.csv.",
      },
      null,
      2
    )
  );

  const scheduleHeader = [
    "roomId",
    "roomName",
    "storeyId",
    "instanceId",
    "name",
    "luminaireId",
    "filename",
    "x_m",
    "y_m",
    "z_m",
    "rotation_deg",
    "mount_height_m",
  ].join(",");

  const scheduleRows = scene.instances.map((inst) => {
    const room = scene.rooms.find((r) => r.id === inst.roomId);
    const src = input.sourceFiles[inst.luminaireId];
    const filename = src?.filename ?? `${inst.luminaireId}.ies`;
    return [
      csvEscape(room?.id ?? ""),
      csvEscape(room?.name ?? ""),
      csvEscape(inst.storeyId),
      inst.instanceId,
      csvEscape(inst.name || input.luminaireNames[inst.luminaireId] || inst.luminaireId),
      inst.luminaireId,
      csvEscape(filename),
      inst.position.x.toFixed(3),
      inst.position.y.toFixed(3),
      inst.position.z.toFixed(3),
      inst.rotationDeg.toFixed(1),
      inst.position.z.toFixed(3),
    ].join(",");
  });
  zip.file("schedule.csv", [scheduleHeader, ...scheduleRows].join("\n"));

  const measurePoints = collectMeasurePoints(scene, results);
  zip.file(
    "results-summary.csv",
    buildResultsSummaryCsv(scene, results)
  );
  if (measurePoints.length) {
    zip.file("results-grid.csv", buildResultsGridCsv(measurePoints));
  }

  zip.file(
    "geometry.dxf",
    buildVerificationDxf({
      storeys: scene.storeys,
      rooms: scene.rooms,
      instances: scene.instances,
      measurePoints,
    })
  );

  zip.file(
    "README.txt",
    [
      "LUXSIM → DIALux verification pack",
      "",
      "Contents:",
      "  rooms.json       — multi-room/storey geometry and reflectances",
      "  schedule.csv     — fixture positions (world metres, Z up)",
      "  luminaires/      — IES/LDT source files",
      "  geometry.dxf     — walls (room outlines), fixtures, calc grid points",
      "  results-summary.csv — per-room averages + EN 12464 assist checks",
      "  results-grid.csv — grid point lux (when calculated)",
      "",
      "Workflow:",
      "1. Import geometry.dxf or trace rooms from rooms.json in desktop DIALux.",
      "2. Import luminaire files from luminaires/.",
      "3. Place fixtures using schedule.csv coordinates.",
      "4. Compare DIALux results to results-summary.csv / results-grid.csv.",
      "",
      "This pack does not include a native proprietary project file.",
      "See docs/DIALUX_INTEROP.md.",
    ].join("\n")
  );

  const folder = zip.folder("luminaires");
  const usedIds = new Set(scene.instances.map((i) => i.luminaireId));
  for (const id of usedIds) {
    const file = input.sourceFiles[id];
    if (file) {
      folder?.file(file.filename || `${id}.ies`, file.text);
    }
  }
  for (const id of scene.fixtureLibraryIds) {
    if (usedIds.has(id)) continue;
    const file = input.sourceFiles[id];
    if (file) folder?.file(file.filename || `${id}.ies`, file.text);
  }

  return zip.generateAsync({ type: "blob" });
}

function collectMeasurePoints(
  scene: ProjectSceneV2,
  results: ResultsV2 | null
): { x: number; y: number; z: number; lux: number; roomId: string }[] {
  if (!results?.byRoomId) return [];
  const out: { x: number; y: number; z: number; lux: number; roomId: string }[] = [];
  for (const room of scene.rooms) {
    const calc = results.byRoomId[room.id];
    if (!calc) continue;
    const b = roomBounds(room);
    const { grid } = calc;
    for (let j = 0; j < grid.ny; j += 1) {
      for (let i = 0; i < grid.nx; i += 1) {
        const lux = grid.lux[j * grid.nx + i] ?? 0;
        if (lux <= 0) continue;
        out.push({
          roomId: room.id,
          x: b.minX + grid.originX + i * grid.spacing,
          y: b.minY + grid.originY + j * grid.spacing,
          z: grid.z,
          lux,
        });
      }
    }
  }
  return out;
}

function buildResultsSummaryCsv(
  scene: ProjectSceneV2,
  results: ResultsV2 | null
): string {
  const header = [
    "roomId",
    "roomName",
    "eave_lx",
    "emin_lx",
    "emax_lx",
    "uo",
    "ugr",
    "lpd_w_m2",
    "maintenance_factor",
    "maintained_eave_lx",
    "en12464_template",
    "pass_em",
    "pass_uo",
    "pass_ugr",
    "pass_overall",
    "grid_points_exported",
  ].join(",");

  const rows = scene.rooms.map((room) => {
    const calc = results?.byRoomId?.[room.id];
    const mf = clampMf(room.calc.maintenanceFactor);
    const en = calc ? evaluateEn12464(calc, room.calc.en12464TemplateId, mf) : null;
    const s = calc?.summary;
    const roomGridCount = calc
      ? collectMeasurePoints(
          { ...scene, rooms: [room] },
          { version: 2, byRoomId: { [room.id]: calc } }
        ).length
      : 0;
    return [
      room.id,
      csvEscape(room.name),
      s ? s.eave.toFixed(2) : "",
      s ? s.emin.toFixed(2) : "",
      s ? s.emax.toFixed(2) : "",
      s ? s.uo.toFixed(3) : "",
      s?.ugr != null ? s.ugr.toFixed(1) : "",
      s?.lpd != null ? s.lpd.toFixed(3) : "",
      mf.toFixed(2),
      en ? en.maintainedEave.toFixed(2) : s ? (s.eave * mf).toFixed(2) : "",
      csvEscape(en?.templateLabel ?? ""),
      boolCsv(en?.checks.em.pass ?? null),
      boolCsv(en?.checks.uo.pass ?? null),
      boolCsv(en?.checks.ugr.pass ?? null),
      boolCsv(en?.overallPass ?? null),
      String(roomGridCount),
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

function buildResultsGridCsv(
  points: { x: number; y: number; z: number; lux: number; roomId: string }[]
): string {
  const header = ["roomId", "x_m", "y_m", "z_m", "lux"].join(",");
  const rows = points.map((p) =>
    [p.roomId, p.x.toFixed(3), p.y.toFixed(3), p.z.toFixed(3), p.lux.toFixed(2)].join(",")
  );
  return [header, ...rows].join("\n");
}

function boolCsv(v: boolean | null): string {
  if (v === null) return "";
  return v ? "pass" : "fail";
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
