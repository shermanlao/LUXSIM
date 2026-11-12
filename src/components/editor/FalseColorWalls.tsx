"use client";

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { FalseColorScale, WallSurfaceResult } from "@luxsim/project-io";
import { createWallFalseColorGeometry } from "@/lib/scene-3d-model";

function WallSurfaceMesh({
  surface,
  elevationM,
  scale,
}: {
  surface: WallSurfaceResult;
  elevationM: number;
  scale?: FalseColorScale;
}) {
  const geometry = useMemo(
    () => createWallFalseColorGeometry(surface, elevationM, 0.02, scale),
    [surface, elevationM, scale]
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
        transparent
        opacity={0.92}
        side={THREE.FrontSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export function FalseColorWalls({
  surfaces,
  elevationM = 0,
  scale,
}: {
  surfaces: WallSurfaceResult[];
  elevationM?: number;
  scale?: FalseColorScale;
}) {
  if (!surfaces.length) return null;
  return (
    <group>
      {surfaces.map((surface) => (
        <WallSurfaceMesh key={surface.id} surface={surface} elevationM={elevationM} scale={scale} />
      ))}
    </group>
  );
}
