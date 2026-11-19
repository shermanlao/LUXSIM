"use client";

import type { PhotometricData } from "@luxsim/photometry";
import { luminaireBody, type LuminaireBody as Body } from "@luxsim/photometry";

export function housingColors(body: Body, selected: boolean) {
  if (selected) {
    return { housing: "#c45c26", bezel: "#e07038", aperture: "#f8e7b0" };
  }
  if (body.housing === "black") {
    return { housing: "#2a2a2c", bezel: "#1a1a1c", aperture: "#f3e2b0" };
  }
  return { housing: "#d4d0c8", bezel: "#ece8e0", aperture: "#f3e2b0" };
}

/** Recessed downlight (or rectangular body) sized from the IES luminous opening. */
export function LuminaireBodyMesh({
  photo,
  selected = false,
}: {
  photo?: PhotometricData | null;
  selected?: boolean;
}) {
  const body = luminaireBody(photo);
  const c = housingColors(body, selected);
  const h = body.heightM;
  const bezelH = Math.min(0.005, h * 0.2);

  if (body.isCircular) {
    const r = (body.diameterM ?? body.widthM) / 2;
    const bezelR = r * 1.12;
    const apertureR = r * 0.68;
    return (
      <group>
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[r, r, h, 32]} />
          <meshStandardMaterial color={c.housing} roughness={0.55} metalness={0.15} />
        </mesh>
        <mesh position={[0, -h / 2 + bezelH / 2, 0]}>
          <cylinderGeometry args={[bezelR, bezelR, bezelH, 32]} />
          <meshStandardMaterial color={c.bezel} roughness={0.4} metalness={0.08} />
        </mesh>
        <mesh position={[0, -h / 2 - 0.0008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[apertureR, 32]} />
          <meshBasicMaterial color={c.aperture} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[body.widthM, h, body.lengthM]} />
        <meshStandardMaterial color={c.housing} roughness={0.55} metalness={0.12} />
      </mesh>
      <mesh position={[0, -h / 2 - 0.0008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[body.widthM * 0.72, body.lengthM * 0.72]} />
        <meshBasicMaterial color={c.aperture} />
      </mesh>
    </group>
  );
}

export function planSymbolGeom(photo: PhotometricData | undefined, scale: number, minPx = 3.5) {
  const body = luminaireBody(photo);
  const rx = Math.max((body.widthM / 2) * scale, minPx);
  const ry = Math.max((body.lengthM / 2) * scale, minPx);
  return { body, rx, ry, hitR: Math.max(rx, ry, 7) };
}
