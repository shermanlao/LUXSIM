"use client";

import { useCallback, useEffect, useState } from "react";
import type { FalseColorScale, IsoluxPalette } from "@luxsim/project-io";
import { storedFalseColorScale } from "@luxsim/project-io";
import {
  FALSE_COLOR_TEMPLATE_COPY,
  parseFalseColorScaleTemplates,
  type FalseColorScaleTemplate,
} from "@/lib/false-color-scale-templates";

type SaveResult =
  | { ok: true; templates: FalseColorScaleTemplate[]; template: FalseColorScaleTemplate; overwritten: boolean }
  | { ok: false; error: string };

type DeleteResult = { ok: true; templates: FalseColorScaleTemplate[] } | { ok: false; error: string };

export function useFalseColorScaleTemplates(projectId: string, enabled: boolean) {
  const [templates, setTemplates] = useState<FalseColorScaleTemplate[]>([]);
  const [ready, setReady] = useState(!enabled);
  const [error, setError] = useState<string | null>(null);
  const endpoint = `/api/projects/${projectId}/false-color-templates`;

  useEffect(() => {
    if (!enabled) {
      setTemplates([]);
      setReady(true);
      setError(null);
      return;
    }
    const ac = new AbortController();
    setReady(false);
    void (async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store", signal: ac.signal });
        if (!res.ok) throw new Error(FALSE_COLOR_TEMPLATE_COPY.loadFailed);
        const data = (await res.json()) as { templates?: unknown };
        if (ac.signal.aborted) return;
        setTemplates(parseFalseColorScaleTemplates(data.templates));
        setError(null);
      } catch (e) {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : FALSE_COLOR_TEMPLATE_COPY.loadFailed);
      } finally {
        if (!ac.signal.aborted) setReady(true);
      }
    })();
    return () => ac.abort();
  }, [enabled, endpoint]);

  const saveTemplate = useCallback(
    async (name: string, scale: FalseColorScale, palette: IsoluxPalette): Promise<SaveResult> => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, scale, palette }),
        });
        const data = (await res.json().catch(() => null)) as
          | { templates?: unknown; template?: unknown; overwritten?: boolean; error?: string }
          | null;
        if (!res.ok) {
          return { ok: false, error: data?.error ?? FALSE_COLOR_TEMPLATE_COPY.saveFailed };
        }
        const templates = parseFalseColorScaleTemplates(data?.templates);
        const template = templates.find((item) => item.id === (data?.template as { id?: string } | undefined)?.id);
        if (!template) {
          return { ok: false, error: FALSE_COLOR_TEMPLATE_COPY.saveFailed };
        }
        setTemplates(templates);
        setError(null);
        return { ok: true, templates, template, overwritten: data?.overwritten === true };
      } catch {
        return { ok: false, error: FALSE_COLOR_TEMPLATE_COPY.saveFailed };
      }
    },
    [endpoint]
  );

  const deleteTemplate = useCallback(
    async (templateId: string): Promise<DeleteResult> => {
      try {
        const res = await fetch(`${endpoint}/${encodeURIComponent(templateId)}`, { method: "DELETE" });
        const data = (await res.json().catch(() => null)) as { templates?: unknown; error?: string } | null;
        if (!res.ok) {
          return { ok: false, error: data?.error ?? FALSE_COLOR_TEMPLATE_COPY.deleteFailed };
        }
        const templates = parseFalseColorScaleTemplates(data?.templates);
        setTemplates(templates);
        setError(null);
        return { ok: true, templates };
      } catch {
        return { ok: false, error: FALSE_COLOR_TEMPLATE_COPY.deleteFailed };
      }
    },
    [endpoint]
  );

  const rememberScale = useCallback(
    async (scale: FalseColorScale, templateId: string | null, palette: IsoluxPalette): Promise<boolean> => {
      if (!enabled) return false;
      try {
        const res = await fetch(`/api/projects/${projectId}/false-color-scale-memory`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scale: storedFalseColorScale(scale),
            templateId,
            palette,
          }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [enabled, projectId]
  );

  return { templates, ready, error, saveTemplate, deleteTemplate, rememberScale };
}
