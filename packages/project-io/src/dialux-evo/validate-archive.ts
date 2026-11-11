/** Structural checks on patched ProjectData.dat and evo zip layout. */

export interface ContourIntegrityIssue {
  kind: "Inner" | "Outer";
  entity: string;
  vertices: number;
  refs: number;
}

function countContourPairs(body: string): number {
  return body.split("), (").length;
}

export function contourIntegrityIssues(dat: string): ContourIntegrityIssue[] {
  const issues: ContourIntegrityIssue[] = [];
  const lineRe =
    /^(#\d+) = StoreyContourRepresentationData \([^;]+\), \(\((.+?)\)\), #\d+, \((#[0-9]+(?:, #[0-9]+)*)\), \.(Inner|Outer)\./gm;

  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(dat))) {
    const entity = m[1]!;
    const vertices = countContourPairs(m[2]!);
    const refs = (m[3]!.match(/#\d+/g) ?? []).length;
    const kind = m[4] as "Inner" | "Outer";
    if (vertices !== refs) {
      issues.push({ kind, entity, vertices, refs });
    }
  }
  return issues;
}

export function datStepHeaderValid(dat: string): boolean {
  return (
    dat.startsWith("ISO-10303-21;") &&
    dat.includes("FILE_SCHEMA (('DIALux {5%2E12%2E1%2E7275}'))") &&
    dat.trimEnd().endsWith("END-ISO-10303-21;")
  );
}
