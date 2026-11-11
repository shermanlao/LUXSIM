import { readFileSync, readdirSync, statSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import JSZip from "jszip";
import type { ProjectSceneV2 } from "../types";
import {
  allEvoRooms,
  loadReferenceProjectDataDat,
  patchProjectDataDat,
} from "./patch-project-data";
import { EVO_ARCHIVE_MEMBERS } from "./constants";

export interface BuildDialuxEvoInput {
  projectName: string;
  scene: ProjectSceneV2;
  description?: string;
  /** Absolute path to fixtures/dialux-evo-12.1-reference */
  fixtureRoot: string;
}

export interface BuildDialuxEvoResult {
  blob: Blob;
  warnings: string[];
  roomCount: number;
}

function walkFixtureFiles(root: string, prefix = ""): { zipPath: string; abs: string }[] {
  const out: { zipPath: string; abs: string }[] = [];
  for (const name of readdirSync(root)) {
    const abs = path.join(root, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(abs).isDirectory()) {
      out.push(...walkFixtureFiles(abs, rel));
    } else {
      out.push({ zipPath: rel, abs });
    }
  }
  return out;
}

export function patchArchiveInfoXml(xml: string, input: BuildDialuxEvoInput): string {
  const now = new Date();
  const unique = randomUUID();
  return xml
    .replace(/<Title>[^<]*<\/Title>/, `<Title>${escapeXml(input.projectName)}</Title>`)
    .replace(
      /<Description>[^<]*<\/Description>/,
      `<Description>${escapeXml(
        input.description ??
          `Exported from LUXSIM — building/storey/room geometry in metres (DIALux evo 12.1 template).`
      )}</Description>`
    )
    .replace(/<UniqueName>[^<]*<\/UniqueName>/, `<UniqueName>${unique}</UniqueName>`)
    .replace(/<CreateTime>[^<]*<\/CreateTime>/, `<CreateTime>${now.toISOString()}</CreateTime>`)
    .replace(/<ModifiedTime>[^<]*<\/ModifiedTime>/, `<ModifiedTime>${now.toISOString()}</ModifiedTime>`);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function buildDialuxEvo(input: BuildDialuxEvoInput): Promise<BuildDialuxEvoResult> {
  const zip = new JSZip();
  const rooms = allEvoRooms(input.scene);
  if (!rooms.length) {
    throw new Error("No rooms to export — draw at least one room before exporting .evo.");
  }

  const templateDat = loadReferenceProjectDataDat(input.fixtureRoot);
  const patched = patchProjectDataDat(
    templateDat,
    input.projectName,
    rooms,
    input.description
  );

  const files = walkFixtureFiles(input.fixtureRoot);
  for (const f of files) {
    if (f.zipPath === "Project/ProjectData/ProjectData.dat") {
      zip.file(f.zipPath, patched.dat);
      continue;
    }
    if (f.zipPath === "ArchiveInfo/ArchiveInfo.xml") {
      const xml = readFileSync(f.abs, "utf8");
      zip.file(f.zipPath, patchArchiveInfoXml(xml, input));
      continue;
    }
    zip.file(f.zipPath, readFileSync(f.abs));
  }

  // Ensure expected layout (tests)
  for (const member of EVO_ARCHIVE_MEMBERS) {
    if (!zip.file(member)) {
      throw new Error(`Missing evo member after build: ${member}`);
    }
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return {
    blob,
    warnings: patched.warnings,
    roomCount: patched.roomCount,
  };
}

export function defaultEvoFixtureRoot(): string {
  return path.join(process.cwd(), "fixtures/dialux-evo-12.1-reference");
}
