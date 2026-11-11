import { readFileSync } from "fs";
import path from "path";
import type { ProjectSceneV2 } from "../types";
import {
  allEvoRooms,
  defaultEvoFixtureRoot,
  loadReferenceProjectDataDat,
  patchProjectDataDat,
} from "./patch-project-data";
import {
  archiveUniqueNameFromXml,
  formatDialuxArchiveCreateTime,
  formatDialuxArchiveModifiedTimeLocal,
} from "./identity";
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

export interface PatchArchiveInfoInput {
  projectName: string;
  description?: string;
  /** Template UniqueName — preserved unchanged in XML and STEP #151. */
  archiveUniqueName: string;
  templateXml: string;
}

export function patchArchiveInfoXml(xml: string, input: PatchArchiveInfoInput): string {
  const title = escapeXml(input.projectName);
  let out = xml
    .replace(/<Title>[^<]*<\/Title>/, `<Title>${title}</Title>`)
    .replace(
      /<UniqueName>[^<]*<\/UniqueName>/,
      `<UniqueName>${escapeXml(input.archiveUniqueName)}</UniqueName>`
    );

  if (input.description) {
    const desc = escapeXml(input.description);
    out = out.replace(/<Description>[^<]*<\/Description>/, `<Description>${desc}</Description>`);
    const now = new Date();
    out = out
      .replace(/<CreateTime>[^<]*<\/CreateTime>/, `<CreateTime>${formatDialuxArchiveCreateTime(now)}</CreateTime>`)
      .replace(
        /<ModifiedTime>[^<]*<\/ModifiedTime>/,
        `<ModifiedTime>${formatDialuxArchiveModifiedTimeLocal(now, 8 * 60)}</ModifiedTime>`
      );
  }

  return out;
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
  const archiveXmlPath = path.join(input.fixtureRoot, "ArchiveInfo/ArchiveInfo.xml");
  const templateArchiveXml = readFileSync(archiveXmlPath, "utf8");
  const archiveUniqueName = archiveUniqueNameFromXml(templateArchiveXml);

  const templateDat = loadReferenceProjectDataDat(input.fixtureRoot);
  const patched = patchProjectDataDat(
    templateDat,
    input.projectName,
    rooms,
    input.description,
    {
      geometry: "off",
      archiveUniqueName,
      archiveDescription: input.description,
      refreshFileNameTime: Boolean(input.description),
    }
  );

  const archiveXml = patchArchiveInfoXml(templateArchiveXml, {
    projectName: input.projectName,
    description: input.description,
    archiveUniqueName,
    templateXml: templateArchiveXml,
  });

  const datBytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(patched.dat, "utf8")]);

  const zipBytes = assembleEvoZip(referenceZip, {
    "ArchiveInfo/ArchiveInfo.xml": Buffer.from(archiveXml, "utf8"),
    "Project/ProjectData/ProjectData.dat": datBytes,
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
