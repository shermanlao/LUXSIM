/**
 * Generates a non-empty DIALux verification zip for manual import testing.
 * Run: npx tsx scripts/generate-dialux-sample-pack.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import JSZip from "jszip";
import { parseIes } from "../packages/photometry/src/index";
import { calculate } from "../packages/solver/src/calculate";
import {
  buildDialuxPack,
  clipResultsToPolygon,
  rectPolygon,
  roomToCalcOptions,
  type ProjectSceneV2,
} from "../packages/project-io/src/index";

async function main() {
  const root = process.cwd();
const iesText = readFileSync(path.join(root, "fixtures/sample-downlight.ies"), "utf8");
const { data: photometry } = parseIes(iesText);

const roomId = "sample_room";
const storeyId = "sample_storey";

const scene: ProjectSceneV2 = {
  version: 2,
  storeys: [{ id: storeyId, name: "GF", elevationM: 0, heightM: 3 }],
  rooms: [
    {
      id: roomId,
      storeyId,
      name: "AB sample 5×4 m",
      polygon: rectPolygon(0, 0, 5, 4),
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: {
        gridSpacing: 0.5,
        interreflection: true,
        bounces: 2,
        computeUgr: true,
        maintenanceFactor: 0.8,
        en12464TemplateId: "office",
      },
    },
  ],
  underlays: [],
  fixtureLibraryIds: ["lum_sample"],
  instances: [
    {
      instanceId: "inst_1",
      luminaireId: "lum_sample",
      storeyId,
      roomId,
      name: "Sample downlight",
      position: { x: 2.5, y: 2, z: 2.7 },
      rotationDeg: 30,
    },
    {
      instanceId: "inst_2",
      luminaireId: "lum_sample",
      storeyId,
      roomId,
      name: "Sample downlight B",
      position: { x: 1.2, y: 3.1, z: 2.7 },
      rotationDeg: 120,
    },
  ],
  ui: {
    activeStoreyId: storeyId,
    activeRoomId: roomId,
    viewMode: "top",
    tool: "select",
    workflowMode: "export",
  },
};

const room = scene.rooms[0]!;
const calcRaw = calculate(
  roomToCalcOptions(room, scene.instances, { lum_sample: photometry }, { lum_sample: 30 })
);
const calc = clipResultsToPolygon(room, calcRaw);

const results = { version: 2 as const, byRoomId: { [roomId]: calc } };

const blob = await buildDialuxPack({
  projectName: "LUXSIM AB sample 5x4",
  scene,
  results,
  sourceFiles: {
    lum_sample: { filename: "sample-downlight.ies", text: iesText },
  },
  luminaireNames: { lum_sample: "Sample downlight" },
});

const outDir = process.env.ARTIFACTS_DIR || "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "luxsim-dialux-verification-sample.zip");
const buf = Buffer.from(await blob.arrayBuffer());
writeFileSync(outPath, buf);

const zip = await JSZip.loadAsync(buf);
const names = Object.keys(zip.files).filter((n) => !n.endsWith("/")).sort();
const summary = {
  outPath,
  bytes: buf.length,
  files: names,
  roomsPolygonVerts: JSON.parse(await zip.file("rooms.json")!.async("string")).rooms[0].polygon
    .length,
  maintenanceFactor: JSON.parse(await zip.file("rooms.json")!.async("string")).rooms[0]
    .maintenanceFactor,
  scheduleHead: (await zip.file("schedule.csv")!.async("string")).split("\n").slice(0, 4),
  readmePresent: Boolean(zip.file("README.txt")),
  dxfBytes: (await zip.file("geometry.dxf")!.async("string")).length,
  gridDataRows: (await zip.file("results-grid.csv")!.async("string")).split("\n").length - 1,
  summaryCsvRows: (await zip.file("results-summary.csv")!.async("string")).split("\n").length - 1,
  luminaireFile: names.find((n) => n.startsWith("luminaires/") && n.endsWith(".ies")),
};
writeFileSync(path.join(outDir, "luxsim-dialux-verification-sample.meta.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
