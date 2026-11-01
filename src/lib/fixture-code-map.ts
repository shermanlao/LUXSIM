import type { FixtureCodeMapRule } from "@luxsim/project-io";

export type CodeMapRule = FixtureCodeMapRule;

export type LuminaireLookupRow = {
  id: string;
  name: string;
  originalName?: string | null;
  catalogNumber?: string | null;
};

export type CodeMapStatus = "mapped" | "ambiguous" | "unmapped";

export type CodeMapLookupResult = {
  status: CodeMapStatus;
  codeNorm: string;
  luminaireId?: string;
  candidates: string[];
};

/** Trim, upper-case, strip common separators and whitespace. */
export function normalizeFixtureCode(codeRaw: string): string {
  return codeRaw.trim().toUpperCase().replace(/[\s\-_./\\|,;:]+/g, "");
}

function ruleMatches(rule: FixtureCodeMapRule, codeNorm: string): boolean {
  if (!rule.active) return false;
  const primary = normalizeFixtureCode(rule.codeNorm);
  if (codeNorm === primary) return true;
  if (rule.match === "alias") {
    return rule.aliases.some((a) => normalizeFixtureCode(a) === codeNorm);
  }
  return false;
}

/** Deterministic exact/alias lookup — never picks a best guess when ambiguous. */
export function lookupFixtureCode(
  codeRaw: string,
  rules: FixtureCodeMapRule[]
): CodeMapLookupResult {
  const codeNorm = normalizeFixtureCode(codeRaw);
  if (!codeNorm) {
    return { status: "unmapped", codeNorm: "", candidates: [] };
  }

  const luminaireIds: string[] = [];
  for (const rule of rules) {
    if (ruleMatches(rule, codeNorm)) {
      luminaireIds.push(rule.luminaireId);
    }
  }

  const candidates = [...new Set(luminaireIds)];
  if (candidates.length === 0) {
    return { status: "unmapped", codeNorm, candidates: [] };
  }
  if (candidates.length === 1) {
    return { status: "mapped", codeNorm, luminaireId: candidates[0], candidates };
  }
  return { status: "ambiguous", codeNorm, candidates };
}

export class CodeMapGateError extends Error {
  readonly result: CodeMapLookupResult;
  readonly codeRaw: string;

  constructor(codeRaw: string, result: CodeMapLookupResult) {
    const label =
      result.status === "ambiguous"
        ? `Ambiguous fixture code “${codeRaw}” (${result.candidates.length} luminaires)`
        : `Unmapped fixture code “${codeRaw}”`;
    super(label);
    this.name = "CodeMapGateError";
    this.codeRaw = codeRaw;
    this.result = result;
  }
}

/** Pipeline gate: throws on unmapped/ambiguous — no silent fallback. */
export function requireMappedFixtureCode(
  codeRaw: string,
  rules: FixtureCodeMapRule[]
): { luminaireId: string; result: CodeMapLookupResult } {
  const result = lookupFixtureCode(codeRaw, rules);
  if (result.status !== "mapped" || !result.luminaireId) {
    throw new CodeMapGateError(codeRaw, result);
  }
  return { luminaireId: result.luminaireId, result };
}

export function createCodeMapRule(input: {
  codeRaw: string;
  luminaireId: string;
  aliases?: string[];
  match?: FixtureCodeMapRule["match"];
  active?: boolean;
  id?: string;
}): FixtureCodeMapRule {
  const codeNorm = normalizeFixtureCode(input.codeRaw);
  return {
    id: input.id ?? `codemap_${crypto.randomUUID().slice(0, 8)}`,
    codeNorm,
    aliases: (input.aliases ?? []).map((a) => a.trim()).filter(Boolean),
    luminaireId: input.luminaireId,
    match: input.match ?? "alias",
    active: input.active ?? true,
  };
}

export type CodeMapCsvRow = { code: string; luminaireId: string };

/** Parse `(code,luminaireId)` CSV; skips blank lines and optional header row. */
export function parseFixtureCodeMapCsv(text: string): {
  rows: CodeMapCsvRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const rows: CodeMapCsvRow[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 2) {
      errors.push(`Line ${i + 1}: expected code,luminaireId`);
      continue;
    }
    const [code, luminaireId] = parts;
    if (!code || !luminaireId) {
      errors.push(`Line ${i + 1}: empty code or luminaireId`);
      continue;
    }
    if (i === 0 && /^code$/i.test(code) && /^luminaire/i.test(luminaireId)) {
      continue;
    }
    rows.push({ code, luminaireId });
  }
  return { rows, errors };
}

export function mergeCsvIntoCodeMapRules(
  existing: FixtureCodeMapRule[],
  rows: CodeMapCsvRow[],
  options?: { replace?: boolean }
): FixtureCodeMapRule[] {
  const next = options?.replace ? [] : [...existing];
  for (const row of rows) {
    next.push(
      createCodeMapRule({
        codeRaw: row.code,
        luminaireId: row.luminaireId,
        match: "alias",
      })
    );
  }
  return next;
}

export function luminaireLabel(row: LuminaireLookupRow): string {
  const bits = [row.name];
  if (row.catalogNumber) bits.push(row.catalogNumber);
  else if (row.originalName) bits.push(row.originalName);
  return bits.join(" · ");
}
