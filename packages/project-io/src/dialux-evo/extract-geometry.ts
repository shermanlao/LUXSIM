/** Helpers to verify geometry encoded in exported ProjectData.dat (for tests). */

export function innerContourPolygons(dat: string): string[][] {
  const re =
    /StoreyContourRepresentationData \(#[0-9]+, 0, \$?, \$?, False, \(1\., 1\., 1\.\), \(\(([^;]+)\)\), #[0-9]+, \(#[0-9]+(?:, #[0-9]+)*\), \.Inner\./g;
  const polys: string[][] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(dat))) {
    const inner = m[1]!;
    const pts = [...inner.matchAll(/\(([0-9.\-Ee+]+),\s*([0-9.\-Ee+]+)\)/g)].map(
      (x) => `${x[1]},${x[2]}`
    );
    polys.push(pts);
  }
  return polys;
}

export function datContainsRoomName(dat: string, name: string): boolean {
  return dat.includes(name.replace(/'/g, "''"));
}

export { contourIntegrityIssues, datStepHeaderValid } from "./validate-archive";
