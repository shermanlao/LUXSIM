"use client";

import { Line } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { DxfEntity, Underlay } from "@luxsim/project-io";
import {
  legacyScaleToMetersPerPixel,
  underlayWorldSize,
} from "@luxsim/project-io";

type Props = {
  underlay: Underlay;
  underlayUrl: string;
  elevationM: number;
  dxfEntities?: DxfEntity[];
  onSourceSize?: (widthPx: number, heightPx: number) => void;
};

/**
 * Floor-plan underlay in 3D — same world size / aspect as Top view.
 * Texture faces +Y (readable when looking down).
 */
export function PlanUnderlay3D({
  underlay,
  underlayUrl,
  elevationM,
  dxfEntities = [],
  onSourceSize,
}: Props) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [resolvedPx, setResolvedPx] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    setTexture(null);
    setResolvedPx(null);

    if (underlay.kind !== "image" && underlay.kind !== "pdf") {
      return;
    }

    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const tex = loader.load(
      underlayUrl,
      (loaded) => {
        if (cancelled) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = THREE.SRGBColorSpace;
        // Match Top look-down: Y-flip un-inverts the plan (same as 2D underlay).
        loaded.flipY = false;
        loaded.wrapT = THREE.RepeatWrapping;
        loaded.repeat.y = -1;
        loaded.offset.y = 1;
        loaded.needsUpdate = true;
        const img = loaded.image as { width?: number; height?: number };
        const width = img?.width ?? 0;
        const height = img?.height ?? 0;
        if (width > 0 && height > 0) {
          setResolvedPx({ width, height });
          onSourceSize?.(width, height);
        }
        setTexture(loaded);
      },
      undefined,
      () => {
        if (!cancelled) {
          setTexture(null);
          setResolvedPx(null);
        }
      }
    );

    return () => {
      cancelled = true;
      tex.dispose();
    };
  }, [underlay.id, underlay.kind, underlayUrl, onSourceSize]);

  const size = useMemo(() => {
    const widthPx = underlay.sourceWidthPx ?? resolvedPx?.width;
    const heightPx = underlay.sourceHeightPx ?? resolvedPx?.height;
    if (!(widthPx && heightPx)) return null;
    const metersPerUnit =
      underlay.sourceWidthPx && underlay.sourceHeightPx
        ? underlay.metersPerUnit
        : legacyScaleToMetersPerPixel(underlay.metersPerUnit, widthPx);
    return underlayWorldSize({
      sourceWidthPx: widthPx,
      sourceHeightPx: heightPx,
      metersPerUnit,
    });
  }, [underlay, resolvedPx]);

  const floorY = elevationM - 0.02;

  const geometry = useMemo(() => {
    if (!size) return null;
    const geo = new THREE.PlaneGeometry(size.widthM, size.heightM);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [size]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  return (
    <group>
      {texture && size && geometry && (
        <mesh
          geometry={geometry}
          position={[
            underlay.offsetX + size.widthM / 2,
            floorY,
            underlay.offsetY + size.heightM / 2,
          ]}
          renderOrder={-2}
        >
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={underlay.opacity}
            depthTest
            depthWrite
            polygonOffset
            polygonOffsetFactor={4}
            polygonOffsetUnits={4}
            side={THREE.FrontSide}
            toneMapped={false}
          />
        </mesh>
      )}

      {dxfEntities.map((ent, idx) => {
        if (ent.points.length < 2) return null;
        const points = ent.points.map(
          (p) => [p.x, floorY + 0.005, p.y] as [number, number, number]
        );
        return (
          <Line
            key={`dxf-${idx}`}
            points={points}
            color="#6a8a9a"
            lineWidth={1}
            transparent
            opacity={Math.min(1, underlay.opacity + 0.1)}
            depthWrite={false}
          />
        );
      })}
    </group>
  );
}
