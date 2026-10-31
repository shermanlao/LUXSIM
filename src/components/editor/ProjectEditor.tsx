"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PhotometricData } from "@luxsim/photometry";
import type { CalcResults, LuminaireInstance } from "@luxsim/solver";
import type { SceneJson } from "@luxsim/project-io";
import { runSolverClient } from "@/lib/run-solver";
import {
  buildLuxsimProject,
  exportDialuxPack,
  exportLuxsimFile,
  exportPdfReport,
} from "@/lib/exports-client";
import { FalseColorLegend } from "./FalseColorLegend";

const SceneViewer = dynamic(
  () => import("./SceneViewer").then((m) => m.SceneViewer),
  {
    ssr: false,
    loading: () => (
      <div className="h-[520px] bg-[#0f1c24] text-white/70 grid place-items-center panel">
        Loading 3D…
      </div>
    ),
  }
);

type LumRow = {
  id: string;
  name: string;
  sourceFormat?: string;
  originalName?: string;
  watts: number | null;
  lumens: number | null;
};

type Props = {
  projectId: string;
  initialName: string;
  initialScene: SceneJson;
  initialResults: CalcResults | null;
};

export function ProjectEditor({
  projectId,
  initialName,
  initialScene,
  initialResults,
}: Props) {
  const [name, setName] = useState(initialName);
  const [scene, setScene] = useState<SceneJson>(initialScene);
  const [results, setResults] = useState<CalcResults | null>(initialResults);
  const [library, setLibrary] = useState<LumRow[]>([]);
  const [photoCache, setPhotoCache] = useState<Record<string, PhotometricData>>({});
  const [sourceCache, setSourceCache] = useState<
    Record<string, { filename: string; text: string }>
  >({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [placeId, setPlaceId] = useState<string>("");
  const [autoPlaceOnUpload, setAutoPlaceOnUpload] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = scene.luminaires.find((l) => l.instanceId === selectedId) ?? null;

  const loadLibrary = useCallback(async () => {
    const res = await fetch("/api/luminaires");
    if (res.ok) setLibrary(await res.json());
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  // Prefetch photometry for fixtures already in the scene (for the detail list)
  useEffect(() => {
    const ids = [...new Set(scene.luminaires.map((l) => l.luminaireId))];
    for (const id of ids) {
      if (!photoCache[id]) void ensurePhotometry(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional warm-up on scene/library change
  }, [scene.luminaires, library]);

  async function ensurePhotometry(luminaireId: string): Promise<PhotometricData | null> {
    if (photoCache[luminaireId]) return photoCache[luminaireId]!;
    const res = await fetch(`/api/luminaires/${luminaireId}`);
    if (!res.ok) return null;
    const data = await res.json();
    setPhotoCache((c) => ({ ...c, [luminaireId]: data.photometric }));
    if (data.sourceText) {
      setSourceCache((c) => ({
        ...c,
        [luminaireId]: { filename: data.originalName, text: data.sourceText },
      }));
    }
    return data.photometric as PhotometricData;
  }

  async function save(nextScene = scene, nextResults = results, nextName = name) {
    setSaving(true);
    setStatus(null);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName, scene: nextScene, results: nextResults }),
    });
    setSaving(false);
    if (!res.ok) {
      setStatus("Save failed");
      return;
    }
    setStatus("Saved");
  }

  function updateRoom<K extends keyof SceneJson["room"]>(key: K, value: SceneJson["room"][K]) {
    setScene((s) => ({ ...s, room: { ...s.room, [key]: value } }));
  }

  function placeLuminaireById(
    luminaireId: string,
    opts?: { name?: string; photo?: PhotometricData; currentScene?: SceneJson }
  ): SceneJson | null {
    const base = opts?.currentScene ?? scene;
    const lib = library.find((l) => l.id === luminaireId);
    const photo = opts?.photo ?? photoCache[luminaireId];
    const instanceId = crypto.randomUUID();
    const count = base.luminaires.length;
    const next: SceneJson = {
      ...base,
      luminaires: [
        ...base.luminaires,
        {
          instanceId,
          luminaireId,
          name: opts?.name ?? lib?.name ?? photo?.description ?? "Luminaire",
          position: {
            x: Math.min(base.room.width - 0.5, 1 + (count % 3) * (base.room.width / 3.5)),
            y: Math.min(base.room.depth - 0.5, 1 + Math.floor(count / 3) * (base.room.depth / 3.5)),
            z: Math.max(base.room.height - 0.2, base.room.workplaneHeight + 0.5),
          },
          rotationDeg: 0,
        },
      ],
    };
    setScene(next);
    setSelectedId(instanceId);
    setResults(null);
    return next;
  }

  async function placeLuminaire() {
    if (!placeId) return;
    const photo = await ensurePhotometry(placeId);
    if (!photo) {
      setStatus("Could not load luminaire photometry");
      return;
    }
    placeLuminaireById(placeId, { photo });
  }

  async function onUploadFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name.replace(/\.(ies|ldt)$/i, ""));
      const res = await fetch("/api/luminaires", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data.error || "Upload failed");
        return;
      }
      const lum = data.luminaire as {
        id: string;
        name: string;
        watts: number | null;
        lumens: number | null;
        sourceFormat?: string;
        originalName?: string;
      };
      await loadLibrary();
      setPlaceId(lum.id);

      // Fetch full photometry into cache
      const detail = await fetch(`/api/luminaires/${lum.id}`);
      let photo: PhotometricData | undefined;
      if (detail.ok) {
        const full = await detail.json();
        photo = full.photometric;
        setPhotoCache((c) => ({ ...c, [lum.id]: full.photometric }));
        if (full.sourceText) {
          setSourceCache((c) => ({
            ...c,
            [lum.id]: { filename: full.originalName, text: full.sourceText },
          }));
        }
      }

      if (autoPlaceOnUpload) {
        placeLuminaireById(lum.id, { name: lum.name, photo });
        setStatus(`Imported and placed “${lum.name}”`);
      } else {
        setStatus(`Imported “${lum.name}” to library — select Place in room`);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function updateSelected(patch: {
    rotationDeg?: number;
    name?: string;
    position?: Partial<{ x: number; y: number; z: number }>;
  }) {
    if (!selectedId) return;
    setScene((s) => ({
      ...s,
      luminaires: s.luminaires.map((l) => {
        if (l.instanceId !== selectedId) return l;
        return {
          ...l,
          name: patch.name ?? l.name,
          rotationDeg: patch.rotationDeg ?? l.rotationDeg,
          position: patch.position ? { ...l.position, ...patch.position } : l.position,
        };
      }),
    }));
    setResults(null);
  }

  function removeInstance(instanceId: string) {
    setScene((s) => ({
      ...s,
      luminaires: s.luminaires.filter((l) => l.instanceId !== instanceId),
    }));
    if (selectedId === instanceId) setSelectedId(null);
    setResults(null);
  }

  function removeSelected() {
    if (!selectedId) return;
    removeInstance(selectedId);
  }

  async function runCalc() {
    setCalculating(true);
    setStatus("Calculating on client…");
    try {
      const instances: LuminaireInstance[] = [];
      for (const lum of scene.luminaires) {
        const photo = await ensurePhotometry(lum.luminaireId);
        if (!photo) throw new Error(`Missing photometry for ${lum.name}`);
        const lib = library.find((l) => l.id === lum.luminaireId);
        instances.push({
          id: lum.instanceId,
          name: lum.name,
          position: lum.position,
          rotationDeg: lum.rotationDeg,
          photometry: photo,
          watts: lib?.watts ?? photo.watts,
        });
      }
      const next = await runSolverClient({
        room: scene.room,
        luminaires: instances,
        grid: { spacing: scene.gridSpacing },
        interreflection: scene.calcOptions.interreflection,
        bounces: scene.calcOptions.bounces,
        computeUgr: scene.calcOptions.computeUgr,
      });
      setResults(next);
      setStatus("Calculation complete (client-side)");
      await save(scene, next, name);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Calculation failed");
    } finally {
      setCalculating(false);
    }
  }

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const l of library) map[l.id] = l.name;
    return map;
  }, [library]);

  const placedDetails = useMemo(() => {
    return scene.luminaires.map((lum, index) => {
      const lib = library.find((l) => l.id === lum.luminaireId);
      const photo = photoCache[lum.luminaireId];
      return {
        ...lum,
        index: index + 1,
        watts: lib?.watts ?? photo?.watts ?? null,
        lumens: lib?.lumens ?? photo?.luminousFlux ?? null,
        format: lib?.sourceFormat ?? photo?.format ?? "—",
        manufacturer: photo?.manufacturer || "—",
        catalog: photo?.catalogNumber || lib?.originalName || "—",
      };
    });
  }, [scene.luminaires, library, photoCache]);

  async function onExportLuxsim() {
    const photometry: Record<string, PhotometricData> = {};
    for (const lum of scene.luminaires) {
      const p = await ensurePhotometry(lum.luminaireId);
      if (p) photometry[lum.luminaireId] = p;
    }
    exportLuxsimFile(
      buildLuxsimProject({
        name,
        scene,
        results,
        photometry,
        sourceFiles: sourceCache,
      })
    );
  }

  async function onExportDialux() {
    for (const lum of scene.luminaires) {
      await ensurePhotometry(lum.luminaireId);
    }
    await exportDialuxPack({
      projectName: name,
      scene,
      sourceFiles: sourceCache,
      luminaireNames: names,
    });
  }

  return (
    <div className="w-full px-4 py-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="label" htmlFor="projectName">
            Project
          </label>
          <input
            id="projectName"
            className="input display text-2xl !py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="btn btn-accent" disabled={calculating} onClick={() => void runCalc()}>
            {calculating ? "Calculating…" : "Calculate"}
          </button>
        </div>
      </div>

      <p className="disclaimer">
        Client-side design assist. Results are approximate — not tender-certified. Export a DIALux
        pack to continue detailed work in DIALux evo.
      </p>

      <div className="grid lg:grid-cols-[320px_1fr_320px] gap-4">
        <aside className="panel p-4 space-y-3 self-start">
          <h2 className="font-semibold">Room</h2>
          {(
            [
              ["width", "Width (m)"],
              ["depth", "Depth (m)"],
              ["height", "Height (m)"],
              ["workplaneHeight", "Workplane (m)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                className="input"
                type="number"
                min={0.5}
                step={0.1}
                value={scene.room[key]}
                onChange={(e) => updateRoom(key, Number(e.target.value))}
              />
            </div>
          ))}
          <div className="grid grid-cols-3 gap-2">
            {(["floor", "ceiling", "walls"] as const).map((face) => (
              <div key={face}>
                <label className="label">ρ {face}</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={scene.room.reflectance[face]}
                  onChange={(e) =>
                    updateRoom("reflectance", {
                      ...scene.room.reflectance,
                      [face]: Number(e.target.value),
                    })
                  }
                />
              </div>
            ))}
          </div>
          <div>
            <label className="label">Grid spacing (m)</label>
            <input
              className="input"
              type="number"
              min={0.25}
              max={2}
              step={0.25}
              value={scene.gridSpacing}
              onChange={(e) =>
                setScene((s) => ({ ...s, gridSpacing: Number(e.target.value) }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={scene.calcOptions.interreflection}
              onChange={(e) =>
                setScene((s) => ({
                  ...s,
                  calcOptions: { ...s.calcOptions, interreflection: e.target.checked },
                }))
              }
            />
            Interreflection
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={scene.calcOptions.computeUgr}
              onChange={(e) =>
                setScene((s) => ({
                  ...s,
                  calcOptions: { ...s.calcOptions, computeUgr: e.target.checked },
                }))
              }
            />
            Compute UGR
          </label>

          <FalseColorLegend results={results} />
        </aside>

        <div className="space-y-3">
          <SceneViewer
            scene={scene}
            results={results}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          {results && (
            <div className="panel p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Eave" value={`${results.summary.eave.toFixed(0)} lx`} />
              <Stat
                label="Emin / Uo"
                value={`${results.summary.emin.toFixed(0)} / ${results.summary.uo.toFixed(2)}`}
              />
              <Stat
                label="UGR"
                value={results.summary.ugr != null ? results.summary.ugr.toFixed(1) : "—"}
              />
              <Stat
                label="LPD"
                value={
                  results.summary.lpd != null ? `${results.summary.lpd.toFixed(2)} W/m²` : "—"
                }
              />
            </div>
          )}

          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between">
              <h2 className="font-semibold text-sm">Fixtures in project</h2>
              <span className="text-xs text-[var(--muted)]">
                {placedDetails.length} placed
              </span>
            </div>
            {placedDetails.length === 0 ? (
              <p className="p-4 text-sm text-[var(--muted)]">
                No fixtures placed yet. Upload an IES/LDT or pick one from the library.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#eef3f6] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">lm / W</th>
                      <th className="p-2.5">Pos (m)</th>
                      <th className="p-2.5">Fmt</th>
                      <th className="p-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {placedDetails.map((lum) => {
                      const active = lum.instanceId === selectedId;
                      return (
                        <tr
                          key={lum.instanceId}
                          className={`border-t border-[var(--line)] cursor-pointer ${
                            active ? "bg-[color-mix(in_srgb,var(--accent)_12%,white)]" : "hover:bg-[#f3f7f9]"
                          }`}
                          onClick={() => setSelectedId(lum.instanceId)}
                        >
                          <td className="p-2.5 tabular-nums">{lum.index}</td>
                          <td className="p-2.5">
                            <div className="font-medium">{lum.name}</div>
                            <div className="text-xs text-[var(--muted)] truncate max-w-[160px]">
                              {lum.manufacturer}
                              {lum.catalog !== "—" ? ` · ${lum.catalog}` : ""}
                            </div>
                          </td>
                          <td className="p-2.5 tabular-nums whitespace-nowrap">
                            {lum.lumens != null ? Math.round(lum.lumens) : "—"} /{" "}
                            {lum.watts != null ? Math.round(lum.watts) : "—"}
                          </td>
                          <td className="p-2.5 tabular-nums text-xs whitespace-nowrap">
                            {lum.position.x.toFixed(1)}, {lum.position.y.toFixed(1)},{" "}
                            {lum.position.z.toFixed(1)}
                          </td>
                          <td className="p-2.5 uppercase text-xs">{lum.format}</td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              className="text-xs text-red-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeInstance(lum.instanceId);
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <aside className="panel p-4 space-y-3 self-start">
          <h2 className="font-semibold">Luminaires</h2>

          <div className="space-y-2 rounded border border-dashed border-[var(--line)] p-3 bg-white/60">
            <label className="label">Upload IES / LDT</label>
            <input
              ref={fileInputRef}
              className="input text-sm"
              type="file"
              accept=".ies,.ldt,application/octet-stream"
              disabled={uploading}
              onChange={(e) => void onUploadFile(e.target.files?.[0] ?? null)}
            />
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <input
                type="checkbox"
                checked={autoPlaceOnUpload}
                onChange={(e) => setAutoPlaceOnUpload(e.target.checked)}
              />
              Place in room after import
            </label>
            {uploading && <p className="text-xs text-[var(--accent-2)]">Parsing photometry…</p>}
          </div>

          <div>
            <label className="label">From library</label>
            <select
              className="select"
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
            >
              <option value="">Select…</option>
              {library.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn w-full" disabled={!placeId} onClick={() => void placeLuminaire()}>
            Place in room
          </button>

          {selected && (
            <div className="space-y-2 border-t border-[var(--line)] pt-3">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Selected fixture</p>
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  value={selected.name}
                  onChange={(e) => updateSelected({ name: e.target.value })}
                />
              </div>
              {(["x", "y", "z"] as const).map((axis) => (
                <div key={axis}>
                  <label className="label">{axis.toUpperCase()} (m)</label>
                  <input
                    className="input"
                    type="number"
                    step={0.1}
                    value={selected.position[axis]}
                    onChange={(e) =>
                      updateSelected({
                        position: { [axis]: Number(e.target.value) },
                      })
                    }
                  />
                </div>
              ))}
              <div>
                <label className="label">Rotation (°)</label>
                <input
                  className="input"
                  type="number"
                  step={5}
                  value={selected.rotationDeg}
                  onChange={(e) => updateSelected({ rotationDeg: Number(e.target.value) })}
                />
              </div>
              {(() => {
                const detail = placedDetails.find((d) => d.instanceId === selected.instanceId);
                if (!detail) return null;
                return (
                  <dl className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <dt className="label">Flux</dt>
                      <dd>{detail.lumens != null ? `${Math.round(detail.lumens)} lm` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="label">Power</dt>
                      <dd>{detail.watts != null ? `${Math.round(detail.watts)} W` : "—"}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="label">Catalog / file</dt>
                      <dd className="truncate">{detail.catalog}</dd>
                    </div>
                  </dl>
                );
              })()}
              <button className="btn btn-secondary w-full" onClick={removeSelected}>
                Remove
              </button>
            </div>
          )}

          <div className="border-t border-[var(--line)] pt-3 space-y-2">
            <h3 className="font-semibold text-sm">Export</h3>
            <button
              className="btn btn-secondary w-full"
              onClick={() => exportPdfReport({ projectName: name, scene, results })}
            >
              PDF report
            </button>
            <button className="btn btn-secondary w-full" onClick={() => void onExportLuxsim()}>
              Save .luxsim
            </button>
            <button className="btn btn-secondary w-full" onClick={() => void onExportDialux()}>
              DIALux pack (zip)
            </button>
          </div>
        </aside>
      </div>

      {status && <p className="text-sm text-[var(--muted)]">{status}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
