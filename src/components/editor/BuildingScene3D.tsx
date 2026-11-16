"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Edges } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PerspectiveCamera } from "three";
import type { PhotometricData } from "@luxsim/photometry";
import type {
  Camera3dView,
  Display3dMode,
  DxfEntity,
  FalseColorScale,
  ProjectSceneV2,
  ResultsV2,
} from "@luxsim/project-io";
import { editorRoomCamera, resolveEditorCamera, roomBounds } from "@luxsim/project-io";
import { FalseColorPlane } from "./FalseColorPlane";
import { FalseColorWalls } from "./FalseColorWalls";
import { OrbitViewBridge } from "./OrbitViewBridge";
import { PlanUnderlay3D } from "./PlanUnderlay3D";
import { LuminaireBodyMesh } from "./LuminaireBody";
import { FixtureEmissionGizmo } from "./FixtureEmissionGizmo";
import { Scene3dIsoluxOverlay } from "./Scene3dIsoluxOverlay";
import {
  EDITOR_BG,
  createCeilingGeometry,
  createFloorGeometry,
  createWallGeometry,
  createWorkplanePlateGeometry,
  setMirroredFrontFace,
  wallShellOpacity,
} from "@/lib/scene-3d-model";
import { planToThree } from "@/lib/scene-3d-isolux";
import { next3dFixtureSelection } from "@/lib/scene-3d-selection";

function MirroredFrontFace() {
  const gl = useThree((s) => s.gl);
  useLayoutEffect(() => {
    setMirroredFrontFace(gl);
    return () => {
      const ctx = gl.getContext();
      ctx.frontFace(ctx.CCW);
    };
  }, [gl]);
  return null;
}

function RoomShell({
  room,
  elev,
  active,
  display3d,
}: {
  room: ProjectSceneV2["rooms"][number];
  elev: number;
  active: boolean;
  display3d: Display3dMode;
}) {
  const floor = useMemo(() => createFloorGeometry(room, elev), [room, elev]);
  const walls = useMemo(() => createWallGeometry(room, elev), [room, elev]);
  const ceiling = useMemo(() => createCeilingGeometry(room, elev), [room, elev]);

  useLayoutEffect(() => {
    return () => {
      floor?.dispose();
      walls?.dispose();
      ceiling?.dispose();
    };
  }, [floor, walls, ceiling]);

  const wallColor = active ? "#c5b7ab" : "#b0b4b8";
  const edgeColor = active ? "#c45c26" : "#2c2c2c";

  return (
    <group>
      {floor && (
        <mesh geometry={floor}>
          <meshStandardMaterial color="#c8cbcf" roughness={0.92} metalness={0.02} side={THREE.DoubleSide} />
          <Edges color={edgeColor} />
        </mesh>
      )}
      {walls && (
        <mesh geometry={walls}>
          <meshStandardMaterial
            color={wallColor}
            roughness={0.88}
            metalness={0.04}
            transparent={wallShellOpacity(display3d) < 0.999}
            opacity={wallShellOpacity(display3d)}
            depthWrite
            side={THREE.FrontSide}
          />
          <Edges threshold={20} color={edgeColor} />
        </mesh>
      )}
      {ceiling && (
        <mesh geometry={ceiling}>
          <meshStandardMaterial color="#d8dce0" roughness={0.9} metalness={0.02} side={THREE.FrontSide} />
          <Edges color={edgeColor} />
        </mesh>
      )}
    </group>
  );
}

function WorkplanePlate({
  room,
  elev,
}: {
  room: ProjectSceneV2["rooms"][number];
  elev: number;
}) {
  const geometry = useMemo(() => createWorkplanePlateGeometry(room, elev), [room, elev]);
  useLayoutEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} userData={{ workplane: true }}>
      <meshStandardMaterial
        color="#c5d0d8"
        roughness={0.95}
        metalness={0.02}
        transparent
        opacity={0.35}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
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
  display3d = "greyscale",
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
  falseColorScale,
  showValueLabels = false,
  showIsolines = false,
  showWorkplane = true,
}: {
  scene: ProjectSceneV2;
  results: ResultsV2 | null;
  display3d?: Display3dMode;
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
  falseColorScale?: FalseColorScale;
  showValueLabels?: boolean;
  showIsolines?: boolean;
  showWorkplane?: boolean;
}) {
  const storeyId = scene.ui.activeStoreyId;
  const storey = scene.storeys.find((s) => s.id === storeyId);
  const isolateId = scene.ui.activeRoomId ?? null;
  const rooms = scene.rooms.filter((r) => {
    if (r.storeyId !== storeyId) return false;
    return isolateId ? r.id === isolateId : true;
  });
  const instances = scene.instances.filter((i) => {
    if (i.storeyId !== storeyId) return false;
    return isolateId ? i.roomId === isolateId : true;
  });
  const underlay = isolateId ? undefined : scene.underlays.find((u) => u.storeyId === storeyId);
  const elev = storey?.elevationM ?? 0;

  const startView = useMemo(() => {
    if (isolateId) {
      const room = scene.rooms.find((r) => r.id === isolateId);
      if (room) return editorRoomCamera(room, elev);
    }
    return resolveEditorCamera(initialView ?? viewRef.current, scene, storeyId);
    // Reframe when the isolated room or storey changes; orbit is then owned by OrbitViewBridge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeyId, isolateId, elev]);
  const startPosition = useRef(startView.position);
  const startTarget = useRef(startView.target);

  return (
    <div
      className={`relative w-full ${className}`}
      style={{ background: EDITOR_BG }}
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
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        style={{ position: "absolute", inset: 0 }}
        resize={{ debounce: 0 }}
      >
        <ViewportSync />
        <MirroredFrontFace />
        <color attach="background" args={[EDITOR_BG]} />
        <group position={[startView.target[0], 0, 0]}>
          <group scale={[-1, 1, 1]}>
            <group position={[-startView.target[0], 0, 0]}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[20, 30, -10]} intensity={0.85} />
        <directionalLight position={[-16, 10, 14]} intensity={0.22} />

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
          <group key={room.id}>
            <RoomShell
              room={room}
              elev={elev}
              active={room.id === scene.ui.activeRoomId}
              display3d={display3d}
            />
            {showWorkplane && !(results && results.byRoomId[room.id]) && (
              <WorkplanePlate room={room} elev={elev} />
            )}
          </group>
        ))}

        {(display3d === "falsecolor" || display3d === "greyscale") &&
          results &&
          rooms.map((room) => {
            const res = results.byRoomId[room.id];
            const walls = results.wallsByRoomId?.[room.id] ?? [];
            if (!res && !walls.length) return null;
            const palette = display3d === "greyscale" ? "greyscale" : "falsecolor";
            return (
              <group key={`fc-${room.id}`}>
                {res && (
                  <FalseColorPlane
                    room={room}
                    results={res}
                    elevationM={elev}
                    scale={falseColorScale}
                    palette={palette}
                    showWorkplane={showWorkplane}
                  />
                )}
                <FalseColorWalls
                  surfaces={walls}
                  elevationM={elev}
                  scale={falseColorScale}
                  palette={palette}
                />
              </group>
            );
          })}

        {showIsolines && results && (
          <Scene3dIsoluxOverlay
            scene={scene}
            rooms={rooms}
            results={results}
            elevationM={elev}
            showValueLabels={showValueLabels}
            showWorkplane={showWorkplane}
          />
        )}

        {instances.map((lum) => {
          const selected = lum.instanceId === selectedId;
          return (
            <group
              key={lum.instanceId}
              position={planToThree(
                lum.position.x,
                lum.position.y,
                elev + lum.position.z
              )}
              rotation={[0, (-lum.rotationDeg * Math.PI) / 180, 0]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(next3dFixtureSelection(selectedId, lum.instanceId));
              }}
            >
              <LuminaireBodyMesh
                photo={photometry?.[lum.luminaireId]}
                selected={selected}
              />
              {selected && (
                <FixtureEmissionGizmo
                  photo={photometry?.[lum.luminaireId]}
                  fixtureZ={lum.position.z}
                  room={scene.rooms.find((r) => r.id === lum.roomId) ?? null}
                />
              )}
            </group>
          );
        })}
            </group>
          </group>
        </group>

        <OrbitControls
          makeDefault
          target={startTarget.current}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2 - 0.05}
          enableZoom
          enablePan
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.DOLLY,
          }}
        />
        <OrbitViewBridge
          viewRef={viewRef}
          initialView={startView}
          frameKey={`${storeyId ?? ""}:${isolateId ?? ""}`}
        />
      </Canvas>
    </div>
  );
}
