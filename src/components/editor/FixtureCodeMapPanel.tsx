"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ensureFixtureCodeMapIds, type FixtureCodeMapRule } from "@luxsim/project-io";
import {
  createCodeMapRule,
  lookupFixtureCode,
  luminaireLabel,
  mergeCsvIntoCodeMapRules,
  normalizeFixtureCode,
  parseFixtureCodeMapCsv,
  type LuminaireLookupRow,
} from "@/lib/fixture-code-map";

type Props = {
  rules: FixtureCodeMapRule[];
  luminaires: LuminaireLookupRow[];
  onChange: (rules: FixtureCodeMapRule[]) => void;
};

export function FixtureCodeMapPanel({ rules, luminaires, onChange }: Props) {
  const csvRef = useRef<HTMLInputElement>(null);
  const [probeCode, setProbeCode] = useState("DL-01");
  const [newCode, setNewCode] = useState("");
  const [newLuminaireId, setNewLuminaireId] = useState(luminaires[0]?.id ?? "");

  const keyedRules = useMemo(() => ensureFixtureCodeMapIds(rules), [rules]);

  useEffect(() => {
    if (keyedRules !== rules) onChange(keyedRules);
  }, [keyedRules, rules, onChange]);

  const lumById = useMemo(() => new Map(luminaires.map((l) => [l.id, l])), [luminaires]);

  const probe = useMemo(() => lookupFixtureCode(probeCode, rules), [probeCode, rules]);

  function updateRule(id: string, patch: Partial<FixtureCodeMapRule>) {
    onChange(
      rules.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (patch.codeNorm !== undefined || "codeNorm" in patch) {
          next.codeNorm = normalizeFixtureCode(next.codeNorm || r.codeNorm);
        }
        return next;
      })
    );
  }

  function removeRule(id: string) {
    onChange(rules.filter((r) => r.id !== id));
  }

  function addRule() {
    if (!newCode.trim() || !newLuminaireId) return;
    onChange([
      ...rules,
      createCodeMapRule({ codeRaw: newCode, luminaireId: newLuminaireId, match: "alias" }),
    ]);
    setNewCode("");
  }

  function onCsvFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { rows, errors } = parseFixtureCodeMapCsv(text);
      if (errors.length) {
        window.alert(errors.join("\n"));
        return;
      }
      if (!rows.length) return;
      onChange(mergeCsvIntoCodeMapRules(rules, rows));
    };
    reader.readAsText(file);
    if (csvRef.current) csvRef.current.value = "";
  }

  return (
    <div className="cad-props-card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="cad-section-title !mt-0">Code map</p>
        <button
          type="button"
          className="btn btn-secondary !text-[10px] !py-1"
          onClick={() => csvRef.current?.click()}
        >
          Import CSV
        </button>
        <input
          ref={csvRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => onCsvFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <p className="text-[10px] text-[#8fa3ad]">
        Exact schedule codes → luminaire (stored on project scene). Unmapped/ambiguous codes block
        import pipelines — no auto-guess.
      </p>

      <div className="overflow-x-auto max-h-48 overflow-y-auto border border-[#3d5563] rounded-sm">
        <table className="cad-fixtures-table text-[11px]">
          <thead>
            <tr>
              <th>Code</th>
              <th>Aliases</th>
              <th>Luminaire</th>
              <th>Match</th>
              <th>On</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {keyedRules.map((rule) => (
              <tr key={rule.id}>
                <td>
                  <input
                    className="input !text-[11px] !py-1 w-20"
                    value={rule.codeNorm}
                    onChange={(e) =>
                      updateRule(rule.id, { codeNorm: normalizeFixtureCode(e.target.value) })
                    }
                  />
                </td>
                <td>
                  <input
                    className="input !text-[11px] !py-1 min-w-[5rem]"
                    value={rule.aliases.join(", ")}
                    onChange={(e) =>
                      updateRule(rule.id, {
                        aliases: e.target.value
                          .split(",")
                          .map((a) => a.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </td>
                <td>
                  <select
                    className="select !text-[11px] !py-1 max-w-[9rem]"
                    value={rule.luminaireId}
                    onChange={(e) => updateRule(rule.id, { luminaireId: e.target.value })}
                  >
                    {luminaires.map((l) => (
                      <option key={l.id} value={l.id}>
                        {luminaireLabel(l)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="select !text-[11px] !py-1"
                    value={rule.match}
                    onChange={(e) =>
                      updateRule(rule.id, {
                        match: e.target.value as FixtureCodeMapRule["match"],
                      })
                    }
                  >
                    <option value="exact">exact</option>
                    <option value="alias">alias</option>
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={rule.active}
                    onChange={(e) => updateRule(rule.id, { active: e.target.checked })}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="text-[10px] text-[#f5a5a5]"
                    onClick={() => removeRule(rule.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!keyedRules.length && (
              <tr key="codemap-empty">
                <td colSpan={6} className="text-[#8fa3ad] py-2">
                  No rules — add a row or import CSV (code,luminaireId).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="label">New code</label>
          <input
            className="input !text-xs"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="DL-01"
          />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="label">Luminaire</label>
          <select
            className="select !text-xs"
            value={newLuminaireId}
            onChange={(e) => setNewLuminaireId(e.target.value)}
          >
            {luminaires.map((l) => (
              <option key={l.id} value={l.id}>
                {luminaireLabel(l)}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-secondary !text-xs" onClick={addRule}>
          Add rule
        </button>
      </div>

      <div className="border-t border-[#3d5563] pt-2 space-y-1">
        <label className="label">Test lookup</label>
        <div className="flex gap-2 items-center">
          <input
            className="input !text-xs flex-1"
            value={probeCode}
            onChange={(e) => setProbeCode(e.target.value)}
          />
          <span
            className={`text-[10px] font-semibold uppercase ${
              probe.status === "mapped"
                ? "text-[#7dcea0]"
                : probe.status === "ambiguous"
                  ? "text-[#ffb088]"
                  : "text-[#f5a5a5]"
            }`}
          >
            {probe.status}
          </span>
        </div>
        {probe.status === "mapped" && probe.luminaireId && (
          <p className="text-[10px] text-[#8fa3ad]">
            → {luminaireLabel(lumById.get(probe.luminaireId) ?? { id: probe.luminaireId, name: probe.luminaireId })}
          </p>
        )}
        {probe.status === "ambiguous" && (
          <p className="text-[10px] text-[#ffb088]">
            Candidates: {probe.candidates.map((id) => lumById.get(id)?.name ?? id).join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
