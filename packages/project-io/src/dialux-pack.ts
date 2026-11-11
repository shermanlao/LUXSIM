import JSZip from "jszip";
import type { AnyScene, FixtureInstance, ProjectSceneV2, SceneJson } from "./types";
import { isSceneV2 } from "./migrate";
import { roomAreaM2 } from "./geometry";

export interface DialuxPackInput {
  projectName: string;
  scene: AnyScene;
  sourceFiles: Record<string, { filename: string; text: string }>;
  luminaireNames: Record<string, string>;
}

export async function buildDialuxPack(input: DialuxPackInput): Promise<Blob> {
  const zip = new JSZip();

  if (isSceneV2(input.scene)) {
    writeSceneV2Pack(zip, input);
  } else {
    writeSceneV1Pack(zip, input.scene as SceneJson, input);
  }

  return zip.generateAsync({ type: "blob" });
}

function writeSceneV1Pack(zip: JSZip, scene: SceneJson, input: DialuxPackInput): void {
  const room = scene.room;
  zip.file(
    "room.json",
    JSON.stringify(
      {
        width: room.width,
        depth: room.depth,
        height: room.height,
        reflectance: room.reflectance,
        workplaneHeight: room.workplaneHeight,
        note: "Single rectangular room (LUXSIM v1 scene).",
      },
      null,
      2
    )
  );
  zip.file("schedule.csv", buildScheduleCsvV1(scene, input.luminaireNames));
  writeReadme(zip, "v1");
  writeLuminaireFiles(zip, input.sourceFiles);
}

function writeSceneV2Pack(zip: JSZip, input: DialuxPackInput): void {
  const scene = input.scene as ProjectSceneV2;
  const storeys = scene.storeys.map((s) => ({
    id: s.id,
    name: s.name,
    elevationM: s.elevationM,
    heightM: s.heightM,
  }));

  const rooms = scene.rooms.map((r) => {
    const storey = scene.storeys.find((s) => s.id === r.storeyId);
    return {
      id: r.id,
      name: r.name,
      storeyId: r.storeyId,
      storeyName: storey?.name ?? "—",
      polygon: r.polygon,
      areaM2: roomAreaM2(r),
      heightM: r.heightM,
      workplaneHeightM: r.workplaneHeightM,
      reflectance: r.reflectance,
      calc: r.calc,
    };
  });

  zip.file(
    "project.json",
    JSON.stringify(
      {
        name: input.projectName,
        version: 2,
        storeys,
        roomCount: rooms.length,
      },
      null,
      2
    )
  );

  zip.file("rooms.json", JSON.stringify(rooms, null, 2));

  zip.file(
    "schedule.csv",
    buildScheduleCsvV2(scene.instances, scene, input.luminaireNames)
  );

  writeReadme(zip, "v2");
  writeLuminaireFiles(zip, input.sourceFiles);
}

function buildScheduleCsvV1(scene: SceneJson, luminaireNames: Record<string, string>): string {
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

  const rows = scene.luminaires.map((lum) => [
    csvEscape(lum.name || luminaireNames[lum.luminaireId] || lum.luminaireId),
    lum.luminaireId,
    csvEscape(`${lum.luminaireId}.ies`),
    lum.position.x.toFixed(3),
    lum.position.y.toFixed(3),
    lum.position.z.toFixed(3),
    lum.rotationDeg.toFixed(1),
    lum.position.z.toFixed(3),
  ]);

  return [header, ...rows.map((r) => r.join(","))].join("\n");
}

function buildScheduleCsvV2(
  instances: FixtureInstance[],
  scene: ProjectSceneV2,
  luminaireNames: Record<string, string>
): string {
  const header = [
    "name",
    "room_id",
    "room_name",
    "storey",
    "luminaireId",
    "x_m",
    "y_m",
    "z_m",
    "rotation_deg",
    "mount_height_m",
  ].join(",");

  const rows = instances.map((inst) => {
    const room = scene.rooms.find((r) => r.id === inst.roomId);
    const storey = scene.storeys.find((s) => s.id === inst.storeyId);
    return [
      csvEscape(inst.name || luminaireNames[inst.luminaireId] || inst.luminaireId),
      inst.roomId ?? "",
      csvEscape(room?.name ?? "—"),
      csvEscape(storey?.name ?? "—"),
      inst.luminaireId,
      inst.position.x.toFixed(3),
      inst.position.y.toFixed(3),
      inst.position.z.toFixed(3),
      inst.rotationDeg.toFixed(1),
      inst.position.z.toFixed(3),
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

function writeReadme(zip: JSZip, mode: "v1" | "v2"): void {
  const v2Lines =
    mode === "v2"
      ? [
          "1. Import rooms from rooms.json — each entry has a polygon (metres, X/Y plan, closed loop).",
          "2. Match storey elevations from project.json / storeyName on each room.",
          "3. Import each file from /luminaires into DIALux (IES/LDT).",
          "4. Place luminaires using schedule.csv (world coordinates match the LUXSIM plan).",
        ]
      : [
          "1. Create a room in DIALux matching room.json dimensions and reflectances.",
          "2. Import each file from /luminaires into DIALux (IES/LDT).",
          "3. Place luminaires using schedule.csv coordinates (origin at room corner, Z up).",
        ];

  zip.file(
    "README.txt",
    [
      "LUXSIM → DIALux export pack",
      "",
      ...v2Lines,
      "",
      "Limits:",
      "- This pack does NOT include a native DIALux .evo project file (proprietary).",
      "- Irregular room polygons must be traced or imported manually in DIALux; coordinates are faithful to LUXSIM.",
      "- See docs/DIALUX_INTEROP.md in the LUXSIM repo.",
    ].join("\n")
  );
}

function writeLuminaireFiles(
  zip: JSZip,
  sourceFiles: Record<string, { filename: string; text: string }>
): void {
  const folder = zip.folder("luminaires");
  for (const [id, file] of Object.entries(sourceFiles)) {
    folder?.file(file.filename || `${id}.ies`, file.text);
  }
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
