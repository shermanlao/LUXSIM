"use client";

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { CalcResults } from "@luxsim/solver";
import type { RoomV2 } from "@luxsim/project-io";
import { createClippedWorkplaneGeometry } from "@/lib/scene-3d-model";

export function FalseColorPlane({
  room,
  results,
  elevationM = 0,
}: {
  room: RoomV2;
  results: CalcResults;
  elevationM?: number;
}) {
  const geometry = useMemo(
    () => createClippedWorkplaneGeometry(room, results, elevationM),
    [room, results, elevationM]
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
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
