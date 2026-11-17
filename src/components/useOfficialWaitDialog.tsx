"use client";

import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { OfficialWaitDialog, type OfficialWaitCopy } from "@/components/OfficialWaitDialog";
import { officialWaitAfterPaint, officialWaitBeforeWork } from "@/lib/official-wait-dialog";

/**
 * Show or hide the official wait dialog from an editor or page.
 * `run` shows the dialog, waits for it to paint, runs `work`, then hides it after paint.
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
    flushSync(() => {
      setCopy(next);
    });
    await officialWaitBeforeWork();
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
