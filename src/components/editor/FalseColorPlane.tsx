"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { CalcResults } from "@luxsim/solver";
import { luxToRgb } from "@/lib/false-color";

function luxToColor(lux: number): THREE.Color {
  const [r, g, b] = luxToRgb(lux);
  return new THREE.Color(r, g, b);
}

export function FalseColorPlane({
  results,
  offset = { x: 0, y: 0, z: 0 },
}: {
  results: CalcResults;
  offset?: { x: number; y: number; z: number };
}) {
  const { geometry, position } = useMemo(() => {
    const { grid } = results;
    const geo = new THREE.PlaneGeometry(
      grid.spacing * Math.max(grid.nx - 1, 1) || grid.spacing,
      grid.spacing * Math.max(grid.ny - 1, 1) || grid.spacing,
      Math.max(grid.nx - 1, 1),
      Math.max(grid.ny - 1, 1)
    );
    const colors: number[] = [];
    const wSeg = Math.max(grid.nx - 1, 1);
    const hSeg = Math.max(grid.ny - 1, 1);
    for (let j = 0; j <= hSeg; j += 1) {
      for (let i = 0; i <= wSeg; i += 1) {
        const ii = Math.min(i, grid.nx - 1);
        const jj = Math.min(j, grid.ny - 1);
        const lux = grid.lux[jj * grid.nx + ii] ?? 0;
        const c = luxToColor(lux);
        colors.push(c.r, c.g, c.b);
      }
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.rotateX(-Math.PI / 2);
    const pos: [number, number, number] = [
      offset.x + grid.originX + ((grid.nx - 1) * grid.spacing) / 2,
      offset.z + grid.z + 0.02,
      offset.y + grid.originY + ((grid.ny - 1) * grid.spacing) / 2,
    ];
    return { geometry: geo, position: pos };
  }, [results, offset.x, offset.y, offset.z]);

  return (
    <mesh geometry={geometry} position={position}>
      <meshBasicMaterial vertexColors transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}
