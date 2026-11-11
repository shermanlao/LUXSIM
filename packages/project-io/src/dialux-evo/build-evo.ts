import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import type { ProjectSceneV2 } from "../types";
import {
  allEvoRooms,
  defaultEvoFixtureRoot,
  loadReferenceProjectDataDat,
  patchProjectDataDat,
} from "./patch-project-data";
import {
  assembleEvoZip,
  defaultEvoReferenceZipPath,
  EVO_REFERENCE_MEMBER_ORDER,
  readEvoZipMemberMeta,
} from "./assemble-evo";

export interface BuildDialuxEvoInput {
  projectName: string;
  scene: ProjectSceneV2;
  description?: string;
  /** Absolute path to fixtures/dialux-evo-12.1-reference (unpacked STEP template). */
  fixtureRoot: string;
  /** Path to official `.evo.zip` used as container clone source. */
  referenceZipPath?: string;
}

export interface BuildDialuxEvoResult {
  blob: Blob;
  warnings: string[];
  roomCount: number;
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
          `Exported from LUXSIM — AED-180297 L9M reference hand-off (evo 12.1).`
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
  const rooms = allEvoRooms(input.scene);
  if (!rooms.length) {
    throw new Error("No rooms to export — draw at least one room before exporting .evo.");
  }

  const referenceZip = input.referenceZipPath ?? defaultEvoReferenceZipPath();
  const templateDat = loadReferenceProjectDataDat(input.fixtureRoot);
  const patched = patchProjectDataDat(
    templateDat,
    input.projectName,
    rooms,
    input.description,
    { geometry: "off" }
  );

  const archiveXmlPath = path.join(input.fixtureRoot, "ArchiveInfo/ArchiveInfo.xml");
  const archiveXml = patchArchiveInfoXml(readFileSync(archiveXmlPath, "utf8"), input);

  const zipBytes = assembleEvoZip(referenceZip, {
    "ArchiveInfo/ArchiveInfo.xml": Buffer.from(archiveXml, "utf8"),
    "Project/ProjectData/ProjectData.dat": Buffer.from(patched.dat, "utf8"),
  });

  const blob = new Blob([zipBytes], { type: "application/octet-stream" });
  return {
    blob,
    warnings: patched.warnings,
    roomCount: patched.roomCount,
  };
}

export {
  assembleEvoZip,
  defaultEvoFixtureRoot,
  defaultEvoReferenceZipPath,
  EVO_REFERENCE_MEMBER_ORDER,
  readEvoZipMemberMeta,
};
