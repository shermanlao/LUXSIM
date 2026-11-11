"use client";

import { useLayoutEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Edges } from "@react-three/drei";
import type { PerspectiveCamera } from "three";
import type { CalcResults } from "@luxsim/solver";
import type { SceneJson } from "@luxsim/project-io";
import { FalseColorPlane } from "./FalseColorPlane";
import { OrbitViewBridge, type Camera3dView } from "./OrbitViewBridge";
import type { PhotometricData } from "@luxsim/photometry";
import { LuminaireBodyMesh } from "./LuminaireBody";

export type CameraViewState = Camera3dView;

/** Map room (x, y depth, z height) → Three.js (x, y-up, z) */
function toThree(x: number, y: number, z: number): [number, number, number] {
  return [x, z, y];
}

function ViewportSync() {
  const { gl, camera, set } = useThree();

  useLayoutEffect(() => {
    const el = gl.domElement.parentElement;
    if (!el) return;

    const apply = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 2 || height < 2) return;
      gl.setSize(width, height, false);
      gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      const cam = camera as PerspectiveCamera;
      if (typeof cam.aspect === "number") {
        cam.aspect = width / height;
        cam.updateProjectionMatrix();
      }
      set({
        size: { width, height, top: 0, left: 0 },
      });
    };

    apply();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(apply);
    });
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [gl, camera, set]);

  return null;
}

export function RoomScene({
  scene,
  results,
  selectedId,
  onSelect,
  className = "h-[520px]",
  viewRef,
  initialView,
  photometry,
}: {
  scene: SceneJson;
  results: CalcResults | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
  viewRef: React.MutableRefObject<CameraViewState | null>;
  initialView: CameraViewState | null;
  photometry?: Record<string, PhotometricData>;
}) {
  const { width, depth, height } = scene.room;
  const defaultTarget = toThree(width / 2, depth / 2, height * 0.35);
  const defaultPosition: [number, number, number] = [
    width * 1.15,
    height * 1.6,
    depth * 1.25,
  ];
  // Stable initials — do not pass fresh arrays into OrbitControls each render
  const startPosition = useRef(initialView?.position ?? defaultPosition);
  const startTarget = useRef(initialView?.target ?? defaultTarget);

  return (
    <div className={`relative w-full overflow-hidden bg-[#0f1c24] ${className}`}>
      <Canvas
        camera={{
          position: startPosition.current,
          fov: 45,
        }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        resize={{ debounce: 0, scroll: false }}
      >
        <ViewportSync />
        <color attach="background" args={["#0f1c24"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[width, height * 2, depth]} intensity={0.85} />

        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={toThree(width / 2, depth / 2, 0)}
          onClick={() => onSelect(null)}
        >
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color="#2a3b46" />
        </mesh>

        <mesh position={toThree(width / 2, depth / 2, height / 2)}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial transparent opacity={0} />
          <Edges color="#8aa0ad" />
        </mesh>

        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={toThree(width / 2, depth / 2, scene.room.workplaneHeight)}
        >
          <planeGeometry args={[width * 0.98, depth * 0.98]} />
          <meshBasicMaterial color="#1f6f8b" transparent opacity={0.08} />
        </mesh>

        {results && <FalseColorPlane results={results} />}

        {scene.luminaires.map((lum) => {
          const selected = lum.instanceId === selectedId;
          return (
            <group
              key={lum.instanceId}
              position={toThree(lum.position.x, lum.position.y, lum.position.z)}
              rotation={[0, (-lum.rotationDeg * Math.PI) / 180, 0]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(lum.instanceId);
              }}
            >
              <LuminaireBodyMesh
                photo={photometry?.[lum.luminaireId]}
                selected={selected}
              />
            </group>
          );
        })}

        <OrbitControls makeDefault target={startTarget.current} />
        <OrbitViewBridge viewRef={viewRef} initialView={initialView} />
      </Canvas>
    </div>
  );
}
