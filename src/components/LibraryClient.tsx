"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from "react";
import type { PhotometricData } from "@luxsim/photometry";
import { GenerateLdtForm } from "@/components/GenerateLdtForm";
import { LibraryImportNameDialog } from "@/components/LibraryImportNameDialog";
import { PolarPreview } from "@/components/PolarPreview";
import {
  LIBRARY_INTRO_DISCLAIMER,
  selectedLibraryConeDisclaimer,
} from "@/lib/library-cone-disclaimer";
import type { PendingPhotometryFile } from "@/lib/library-photometry-upload";
import {
  combinePhotometryMessages,
  selectPhotometryFiles,
  uploadPhotometryBatch,
} from "@/lib/library-photometry-upload";
import { libraryConeLabel } from "@/lib/luminaire-origin";
import { photometricColorQualityFields } from "@/lib/photometric-preview-fields";
import { OfficialWaitDialog } from "@/components/OfficialWaitDialog";
import { OFFICIAL_WAIT_COPY } from "@/lib/official-wait-dialog";

type LumRow = {
  id: string;
  name: string;
  sourceFormat: string;
  originalName: string;
  watts: number | null;
  lumens: number | null;
  origin?: string | null;
  libraryFamily?: string | null;
  libraryBeamDeg?: number | null;
};

async function postPhotometryFile(file: File, name: string) {
  const form = new FormData();
  form.set("file", file);
  form.set("name", name);
  const res = await fetch("/api/luminaires", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false as const, error: (data.error as string) || "Upload failed" };
  }
  return { ok: true as const, luminaireId: data.luminaire?.id as string | undefined };
}

export function LibraryClient() {
  const [items, setItems] = useState<LumRow[]>([]);
  const [selected, setSelected] = useState<{
    id: string;
    name: string;
    photometric: PhotometricData;
    origin?: string | null;
    libraryFamily?: string | null;
    libraryBeamDeg?: number | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<{
    items: PendingPhotometryFile[];
    skippedMessage: string | null;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/luminaires");
    if (!res.ok) return;
    setItems(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const preventNavigate = (event: Event) => {
      event.preventDefault();
    };
    window.addEventListener("dragover", preventNavigate);
    window.addEventListener("drop", preventNavigate);
    return () => {
      window.removeEventListener("dragover", preventNavigate);
      window.removeEventListener("drop", preventNavigate);
    };
  }, []);

  async function openDetail(id: string) {
    const res = await fetch(`/api/luminaires/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setSelected({
      id: data.id,
      name: data.name,
      photometric: data.photometric,
      origin: data.origin,
      libraryFamily: data.libraryFamily,
      libraryBeamDeg: data.libraryBeamDeg,
    });
  }

  async function remove(id: string) {
    if (!confirm("Delete this luminaire?")) return;
    await fetch(`/api/luminaires/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    await load();
  }

  function handleIncomingFiles(fileList: FileList | File[] | null | undefined) {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;
    const selection = selectPhotometryFiles(files);
    setError(selection.rejectedMessage);
    if (selection.prompt) {
      setPending({
        items: selection.prompt.items,
        skippedMessage: selection.rejectedMessage,
      });
    }
  }

  function onImportClick() {
    if (uploading || pending) return;
    fileInputRef.current?.click();
  }

  function onFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    event.target.value = "";
    if (uploading || pending) return;
    handleIncomingFiles(files);
  }

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current += 1;
    setDragOver(true);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragOver(false);
    if (uploading || pending) return;
    handleIncomingFiles(event.dataTransfer.files);
  }

  function cancelPending() {
    setPending(null);
  }

  function changePendingName(index: number, displayName: string) {
    setPending((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item, itemIndex) =>
          itemIndex === index ? { ...item, displayName } : item,
        ),
      };
    });
  }

  async function confirmPending() {
    if (!pending || uploading) return;
    const { items: toUpload, skippedMessage } = pending;
    setPending(null);
    setUploading(true);
    setError(null);
    try {
      const outcome = await uploadPhotometryBatch(toUpload, postPhotometryFile);
      await load();
      if (outcome.lastSuccessId) {
        await openDetail(outcome.lastSuccessId);
      }
      setError(combinePhotometryMessages(skippedMessage, outcome.errorMessage));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {uploading && <OfficialWaitDialog {...OFFICIAL_WAIT_COPY.importingPhotometry} />}
      <LibraryImportNameDialog
        open={Boolean(pending)}
        items={pending?.items ?? []}
        onChangeName={changePendingName}
        onCancel={cancelPending}
        onConfirm={() => void confirmPending()}
      />
      <h1 className="display text-4xl mb-2">Luminaire library</h1>
      <p className="text-[var(--muted)] mb-8">
        {LIBRARY_INTRO_DISCLAIMER}
      </p>

      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6">
        <div className="space-y-6">
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
                      {libraryConeLabel(item) && (
                        <div className="text-[10px] text-[var(--muted)]">{libraryConeLabel(item)}</div>
                      )}
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
                      No luminaires yet — import an IES, LDT, or GLDF, or generate a library cone.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="panel p-5">
            <GenerateLdtForm
              onCreated={async (luminaire) => {
                await load();
                await openDetail(luminaire.id);
              }}
            />
          </div>
        </div>

        <div
          className={`panel p-5 library-preview-drop${dragOver ? " is-dragover" : ""}`}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <p className="text-sm text-[var(--muted)]">
              Drop IES, LDT, or GLDF files here to import, or use Import.
            </p>
            <button type="button" className="btn shrink-0" onClick={onImportClick} disabled={uploading}>
              Import
            </button>
          </div>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept=".ies,.ldt,.gldf"
            multiple
            onChange={onFileInputChange}
          />
          {error && <p className="text-sm text-red-700 mb-3 whitespace-pre-wrap">{error}</p>}
          {selected ? (
            <div>
              <h2 className="display text-2xl mb-1">{selected.name}</h2>
              <p className="text-sm text-[var(--muted)] mb-4">
                {libraryConeLabel(selected)
                  ? selectedLibraryConeDisclaimer(libraryConeLabel(selected) ?? "")
                  : `${selected.photometric.manufacturer || "Unknown manufacturer"} · ${selected.photometric.description}`}
              </p>
              {libraryConeLabel(selected) && (
                <p className="text-xs mb-3">
                  <a className="underline" href={`/api/luminaires/${selected.id}/ldt`}>
                    Download .ldt
                  </a>
                  <span className="text-zinc-500">·</span>
                  <a className="underline" href={`/api/luminaires/${selected.id}/gldf`}>
                    Download .gldf
                  </a>
                </p>
              )}
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
                {photometricColorQualityFields(selected.photometric).map((field) => (
                  <div key={field.label}>
                    <dt className="label">{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
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
