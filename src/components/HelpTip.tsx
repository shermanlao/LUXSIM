"use client";

import { useEffect, useId, useState } from "react";
import { UI_TIPS } from "@/lib/ui-tips";

type Tip = { helpKey: string; title: string; body: string };

export function HelpTip({ helpKey }: { helpKey: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState<Tip | null>(
    () => UI_TIPS.find((t) => t.helpKey === helpKey) ?? null
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tips/${encodeURIComponent(helpKey)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.helpKey) return;
        setTip({ helpKey: data.helpKey, title: data.title, body: data.body });
      })
      .catch(() => {
        /* keep seed fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [helpKey]);

  if (!tip) return null;

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        className="btn btn-secondary !px-2 !py-1 !text-xs"
        aria-expanded={open}
        aria-controls={id}
        title={tip.title}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <div
          id={id}
          role="tooltip"
          className="absolute z-20 right-0 top-full mt-1 w-56 panel p-2 text-xs shadow-none"
        >
          <p className="font-semibold mb-1">{tip.title}</p>
          <p className="text-[var(--muted)] leading-snug">{tip.body}</p>
        </div>
      )}
    </span>
  );
}
