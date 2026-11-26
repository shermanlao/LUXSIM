"use client";

import type { PhotometricData } from "@luxsim/photometry";
import { officialLightConeGeom } from "@/lib/fixture-beam-cone";

const noopRaycast = () => {};

type Props = {
  photo?: PhotometricData | null;
  fixtureZ: number;
  room?: { workplaneHeightM: number } | null;
};

/** Selected-fixture emission arrow and beam cone. Pointer hits are disabled. */
export function FixtureEmissionGizmo({ photo, fixtureZ, room }: Props) {
  const geom = officialLightConeGeom({ photo, fixtureZ, room });
  const [ax, ay, az] = geom.apexLocal;
  const length = geom.lengthM;
  const r0 = Math.max(geom.endRadiusC0M, 1e-4);
  const r90 = Math.max(geom.endRadiusC90M, 1e-4);
  const scaleZ = r0 > 1e-6 ? r90 / r0 : 1;
  const arrowLen = Math.min(0.35, Math.max(0.12, length * 0.22));
  const shaftLen = arrowLen * 0.72;
  const headLen = arrowLen - shaftLen;
  const shaftR = 0.007;
  const headR = 0.022;
  const coneCenterY = ay - length / 2;

  return (
    <group raycast={noopRaycast}>
      <mesh
        position={[ax, coneCenterY, az]}
        scale={[1, 1, scaleZ]}
        raycast={noopRaycast}
        renderOrder={3}
      >
        <cylinderGeometry args={[0, r0, length, 48, 1, true]} />
        <meshBasicMaterial
          color="#f3d27a"
          transparent
          opacity={0.16}
          depthWrite={false}
          side={2}
        />
      </mesh>
      <mesh
        position={[ax, coneCenterY, az]}
        scale={[1, 1, scaleZ]}
        raycast={noopRaycast}
        renderOrder={4}
      >
        <cylinderGeometry args={[0, r0, length, 32, 1, true]} />
        <meshBasicMaterial
          color="#ffe9a8"
          wireframe
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[ax, ay - shaftLen / 2, az]} raycast={noopRaycast} renderOrder={5}>
        <cylinderGeometry args={[shaftR, shaftR, shaftLen, 12]} />
        <meshBasicMaterial color="#ffe28a" depthWrite={false} />
      </mesh>
      <mesh
        position={[ax, ay - shaftLen - headLen / 2, az]}
        rotation={[Math.PI, 0, 0]}
        raycast={noopRaycast}
        renderOrder={5}
      >
        <coneGeometry args={[headR, headLen, 16]} />
        <meshBasicMaterial color="#fff4c8" depthWrite={false} />
      </mesh>
    </group>
  );
}
