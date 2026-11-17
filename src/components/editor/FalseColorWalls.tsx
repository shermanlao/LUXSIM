"use client";

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { FalseColorScale, IsoluxPalette, WallSurfaceResult } from "@luxsim/project-io";
import { WALL_FALSE_COLOR_INSET_M, createWallFalseColorGeometry } from "@/lib/scene-3d-model";

function WallSurfaceMesh({
  surface,
  elevationM,
  scale,
  palette = "falsecolor",
}: {
  surface: WallSurfaceResult;
  elevationM: number;
  scale?: FalseColorScale;
  palette?: IsoluxPalette;
}) {
  const geometry = useMemo(
    () => createWallFalseColorGeometry(surface, elevationM, WALL_FALSE_COLOR_INSET_M, scale, palette),
    [surface, elevationM, scale, palette]
  );
  useLayoutEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        vertexColors
        side={THREE.FrontSide}
        depthWrite
        toneMapped={false}
      />
    </mesh>
  );
}

export function FalseColorWalls({
  surfaces,
  elevationM = 0,
  scale,
  palette = "falsecolor",
}: {
  surfaces: WallSurfaceResult[];
  elevationM?: number;
  scale?: FalseColorScale;
  palette?: IsoluxPalette;
}) {
  if (!surfaces.length) return null;
  return (
    <group>
      {surfaces.map((surface) => (
        <WallSurfaceMesh
          key={surface.id}
          surface={surface}
          elevationM={elevationM}
          scale={scale}
          palette={palette}
        />
      ))}
    </group>
  );
}
