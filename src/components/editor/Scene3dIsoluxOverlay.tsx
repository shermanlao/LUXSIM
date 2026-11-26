"use client";

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { ProjectSceneV2, ResultsV2, RoomV2 } from "@luxsim/project-io";
import { isolineSettingsFromUi } from "@luxsim/project-io";
import {
  ISOLUX_CONTOUR_COLOR,
  ISOLUX_CONTOUR_LABEL_FILL,
  ISOLUX_CONTOUR_LABEL_HEIGHT_M,
  ISOLUX_VALUE_LABEL_FILL,
  ISOLUX_VALUE_LABEL_HEIGHT_M,
  createOfficial3dIsoluxLabelTexture,
  isoluxLabelSpriteScale,
  official3dIsoluxOverlaysForRooms,
  type Official3dIsoluxLabel,
  type Official3dIsoluxOverlay,
} from "@/lib/scene-3d-isolux";

function makeLabelTexture(text: string, fill: string): THREE.CanvasTexture {
  return createOfficial3dIsoluxLabelTexture(text, fill) ?? new THREE.CanvasTexture(document.createElement("canvas"));
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
      color: ISOLUX_CONTOUR_COLOR,
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
  showWorkplane = true,
}: {
  scene: ProjectSceneV2;
  rooms: RoomV2[];
  results: ResultsV2;
  elevationM: number;
  showValueLabels: boolean;
  showWorkplane?: boolean;
}) {
  const isolineSettings = isolineSettingsFromUi(scene.ui);
  const overlays = useMemo(
    () =>
      official3dIsoluxOverlaysForRooms(rooms, results, elevationM, scene.instances, {
        showWorkplane,
        isolineSettings,
      }),
    [rooms, results, elevationM, scene.instances, showWorkplane, isolineSettings.mode, isolineSettings.levels]
  );
  if (overlays.length === 0) return null;
  return (
    <group>
      {overlays.map((overlay) => (
        <group key={overlay.roomId}>
          <IsoluxContours overlay={overlay} />
          <IsoluxLabels labels={overlay.contourLabels} fill={ISOLUX_CONTOUR_LABEL_FILL} heightM={ISOLUX_CONTOUR_LABEL_HEIGHT_M} />
          {showValueLabels && (
            <IsoluxLabels labels={overlay.valueLabels} fill={ISOLUX_VALUE_LABEL_FILL} heightM={ISOLUX_VALUE_LABEL_HEIGHT_M} />
          )}
        </group>
      ))}
    </group>
  );
}
