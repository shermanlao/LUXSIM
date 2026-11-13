"use client";

import { clampMf, type En12464Check } from "@luxsim/project-io";
import type { CalcResults } from "@luxsim/solver";

type Props = {
  results: CalcResults | null;
  en12464Check: En12464Check | null;
  maintenanceFactor: number;
  roomName: string | null;
  scope?: "room" | "storey";
};

export function EditorResultsStrip({
  results,
  en12464Check,
  maintenanceFactor,
  roomName,
  scope = "room",
}: Props) {
  const mf = clampMf(maintenanceFactor);
  const s = results?.summary;

  return (
    <div className="cad-results-strip" role="region" aria-label="Calculation results">
      <div className="cad-results-strip__room">
        {roomName ? (
          <>
            <span className="cad-results-strip__label">
              {scope === "storey" ? "Active storey" : "Active room"}
            </span>
            <span className="cad-results-strip__room-name">{roomName}</span>
          </>
        ) : (
          <span className="cad-results-strip__muted">Select a room · run Calc to populate</span>
        )}
      </div>
      <div className="cad-results-metrics">
        <Metric label="Ēm" value={s ? `${s.eave.toFixed(0)} lx` : "—"} />
        <Metric
          label="Maint. Ēm"
          value={s ? `${(s.eave * mf).toFixed(0)} lx` : "—"}
          sub={`MF ${mf.toFixed(2)}`}
        />
        <Metric
          label="Uo"
          value={s ? s.uo.toFixed(2) : "—"}
          sub={s ? `Emin ${s.emin.toFixed(0)} lx` : undefined}
        />
        <Metric
          label="UGR"
          value={s?.ugr != null ? s.ugr.toFixed(1) : "—"}
          sub={scope === "storey" && s?.ugr != null ? "max" : undefined}
          assist
        />
        <Metric
          label="LPD"
          value={s?.lpd != null ? `${s.lpd.toFixed(2)} W/m²` : "—"}
        />
        {en12464Check && (
          <Metric
            label="EN assist"
            value={en12464Check.overallPass === null ? "—" : en12464Check.overallPass ? "Pass" : "Fail"}
            sub={en12464Check.templateLabel.replace(/ — .*/, "")}
          />
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  assist,
}: {
  label: string;
  value: string;
  sub?: string;
  assist?: boolean;
}) {
  return (
    <div className="cad-metric">
      <div className="cad-metric__label">
        {label}
        {assist && <span className="cad-metric__assist">assist</span>}
      </div>
      <div className="cad-metric__value">{value}</div>
      {sub && <div className="cad-metric__sub">{sub}</div>}
    </div>
  );
}
