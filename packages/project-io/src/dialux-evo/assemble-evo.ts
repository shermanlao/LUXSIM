import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const EVO_REFERENCE_MEMBER_ORDER = [
  "ArchiveInfo/",
  "ArchiveInfo/ArchiveInfo.xml",
  "ArchiveInfo/Thumbnail.png",
  "Project/",
  "Project/ScenegraphScene",
  "Project/InteractionManager/",
  "Project/InteractionManager/ChartingManager.V1.json",
  "Project/InteractionManager/StfManager.dat",
  "Project/InteractionManager/StfManager.xml",
  "Project/InteractionManager/ToolManager.dat",
  "Project/InteractionManager/ToolManager.xml",
  "Project/Output/",
  "Project/Output/OutputSettings.xml",
  "Project/ProjectData/",
  "Project/ProjectData/ProjectData.dat",
  "Project/ProjectData/ProjectData.xml",
  "Project/Results/",
  "Project/Results/ProjectToc.rsl",
  "Project/STF/",
  "Project/STF/fu1tpabp.tmp",
  "Project/Textures/",
  "Project/ViewThumbnails/",
  "Project/ViewThumbnails/2nzvjtqm.tmp",
  "Project/ViewThumbnails/3bthid1u.tmp",
] as const;

export interface EvoZipMemberMeta {
  filename: string;
  createVersion: number;
  extractVersion: number;
  extraLength: number;
  externalAttr: number;
  compressType: number;
  compressSize: number;
}

export function defaultEvoReferenceZipPath(): string {
  return path.join(process.cwd(), "fixtures/dialux-evo-12.1-reference.evo.zip");
}

export function assembleEvoZip(
  referenceZip: string,
  overrides: Record<string, Buffer>
): Buffer {
  const script = path.join(__dirname, "..", "..", "scripts", "evo-assemble.py");
  const work = mkdtempSync(path.join(tmpdir(), "luxsim-evo-"));
  const outPath = path.join(work, "out.evo");
  const overridesPath = path.join(work, "overrides.json");
  const spec: Record<string, string> = {};
  for (const [k, buf] of Object.entries(overrides)) {
    spec[k] = buf.toString("base64");
  }
  writeFileSync(overridesPath, JSON.stringify(spec));
  try {
    execFileSync("python3", [script, referenceZip, outPath, overridesPath, "--validate"], {
      stdio: "pipe",
    });
    return readFileSync(outPath);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Read zip central-directory metadata via python (matches DIALux Save As). */
export function readEvoZipMemberMeta(zipPath: string): EvoZipMemberMeta[] {
  const py = `
import json, zipfile
z=zipfile.ZipFile(${JSON.stringify(zipPath)},'r')
print(json.dumps([{
 'filename': i.filename,
 'createVersion': i.create_version,
 'extractVersion': i.extract_version,
 'extraLength': len(i.extra),
 'externalAttr': i.external_attr,
 'compressType': i.compress_type,
 'compressSize': i.compress_size,
} for i in z.infolist()]))
`;
  const out = execFileSync("python3", ["-c", py], { encoding: "utf8" });
  return JSON.parse(out) as EvoZipMemberMeta[];
}
