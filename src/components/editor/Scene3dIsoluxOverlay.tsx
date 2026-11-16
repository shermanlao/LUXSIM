"use client";

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { ProjectSceneV2, ResultsV2, RoomV2 } from "@luxsim/project-io";
import {
  isoluxLabelSpriteScale,
  official3dIsoluxOverlaysForRooms,
  type Official3dIsoluxLabel,
  type Official3dIsoluxOverlay,
} from "@/lib/scene-3d-isolux";

const CONTOUR_COLOR = "#e8eef2";
const CONTOUR_LABEL_FILL = "#f5f7f8";
const VALUE_LABEL_FILL = "#dce8ff";
const LABEL_STROKE = "#0a1218";
const CONTOUR_LABEL_HEIGHT_M = 0.2;
const VALUE_LABEL_HEIGHT_M = 0.16;

function makeLabelTexture(text: string, fill: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "700 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 8;
    ctx.strokeStyle = LABEL_STROKE;
    ctx.fillStyle = fill;
    const x = canvas.width / 2;
    const y = canvas.height / 2;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function IsoluxLabels({
  labels,
  fill,
  heightM,
}: {
  labels: Official3dIsoluxLabel[];
  fill: string;
  heightM: number;
}) {
  const textures = useMemo(
    () => labels.map((label) => makeLabelTexture(label.text, fill)),
    [labels, fill]
  );
  useLayoutEffect(() => {
    return () => {
      for (const texture of textures) texture.dispose();
    };
  }, [textures]);
  const scale = isoluxLabelSpriteScale(heightM);
  return (
    <group>
      {labels.map((label, i) => (
        <sprite key={`${label.text}-${i}`} position={label.position} scale={scale} renderOrder={3}>
          <spriteMaterial
            map={textures[i]}
            transparent
            depthTest
            depthWrite={false}
            sizeAttenuation
          />
        </sprite>
      ))}
    </group>
  );
}

function IsoluxContours({ overlay }: { overlay: Official3dIsoluxOverlay }) {
  const lines = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: CONTOUR_COLOR,
      depthTest: true,
      depthWrite: false,
    });
    const out: THREE.Line[] = [];
    for (const contour of overlay.contours) {
      for (const polyline of contour.polylines) {
        if (polyline.length < 2) continue;
        const geo = new THREE.BufferGeometry();
        geo.setFromPoints(polyline.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
        out.push(new THREE.Line(geo, material));
      }
    }
    return out;
  }, [overlay]);

  useLayoutEffect(() => {
    return () => {
      const mat = lines[0]?.material;
      for (const line of lines) line.geometry.dispose();
      if (mat && !Array.isArray(mat)) mat.dispose();
    };
  }, [lines]);

  return (
    <group>
      {lines.map((line, i) => (
        <primitive key={i} object={line} renderOrder={2} />
      ))}
    </group>
  );
}

export function Scene3dIsoluxOverlay({
  scene,
  rooms,
  results,
  elevationM,
  showValueLabels,
}: {
  scene: ProjectSceneV2;
  rooms: RoomV2[];
  results: ResultsV2;
  elevationM: number;
  showValueLabels: boolean;
}) {
  const overlays = useMemo(
    () => official3dIsoluxOverlaysForRooms(rooms, results, elevationM, scene.instances),
    [rooms, results, elevationM, scene.instances]
  );
  if (overlays.length === 0) return null;
  return (
    <group>
      {overlays.map((overlay) => (
        <group key={overlay.roomId}>
          <IsoluxContours overlay={overlay} />
          <IsoluxLabels labels={overlay.contourLabels} fill={CONTOUR_LABEL_FILL} heightM={CONTOUR_LABEL_HEIGHT_M} />
          {showValueLabels && (
            <IsoluxLabels labels={overlay.valueLabels} fill={VALUE_LABEL_FILL} heightM={VALUE_LABEL_HEIGHT_M} />
          )}
        </group>
      ))}
    </group>
  );
}
