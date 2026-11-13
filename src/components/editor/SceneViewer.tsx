"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalcResults } from "@luxsim/solver";
import type { Display3dMode, FalseColorScale, SceneJson } from "@luxsim/project-io";
import { normalizeFalseColorScale } from "@luxsim/project-io";
import { RoomScene, type CameraViewState } from "./RoomScene";
import { FalseColorLegend } from "./FalseColorLegend";
import { Display3dToggle } from "./Display3dToggle";

export function SceneViewer({
  scene,
  results,
  selectedId,
  onSelect,
  photometry,
}: {
  scene: SceneJson;
  results: CalcResults | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  photometry?: Record<string, import("@luxsim/photometry").PhotometricData>;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [display3d, setDisplay3d] = useState<Display3dMode>(results ? "falsecolor" : "greyscale");
  const viewRef = useRef<CameraViewState | null>(null);
  const [seedView, setSeedView] = useState<CameraViewState | null>(null);
  const autoScale = useMemo<FalseColorScale>(
    () =>
      normalizeFalseColorScale(results?.summary.emin ?? 56, results?.summary.emax ?? 500),
    [results?.summary.emin, results?.summary.emax]
  );
  const [scale, setScale] = useState<FalseColorScale>(autoScale);
  const [scalePinned, setScalePinned] = useState(false);
  useEffect(() => {
    if (!scalePinned) setScale(autoScale);
  }, [autoScale, scalePinned]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  function toggleFullscreen() {
    if (viewRef.current) setSeedView({ ...viewRef.current });
    setFullscreen((v) => !v);
  }

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[100] bg-[#0f1c24] flex flex-col"
          : "panel relative overflow-hidden flex flex-col"
      }
    >
      <div className="absolute top-3 left-3 z-10">
        <Display3dToggle value={display3d} onChange={setDisplay3d} />
      </div>
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <button
          type="button"
          className="btn btn-secondary !py-1.5 !px-3 !text-xs !bg-white/90 backdrop-blur"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {fullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
      </div>

      {fullscreen && (
        <p className="absolute top-3 left-3 z-10 mt-10 text-xs text-white/70">
          Esc to exit · orbit drag · scroll zoom
        </p>
      )}

      <div className={fullscreen ? "relative flex-1 min-h-0" : "relative h-[520px] w-full"}>
        <RoomScene
          scene={scene}
          results={results}
          display3d={display3d}
          selectedId={selectedId}
          onSelect={onSelect}
          className="h-full w-full"
          viewRef={viewRef}
          initialView={seedView}
          photometry={photometry}
          falseColorScale={scale}
        />
      </div>

      {display3d === "falsecolor" && (
        <FalseColorLegend
          results={results}
          scale={scale}
          onChange={(next) => {
            setScalePinned(true);
            setScale(next);
          }}
          onReset={() => {
            setScalePinned(false);
            setScale(autoScale);
          }}
          layout="bar"
          tone="dark"
        />
      )}
    </div>
  );
}
