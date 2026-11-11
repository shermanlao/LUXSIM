/** Archive identity fields shared between ArchiveInfo.xml and ProjectData.dat #151. */

const UNIQUE_NAME_RE = /<UniqueName>([^<]+)<\/UniqueName>/;
const PROJECT_INFO_RE =
  /#151 = ProjectInfoPropertySet \(2, '([^']+)', '([^']+)', '([^']+)', '([^']*)'/;

export function archiveUniqueNameFromXml(xml: string): string {
  const m = xml.match(UNIQUE_NAME_RE);
  if (!m?.[1]) throw new Error("ArchiveInfo.xml missing UniqueName");
  return m[1];
}

export function projectInfoFromDat(dat: string): {
  projectUuid: string;
  archiveUuid: string;
  title: string;
  description: string;
} {
  const m = dat.match(PROJECT_INFO_RE);
  if (!m) throw new Error("ProjectData.dat missing #151 ProjectInfoPropertySet");
  return {
    projectUuid: m[1]!,
    archiveUuid: m[2]!,
    title: m[3]!,
    description: m[4]!,
  };
}

export function archiveUuidMatchesProjectInfo(xml: string, dat: string): boolean {
  return archiveUniqueNameFromXml(xml) === projectInfoFromDat(dat).archiveUuid;
}

/** DIALux Save As FILE_NAME time: `dd/mm/yyyy hh:mm:ss` in local wall time (no timezone suffix). */
export function formatDialuxStepFileTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** XML ArchiveInfo timestamps mimic official (7 fractional digits + Z on create). */
export function formatDialuxArchiveCreateTime(date: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const ms = pad(date.getMilliseconds(), 3);
  const frac = `${ms}0000`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${frac}Z`;
}

export function formatDialuxArchiveModifiedTimeLocal(date: Date, offsetMinutes: number): string {
  const local = new Date(date.getTime() + offsetMinutes * 60_000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const oh = Math.floor(abs / 60);
  const om = abs % 60;
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}.${pad(local.getMilliseconds(), 3)}${sign}${pad(oh)}:${pad(om)}`;
}
