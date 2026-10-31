import JSZip from "jszip";
import type { SceneJson } from "./types";

export interface DialuxPackInput {
  projectName: string;
  scene: SceneJson;
  sourceFiles: Record<string, { filename: string; text: string }>;
  luminaireNames: Record<string, string>;
}

export async function buildDialuxPack(input: DialuxPackInput): Promise<Blob> {
  const zip = new JSZip();
  const room = input.scene.room;

  zip.file(
    "room.json",
    JSON.stringify(
      {
        width: room.width,
        depth: room.depth,
        height: room.height,
        reflectance: room.reflectance,
        workplaneHeight: room.workplaneHeight,
        note: "Recreate this rectangular room in DIALux evo, then import luminaires and place from schedule.csv",
      },
      null,
      2
    )
  );

  const header = [
    "name",
    "luminaireId",
    "filename",
    "x_m",
    "y_m",
    "z_m",
    "rotation_deg",
    "mount_height_m",
  ].join(",");

  const rows = input.scene.luminaires.map((lum) => {
    const src = input.sourceFiles[lum.luminaireId];
    const filename = src?.filename ?? `${lum.luminaireId}.ies`;
    return [
      csvEscape(lum.name || input.luminaireNames[lum.luminaireId] || lum.luminaireId),
      lum.luminaireId,
      csvEscape(filename),
      lum.position.x.toFixed(3),
      lum.position.y.toFixed(3),
      lum.position.z.toFixed(3),
      lum.rotationDeg.toFixed(1),
      lum.position.z.toFixed(3),
    ].join(",");
  });

  zip.file("schedule.csv", [header, ...rows].join("\n"));
  zip.file(
    "README.txt",
    [
      "LUXSIM → DIALux export pack",
      "",
      "1. Create a room in DIALux matching room.json dimensions and reflectances.",
      "2. Import each file from /luminaires into DIALux (IES/LDT).",
      "3. Place luminaires using schedule.csv coordinates (origin at room corner, Z up).",
      "",
      "Note: This pack does NOT include a native .evo project file.",
      "DIALux .evo format is proprietary; see docs/DIALUX_INTEROP.md.",
    ].join("\n")
  );

  const folder = zip.folder("luminaires");
  for (const [id, file] of Object.entries(input.sourceFiles)) {
    folder?.file(file.filename || `${id}.ies`, file.text);
  }

  return zip.generateAsync({ type: "blob" });
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
