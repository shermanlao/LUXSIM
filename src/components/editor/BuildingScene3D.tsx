"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Edges } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PerspectiveCamera } from "three";
import type { CalcResults } from "@luxsim/solver";
import type { Camera3dView, DxfEntity, ProjectSceneV2, RoomV2 } from "@luxsim/project-io";
import { roomBounds, underlayWorldSize } from "@luxsim/project-io";
import { FalseColorPlane } from "./FalseColorPlane";
import { OrbitViewBridge } from "./OrbitViewBridge";
import { PlanUnderlay3D } from "./PlanUnderlay3D";
import type { PhotometricData } from "@luxsim/photometry";
import { LuminaireBodyMesh } from "./LuminaireBody";

function toThree(x: number, y: number, z: number): [number, number, number] {
  return [x, z, y];
}

function RoomVolume({
  room,
  elev,
  active,
}: {
  room: RoomV2;
  elev: number;
  active: boolean;
}) {
  const geometry = useMemo(() => {
    if (room.polygon.length < 3) return null;
    const shape = new THREE.Shape();
    const first = room.polygon[0]!;
    shape.moveTo(first.x, -first.y);
    for (let i = 1; i < room.polygon.length; i += 1) {
      const p = room.polygon[i]!;
      shape.lineTo(p.x, -p.y);
    }
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.1, room.heightM),
      bevelEnabled: false,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, elev, 0);
    return g;
  }, [room.polygon, room.heightM, elev]);

  useLayoutEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        transparent
        opacity={active ? 0.06 : 0.02}
        color={active ? "#c45c26" : "#8aa0ad"}
        side={THREE.DoubleSide}
      />
      <Edges color={active ? "#c45c26" : "#8aa0ad"} />
    </mesh>
  );
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
      const cam = camera as PerspectiveCamera;
      cam.aspect = width / height;
      cam.updateProjectionMatrix();
      set({ size: { width, height, top: 0, left: 0 } });
    };
    apply();
    const ro = new ResizeObserver(() => requestAnimationFrame(apply));
    ro.observe(el);
    return () => ro.disconnect();
  }, [gl, camera, set]);
  return null;
}

export function BuildingScene3D({
  scene,
  results,
  selectedId,
  onSelect,
  onDropLuminaire,
  className = "h-[520px]",
  underlayUrl,
  dxfEntities = [],
  onUnderlaySourceSize,
  viewRef,
  initialView,
  photometry,
}: {
  scene: ProjectSceneV2;
  results: CalcResults | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDropLuminaire: (luminaireId: string, x: number, y: number, z: number) => void;
  className?: string;
  underlayUrl?: string | null;
  dxfEntities?: DxfEntity[];
  onUnderlaySourceSize?: (widthPx: number, heightPx: number) => void;
  viewRef: React.MutableRefObject<Camera3dView | null>;
  initialView: Camera3dView | null;
  photometry?: Record<string, PhotometricData>;
}) {
  const storeyId = scene.ui.activeStoreyId;
  const storey = scene.storeys.find((s) => s.id === storeyId);
  const rooms = scene.rooms.filter((r) => r.storeyId === storeyId);
  const instances = scene.instances.filter((i) => i.storeyId === storeyId);
  const underlay = scene.underlays.find((u) => u.storeyId === storeyId);
  const elev = storey?.elevationM ?? 0;

  const center = useMemo(() => {
    if (rooms.length) {
      let sx = 0,
        sy = 0,
        n = 0;
      for (const r of rooms) {
        const b = roomBounds(r);
        sx += (b.minX + b.maxX) / 2;
        sy += (b.minY + b.maxY) / 2;
        n += 1;
      }
      return { x: sx / n, y: sy / n, z: elev + (storey?.heightM ?? 3) * 0.4 };
    }
    const size = underlay ? underlayWorldSize(underlay) : null;
    if (underlay && size) {
      return {
        x: underlay.offsetX + size.widthM / 2,
        y: underlay.offsetY + size.heightM / 2,
        z: elev + (storey?.heightM ?? 3) * 0.4,
      };
    }
    return { x: 4, y: 3, z: elev + 1.4 };
  }, [rooms, elev, storey?.heightM, underlay]);

  const defaultTarget = toThree(center.x, center.y, center.z);
  const defaultPosition: [number, number, number] = [
    center.x + 8,
    center.z + 6,
    center.y + 8,
  ];
  const startPosition = useRef(initialView?.position ?? viewRef.current?.position ?? defaultPosition);
  const startTarget = useRef(initialView?.target ?? viewRef.current?.target ?? defaultTarget);

  return (
    <div
      className={`relative w-full bg-[#0f1c24] ${className}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const luminaireId = e.dataTransfer.getData("application/x-luxsim-luminaire");
        if (!luminaireId) return;
        const room =
          scene.rooms.find((r) => r.id === scene.ui.activeRoomId) ?? rooms[0];
        if (!room) return;
        const b = roomBounds(room);
        onDropLuminaire(
          luminaireId,
          (b.minX + b.maxX) / 2,
          (b.minY + b.maxY) / 2,
          room.heightM - 0.1
        );
      }}
    >
      <Canvas
        camera={{
          position: startPosition.current,
          fov: 45,
        }}
        style={{ position: "absolute", inset: 0 }}
        resize={{ debounce: 0 }}
      >
        <ViewportSync />
        <color attach="background" args={["#0f1c24"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[20, 30, 10]} intensity={0.85} />

        {underlay && underlayUrl && (
          <PlanUnderlay3D
            underlay={underlay}
            underlayUrl={underlayUrl}
            elevationM={elev}
            dxfEntities={dxfEntities}
            onSourceSize={onUnderlaySourceSize}
          />
        )}

        {rooms.map((room) => (
          <group
            key={room.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
            }}
          >
            <RoomVolume
              room={room}
              elev={elev}
              active={room.id === scene.ui.activeRoomId}
            />
          </group>
        ))}

        {results && scene.ui.activeRoomId && (
          <FalseColorPlane
            results={results}
            offset={{
              x: roomBounds(
                scene.rooms.find((r) => r.id === scene.ui.activeRoomId)!
              ).minX,
              y: roomBounds(
                scene.rooms.find((r) => r.id === scene.ui.activeRoomId)!
              ).minY,
              z: elev,
            }}
          />
        )}

        {instances.map((lum) => {
          const selected = lum.instanceId === selectedId;
          return (
            <group
              key={lum.instanceId}
              position={toThree(
                lum.position.x,
                lum.position.y,
                elev + lum.position.z
              )}
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
