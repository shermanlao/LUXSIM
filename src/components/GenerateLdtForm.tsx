"use client";

import { FormEvent, useMemo, useState } from "react";
import type { PhotometricData, PhotometricFamily } from "@luxsim/photometry";
import {
  generateLibraryCone,
  libraryBeamsForFamily,
  parseLdt,
  recommendLibraryBeam,
  recommendPhotometricFamily,
} from "@luxsim/photometry";
import { PolarPreview } from "@/components/PolarPreview";
import { libraryConeLabel } from "@/lib/luminaire-origin";

export type GeneratedLuminaireRow = {
  id: string;
  name: string;
  sourceFormat?: string;
  originalName?: string;
  watts: number | null;
  lumens: number | null;
  origin?: string | null;
  libraryFamily?: string | null;
  libraryBeamDeg?: number | null;
};

type Props = {
  compact?: boolean;
  tone?: "light" | "cad";
  onCreated?: (luminaire: GeneratedLuminaireRow, photometric: PhotometricData) => void | Promise<void>;
};

function optionalNumber(value: string): number | undefined {
  const t = value.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export function GenerateLdtForm({ compact = false, tone = "light", onCreated }: Props) {
  const [family, setFamily] = useState<PhotometricFamily>("circular");
  const [beamDegrees, setBeamDegrees] = useState(24);
  const [beamHint, setBeamHint] = useState("");
  const [name, setName] = useState("");
  const [catalogNumber, setCatalogNumber] = useState("");
  const [lumens, setLumens] = useState("");
  const [watts, setWatts] = useState("");
  const [cctK, setCctK] = useState("");
  const [cri, setCri] = useState("");
  const [size, setSize] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<GeneratedLuminaireRow | null>(null);
  const [savedPhoto, setSavedPhoto] = useState<PhotometricData | null>(null);

  const beamKeys = libraryBeamsForFamily(family);
  const recommendation = useMemo(
    () => recommendLibraryBeam(beamHint, family),
    [beamHint, family]
  );
  const familyHint = useMemo(
    () => recommendPhotometricFamily({ name, size }),
    [name, size]
  );

  const lumenValue = optionalNumber(lumens);
  const lumenOk = lumenValue != null && lumenValue > 0;

  const livePhoto = useMemo(() => {
    if (!lumenOk || lumenValue == null) return null;
    try {
      const generated = generateLibraryCone({
        family,
        beamDegrees,
        name: name.trim() || undefined,
        catalogNumber: catalogNumber.trim() || undefined,
        lumens: lumenValue,
        watts: optionalNumber(watts) ?? null,
        cctK: optionalNumber(cctK) ?? null,
        cri: optionalNumber(cri) ?? null,
        size: size.trim() || undefined,
      });
      return parseLdt(generated.text).data;
    } catch {
      return null;
    }
  }, [lumenOk, lumenValue, family, beamDegrees, name, catalogNumber, watts, cctK, cri, size]);

  function applyRecommendedBeam() {
    setBeamDegrees(recommendation.beamDegrees);
  }

  function onFamilyChange(next: PhotometricFamily) {
    setFamily(next);
    const keys = libraryBeamsForFamily(next);
    if (!keys.includes(beamDegrees)) {
      setBeamDegrees(recommendLibraryBeam(beamHint, next).beamDegrees);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!lumenOk || lumenValue == null) {
      setError("Lumen output is required to generate an LDT file");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/luminaires/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family,
          beamDegrees,
          name: name.trim() || undefined,
          catalogNumber: catalogNumber.trim() || undefined,
          lumens: lumenValue,
          watts: optionalNumber(watts) ?? undefined,
          cctK: optionalNumber(cctK) ?? undefined,
          cri: optionalNumber(cri) ?? undefined,
          size: size.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Generate failed");
        return;
      }
      const luminaire = data.luminaire as GeneratedLuminaireRow;
      const photometric = data.photometric as PhotometricData;
      setSaved(luminaire);
      setSavedPhoto(photometric);
      await onCreated?.(luminaire, photometric);
    } finally {
      setSaving(false);
    }
  }

  function downloadSaved() {
    if (!saved) return;
    window.location.href = `/api/luminaires/${saved.id}/ldt`;
  }

  const preview = savedPhoto ?? livePhoto;
  const coneLabel = saved
    ? libraryConeLabel(saved)
    : `Library cone · ${family === "linear" ? "Linear " : ""}${beamDegrees}°`;

  return (
    <form onSubmit={onSubmit} className={compact ? "space-y-2" : "space-y-3"}>
      <div>
        <h2 className="font-semibold">Generate LDT</h2>
        <p className={`text-[var(--muted)] ${compact ? "text-[10px]" : "text-sm"}`}>
          Build a calculated library cone when you do not have a measured IES or LDT.
          This is not a laboratory file.
        </p>
      </div>

      <div className={compact ? "space-y-2" : "grid sm:grid-cols-2 gap-3"}>
        <div>
          <label className="label" htmlFor="ldt-shape">
            Shape
          </label>
          <select
            id="ldt-shape"
            className="select"
            value={family}
            onChange={(e) => onFamilyChange(e.target.value as PhotometricFamily)}
          >
            <option value="circular">
              Circular cone{familyHint.family === "circular" ? " (recommended)" : ""}
            </option>
            <option value="linear">
              Linear / LED strip{familyHint.family === "linear" ? " (recommended)" : ""}
            </option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ldt-beam">
            Library beam
          </label>
          <select
            id="ldt-beam"
            className="select"
            value={beamDegrees}
            onChange={(e) => setBeamDegrees(Number(e.target.value))}
          >
            {beamKeys.map((key) => (
              <option key={key} value={key}>
                {key}°{recommendation.beamDegrees === key && recommendation.kind !== "empty"
                  ? " (recommended)"
                  : recommendation.beamDegrees === key && recommendation.kind === "empty"
                    ? " (default)"
                    : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="ldt-beam-hint">
          Beam-angle hint (optional)
        </label>
        <div className="flex gap-2">
          <input
            id="ldt-beam-hint"
            className="input"
            value={beamHint}
            onChange={(e) => setBeamHint(e.target.value)}
            placeholder="e.g. 36 or 15/24"
          />
          {beamHint.trim() && (
            <button type="button" className="btn-secondary px-3 text-xs" onClick={applyRecommendedBeam}>
              Use {recommendation.beamDegrees}°
            </button>
          )}
        </div>
        {beamHint.trim() && (
          <p className="text-[10px] text-[var(--muted)] mt-1">{recommendation.message}</p>
        )}
      </div>

      <div className={compact ? "space-y-2" : "grid sm:grid-cols-2 gap-3"}>
        <div>
          <label className="label" htmlFor="ldt-name">
            Display name
          </label>
          <input
            id="ldt-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Office downlight 30W"
          />
        </div>
        <div>
          <label className="label" htmlFor="ldt-catalog">
            Catalog / article (optional)
          </label>
          <input
            id="ldt-catalog"
            className="input"
            value={catalogNumber}
            onChange={(e) => setCatalogNumber(e.target.value)}
            placeholder="Used as the .ldt file name"
          />
        </div>
      </div>

      <div className={compact ? "space-y-2" : "grid sm:grid-cols-2 gap-3"}>
        <div>
          <label className="label" htmlFor="ldt-lumens">
            Lumen (required)
          </label>
          <input
            id="ldt-lumens"
            className="input"
            inputMode="decimal"
            value={lumens}
            onChange={(e) => setLumens(e.target.value)}
            placeholder="2000"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="ldt-watts">
            Wattage
          </label>
          <input
            id="ldt-watts"
            className="input"
            inputMode="decimal"
            value={watts}
            onChange={(e) => setWatts(e.target.value)}
            placeholder="20"
          />
        </div>
        <div>
          <label className="label" htmlFor="ldt-cct">
            CCT (K)
          </label>
          <input
            id="ldt-cct"
            className="input"
            inputMode="numeric"
            value={cctK}
            onChange={(e) => setCctK(e.target.value)}
            placeholder="3000"
          />
        </div>
        <div>
          <label className="label" htmlFor="ldt-cri">
            CRI
          </label>
          <input
            id="ldt-cri"
            className="input"
            inputMode="numeric"
            value={cri}
            onChange={(e) => setCri(e.target.value)}
            placeholder="90"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="ldt-size">
          Fixture / emission size
        </label>
        <input
          id="ldt-size"
          className="input"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="Dia90 x H70 or L1200xW50xH40"
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button className="btn" disabled={saving || !lumenOk}>
          {saving ? "Generating…" : "Generate and save into library"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!saved}
          onClick={downloadSaved}
        >
          Download .ldt
        </button>
      </div>

      {preview && (
        <div className={tone === "cad" ? "space-y-1" : "space-y-2"}>
          <p className={`text-[var(--muted)] ${compact ? "text-[10px]" : "text-xs"}`}>
            {coneLabel}
            {saved ? " — saved to the workspace library." : " — preview (save to keep this cone)."}
          </p>
          <PolarPreview photo={preview} size={compact ? 120 : 180} />
        </div>
      )}
    </form>
  );
}
