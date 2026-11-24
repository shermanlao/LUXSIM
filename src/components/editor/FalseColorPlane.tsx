"use client";

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { CalcResults } from "@luxsim/solver";
import type { FalseColorScale, IsoluxPalette, RoomV2 } from "@luxsim/project-io";
import {
  createClippedWorkplaneGeometry,
  createOfficialFalseColorWorkplane,
} from "@/lib/scene-3d-model";

export function FalseColorPlane({
  room,
  results,
  elevationM = 0,
  scale,
  palette = "falsecolor",
  showWorkplane = true,
  targetLongSide = 800,
}: {
  room: RoomV2;
  results: CalcResults;
  elevationM?: number;
  scale?: FalseColorScale;
  palette?: IsoluxPalette;
  showWorkplane?: boolean;
  /** Live false-colour bitmap long side. Defaults to the official 800. */
  targetLongSide?: number;
}) {
  const official = useMemo(
    () =>
      createOfficialFalseColorWorkplane(
        room,
        results,
        elevationM,
        scale,
        palette,
        showWorkplane,
        targetLongSide
      ),
    [room, results, elevationM, scale, palette, showWorkplane, targetLongSide]
  );
  const fallback = useMemo(
    () =>
      official
        ? null
        : createClippedWorkplaneGeometry(room, results, elevationM, scale, palette, showWorkplane),
    [official, room, results, elevationM, scale, palette, showWorkplane]
  );

  useLayoutEffect(() => {
    return () => {
      official?.geometry.dispose();
      official?.material.dispose();
      official?.texture.dispose();
      fallback?.dispose();
    };
  }, [official, fallback]);

  if (official) {
    return <mesh geometry={official.geometry} material={official.material} />;
  }
  if (!fallback) return null;
  return (
    <mesh geometry={fallback}>
      <meshBasicMaterial
        vertexColors
        side={THREE.DoubleSide}
        depthWrite
        toneMapped={false}
      />
    </mesh>
  );
}
