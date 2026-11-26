"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BuildingEditor } from "@/components/editor/BuildingEditor";
import { ProjectEditorLoadGate } from "@/components/ProjectEditorLoadGate";
import { ProjectLoadingDialog } from "@/components/ProjectLoadingDialog";
import type { OfficialProjectEditorPayload } from "@/lib/official-project-editor-state";
import { officialProjectEditorEtag } from "@/lib/official-project-editor-state";
import {
  officialReadCachedProjectOpen,
  officialTouchCachedProjectOpen,
  officialWriteCachedProjectOpen,
  officialProjectRevisionMatches,
} from "@/lib/official-project-open-cache";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; payload: OfficialProjectEditorPayload }
  | { status: "missing" }
  | { status: "unauthorized" }
  | { status: "error"; message: string };

export function OfficialProjectEditorLoader({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: "loading" });
      try {
        const [cached, revision] = await Promise.all([
          officialReadCachedProjectOpen(userId, projectId),
          fetchProjectRevision(projectId),
        ]);
        if (cancelled) return;

        if (revision.kind === "unauthorized") {
          setState({ status: "unauthorized" });
          return;
        }
        if (revision.kind === "missing") {
          setState({ status: "missing" });
          return;
        }
        if (revision.kind === "error") {
          setState({ status: "error", message: revision.message });
          return;
        }

        if (
          cached &&
          officialProjectRevisionMatches(cached.updatedAt, revision.updatedAt)
        ) {
          void officialTouchCachedProjectOpen(userId, projectId);
          setState({
            status: "ready",
            payload: {
              id: cached.id,
              name: cached.name,
              updatedAt: cached.updatedAt,
              scene: cached.scene,
              results: cached.results,
              assets: cached.assets,
            },
          });
          return;
        }

        const payload = await fetchProjectEditorPayload(
          projectId,
          cached
            ? officialProjectEditorEtag(cached.id, cached.updatedAt)
            : null
        );
        if (cancelled) return;
        if (payload.kind === "unauthorized") {
          setState({ status: "unauthorized" });
          return;
        }
        if (payload.kind === "missing") {
          setState({ status: "missing" });
          return;
        }
        if (payload.kind === "error") {
          setState({ status: "error", message: payload.message });
          return;
        }
        if (payload.kind === "not-modified") {
          // Should not happen: revision already disagreed, or the cache
          // disappeared after we sent its ETag. Fall through as an error
          // rather than opening a snapshot we no longer have.
          if (
            cached &&
            officialProjectRevisionMatches(cached.updatedAt, revision.updatedAt)
          ) {
            void officialTouchCachedProjectOpen(userId, projectId);
            setState({
              status: "ready",
              payload: {
                id: cached.id,
                name: cached.name,
                updatedAt: cached.updatedAt,
                scene: cached.scene,
                results: cached.results,
                assets: cached.assets,
              },
            });
            return;
          }
          setState({
            status: "error",
            message: "Could not load this project. / 無法載入此專案。",
          });
          return;
        }

        void officialWriteCachedProjectOpen({
          userId,
          projectId,
          name: payload.payload.name,
          updatedAt: payload.payload.updatedAt,
          scene: payload.payload.scene,
          results: payload.payload.results,
          assets: payload.payload.assets,
        });
        setState({ status: "ready", payload: payload.payload });
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            message: "Could not load this project. / 無法載入此專案。",
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, userId, retry]);

  useEffect(() => {
    if (state.status === "unauthorized") {
      window.location.replace("/login");
    }
  }, [state.status]);

  if (state.status === "loading") {
    return <ProjectLoadingDialog />;
  }

  if (state.status === "unauthorized") {
    return <ProjectLoadingDialog />;
  }

  if (state.status === "missing" || state.status === "error") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-[var(--muted)]">
        <p>
          {state.status === "missing"
            ? "Project not found. / 找不到此專案。"
            : state.message}
        </p>
        {state.status === "error" ? (
          <button
            type="button"
            className="btn btn-secondary !text-xs"
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry / 重試
          </button>
        ) : null}
        <Link href="/projects" className="hover:text-[var(--accent-2)]">
          Back to Projects / 返回專案列表
        </Link>
      </div>
    );
  }

  return (
    <ProjectEditorLoadGate>
      <BuildingEditor
        projectId={state.payload.id}
        initialName={state.payload.name}
        initialScene={state.payload.scene}
        initialResults={state.payload.results}
        initialAssets={state.payload.assets}
        initialUpdatedAt={state.payload.updatedAt}
        cacheUserId={userId}
      />
    </ProjectEditorLoadGate>
  );
}

type RevisionResult =
  | { kind: "ok"; id: string; name: string; updatedAt: string }
  | { kind: "missing" }
  | { kind: "unauthorized" }
  | { kind: "error"; message: string };

async function fetchProjectRevision(projectId: string): Promise<RevisionResult> {
  const res = await fetch(`/api/projects/${projectId}/revision`, {
    cache: "no-store",
  });
  if (res.status === 401) return { kind: "unauthorized" };
  if (res.status === 404) return { kind: "missing" };
  if (!res.ok) {
    return { kind: "error", message: "Could not load this project. / 無法載入此專案。" };
  }
  const data = (await res.json()) as { id?: string; name?: string; updatedAt?: string };
  if (!data?.id || !data.updatedAt) {
    return { kind: "error", message: "Could not load this project. / 無法載入此專案。" };
  }
  return {
    kind: "ok",
    id: data.id,
    name: typeof data.name === "string" ? data.name : "",
    updatedAt: data.updatedAt,
  };
}

type EditorFetchResult =
  | { kind: "ok"; payload: OfficialProjectEditorPayload }
  | { kind: "not-modified" }
  | { kind: "missing" }
  | { kind: "unauthorized" }
  | { kind: "error"; message: string };

async function fetchProjectEditorPayload(
  projectId: string,
  ifNoneMatch: string | null
): Promise<EditorFetchResult> {
  const headers: HeadersInit = {};
  if (ifNoneMatch) headers["If-None-Match"] = ifNoneMatch;
  const res = await fetch(`/api/projects/${projectId}/editor`, {
    cache: "no-store",
    headers,
  });
  if (res.status === 304) return { kind: "not-modified" };
  if (res.status === 401) return { kind: "unauthorized" };
  if (res.status === 404) return { kind: "missing" };
  if (!res.ok) {
    return { kind: "error", message: "Could not load this project. / 無法載入此專案。" };
  }
  const data = (await res.json()) as OfficialProjectEditorPayload;
  if (!data?.id || !data.updatedAt || !data.scene || !data.results) {
    return { kind: "error", message: "Could not load this project. / 無法載入此專案。" };
  }
  return {
    kind: "ok",
    payload: {
      id: data.id,
      name: data.name,
      updatedAt: data.updatedAt,
      scene: data.scene,
      results: data.results,
      assets: Array.isArray(data.assets) ? data.assets : [],
    },
  };
}
