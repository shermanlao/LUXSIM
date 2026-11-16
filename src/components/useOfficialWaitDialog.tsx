"use client";

import { useCallback, useRef, useState } from "react";
import { OfficialWaitDialog, type OfficialWaitCopy } from "@/components/OfficialWaitDialog";
import { officialWaitAfterPaint } from "@/lib/official-wait-dialog";

/**
 * Show or hide the official wait dialog from an editor or page.
 * `run` shows the dialog for the duration of `work` and hides it after paint.
 */
export function useOfficialWaitDialog() {
  const [copy, setCopy] = useState<OfficialWaitCopy | null>(null);
  const generationRef = useRef(0);

  const show = useCallback((next: OfficialWaitCopy) => {
    generationRef.current += 1;
    setCopy(next);
  }, []);

  const hide = useCallback(async () => {
    const generation = generationRef.current;
    await officialWaitAfterPaint();
    if (generationRef.current === generation) setCopy(null);
  }, []);

  const run = useCallback(async <T,>(next: OfficialWaitCopy, work: () => Promise<T> | T): Promise<T> => {
    const generation = ++generationRef.current;
    setCopy(next);
    try {
      const result = await work();
      await officialWaitAfterPaint();
      return result;
    } finally {
      if (generationRef.current === generation) {
        await officialWaitAfterPaint();
        if (generationRef.current === generation) setCopy(null);
      }
    }
  }, []);

  return {
    dialog: copy ? <OfficialWaitDialog {...copy} /> : null,
    copy,
    show,
    hide,
    run,
    waiting: copy != null,
  };
}
