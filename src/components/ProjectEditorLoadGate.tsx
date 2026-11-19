"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ProjectLoadingDialog } from "@/components/ProjectLoadingDialog";

/**
 * Keeps the official project loading dialog up until the editor has mounted
 * and painted, then dismisses it. The editor tree stays mounted underneath.
 */
export function ProjectEditorLoadGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let frame2 = 0;
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, []);

  return (
    <>
      {!ready && <ProjectLoadingDialog />}
      {children}
    </>
  );
}
