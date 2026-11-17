"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { OfficialWaitDialog } from "@/components/OfficialWaitDialog";
import { ProjectLoadingDialog } from "@/components/ProjectLoadingDialog";
import { LUXSIM_PROJECT_FILE_ACCEPT } from "@luxsim/project-io";
import { OFFICIAL_WAIT_COPY } from "@/lib/official-wait-dialog";
import { storeImportLuxsimWarnings } from "@/lib/import-luxsim-warnings";

type WorkspaceOption = { id: string; name: string };

export function ProjectsListActions({ workspaces = [] }: { workspaces?: WorkspaceOption[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [orgId, setOrgId] = useState(workspaces[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const busy = creating || importing || opening;
  const disabled = workspaces.length === 0 || busy;

  async function create() {
    setCreating(true);
    setImportError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Untitled room",
        orgId: orgId || undefined,
      }),
    });
    setCreating(false);
    if (!res.ok) {
      setImportError("Could not create a project");
      return;
    }
    const project = await res.json();
    setOpening(true);
    router.push(`/projects/${project.id}`);
    router.refresh();
  }

  async function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportError(null);
    const form = new FormData();
    form.set("file", file);
    if (orgId) form.set("orgId", orgId);
    const res = await fetch("/api/projects/import-luxsim", {
      method: "POST",
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      error?: string;
      warnings?: string[];
    };
    setImporting(false);
    if (!res.ok || !data.id) {
      setImportError(data.error || "Not a valid LUXSIM project file");
      return;
    }
    if (Array.isArray(data.warnings) && data.warnings.length) {
      storeImportLuxsimWarnings(data.id, data.warnings);
    }
    setOpening(true);
    router.push(`/projects/${data.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {creating && !opening && <OfficialWaitDialog {...OFFICIAL_WAIT_COPY.creatingProject} />}
      {importing && !opening && <OfficialWaitDialog {...OFFICIAL_WAIT_COPY.openingProjectFile} />}
      {opening && <ProjectLoadingDialog />}
      <div className="flex flex-wrap items-center gap-2">
        {workspaces.length > 1 && (
          <label className="sr-only" htmlFor="new-project-workspace">
            Workspace
          </label>
        )}
        {workspaces.length > 1 && (
          <select
            id="new-project-workspace"
            className="select !w-auto"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            disabled={busy}
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        )}
        <button
          className="btn btn-accent"
          disabled={disabled}
          onClick={() => void create()}
        >
          {creating ? "Creating…" : "New project"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
        >
          {importing ? "Opening…" : "Open .lux"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={LUXSIM_PROJECT_FILE_ACCEPT}
          className="sr-only"
          onChange={(e) => void onPickFile(e)}
        />
      </div>
      {importError && (
        <p className="text-sm text-red-400 max-w-md text-right">{importError}</p>
      )}
    </div>
  );
}

/** @deprecated use ProjectsListActions — kept so existing imports keep working */
export function CreateProjectButton({ workspaces = [] }: { workspaces?: WorkspaceOption[] }) {
  return <ProjectsListActions workspaces={workspaces} />;
}
