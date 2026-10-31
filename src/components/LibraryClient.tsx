"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { PhotometricData } from "@luxsim/photometry";
import { PolarPreview } from "@/components/PolarPreview";

type LumRow = {
  id: string;
  name: string;
  sourceFormat: string;
  originalName: string;
  watts: number | null;
  lumens: number | null;
};

export function LibraryClient() {
  const [items, setItems] = useState<LumRow[]>([]);
  const [selected, setSelected] = useState<{
    id: string;
    name: string;
    photometric: PhotometricData;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/luminaires");
    if (!res.ok) return;
    setItems(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/luminaires", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(data.error || "Upload failed");
      return;
    }
    e.currentTarget.reset();
    await load();
    if (data.luminaire?.id) {
      await openDetail(data.luminaire.id);
    }
  }

  async function openDetail(id: string) {
    const res = await fetch(`/api/luminaires/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setSelected({
      id: data.id,
      name: data.name,
      photometric: data.photometric,
    });
  }

  async function remove(id: string) {
    if (!confirm("Delete this luminaire?")) return;
    await fetch(`/api/luminaires/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    await load();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="display text-4xl mb-2">Luminaire library</h1>
      <p className="text-[var(--muted)] mb-8">
        Import your own IES / LDT files. No manufacturer catalog in v1.
      </p>

      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6">
        <div className="space-y-6">
          <form onSubmit={onUpload} className="panel p-5 space-y-3">
            <h2 className="font-semibold">Upload photometry</h2>
            <div>
              <label className="label" htmlFor="name">
                Display name (optional)
              </label>
              <input className="input" id="name" name="name" placeholder="Office downlight 30W" />
            </div>
            <div>
              <label className="label" htmlFor="file">
                IES or LDT file
              </label>
              <input className="input" id="file" name="file" type="file" accept=".ies,.ldt" required />
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button className="btn" disabled={uploading}>
              {uploading ? "Parsing…" : "Import"}
            </button>
          </form>

          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#eef3f6] text-left">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Format</th>
                  <th className="p-3">lm / W</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--line)]">
                    <td className="p-3">
                      <button
                        type="button"
                        className="text-left hover:text-[var(--accent-2)]"
                        onClick={() => void openDetail(item.id)}
                      >
                        {item.name}
                      </button>
                    </td>
                    <td className="p-3 uppercase">{item.sourceFormat}</td>
                    <td className="p-3">
                      {item.lumens ? Math.round(item.lumens) : "—"} /{" "}
                      {item.watts ? Math.round(item.watts) : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        className="text-red-700 text-xs"
                        onClick={() => void remove(item.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-[var(--muted)]">
                      No luminaires yet — import an IES or LDT file.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel p-5">
          {selected ? (
            <div>
              <h2 className="display text-2xl mb-1">{selected.name}</h2>
              <p className="text-sm text-[var(--muted)] mb-4">
                {selected.photometric.manufacturer || "Unknown manufacturer"} ·{" "}
                {selected.photometric.description}
              </p>
              <PolarPreview photo={selected.photometric} />
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="label">Flux</dt>
                  <dd>{selected.photometric.luminousFlux?.toFixed(0) ?? "—"} lm</dd>
                </div>
                <div>
                  <dt className="label">Watts</dt>
                  <dd>{selected.photometric.watts?.toFixed(1) ?? "—"} W</dd>
                </div>
                <div>
                  <dt className="label">V angles</dt>
                  <dd>{selected.photometric.verticalAngles.length}</dd>
                </div>
                <div>
                  <dt className="label">H angles</dt>
                  <dd>{selected.photometric.horizontalAngles.length}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="text-[var(--muted)]">Select a luminaire to preview its polar curve.</p>
          )}
        </div>
      </div>
    </div>
  );
}
