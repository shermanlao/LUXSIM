"use client";

import * as THREE from "three";
import type { ProjectSceneV2, RoomV2 } from "@luxsim/project-io";
import { cameraForRooms } from "@luxsim/project-io";

function toThree(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, z, y);
}

function roomMesh(room: RoomV2, elev: number, active: boolean): THREE.Mesh | null {
  if (room.polygon.length < 3) return null;
  const shape = new THREE.Shape();
  const first = room.polygon[0]!;
  shape.moveTo(first.x, -first.y);
  for (let i = 1; i < room.polygon.length; i += 1) {
    const p = room.polygon[i]!;
    shape.lineTo(p.x, -p.y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.1, room.heightM),
    bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, elev, 0);
  const mat = new THREE.MeshLambertMaterial({
    color: active ? 0xc45c26 : 0x8aa0ad,
    transparent: true,
    opacity: active ? 0.35 : 0.22,
  });
  return new THREE.Mesh(geo, mat);
}

function renderPng(
  scene: ProjectSceneV2,
  rooms: RoomV2[],
  instances: ReturnType<ProjectSceneV2["instances"]["filter"]>,
  elevationM: number,
  highlightRoomId: string | null,
  width: number,
  height: number
): string {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: true,
  });
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x0f1c24, 1);

  const threeScene = new THREE.Scene();
  threeScene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(20, 30, 10);
  threeScene.add(dir);

  for (const room of rooms) {
    const mesh = roomMesh(room, elevationM, room.id === highlightRoomId);
    if (!mesh) continue;
    threeScene.add(mesh);
    const line = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: room.id === highlightRoomId ? 0xc45c26 : 0x8aa0ad })
    );
    line.position.copy(mesh.position);
    line.rotation.copy(mesh.rotation);
    threeScene.add(line);
  }

  for (const inst of instances) {
    const g = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.12, 0.35),
      new THREE.MeshLambertMaterial({ color: 0xe8c27a })
    );
    g.position.copy(toThree(inst.position.x, inst.position.y, elevationM + inst.position.z));
    threeScene.add(g);
  }

  const camPreset = cameraForRooms(rooms, elevationM);
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
  camera.position.set(camPreset.position.x, camPreset.position.y, camPreset.position.z);
  camera.lookAt(camPreset.target.x, camPreset.target.y, camPreset.target.z);

  renderer.render(threeScene, camera);
  const url = renderer.domElement.toDataURL("image/png");

  renderer.dispose();
  for (const obj of threeScene.children) {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const m = obj.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    }
  }

  return url;
}

export interface Report3dSnapshots {
  byStoreyId: Record<string, string>;
  byRoomId: Record<string, string>;
}

/**
 * WebGL snapshots for PDF export (browser only).
 * Falls back to empty maps when WebGL is unavailable.
 */
export function captureReport3dSnapshots(scene: ProjectSceneV2): Report3dSnapshots {
  const byStoreyId: Record<string, string> = {};
  const byRoomId: Record<string, string> = {};
  try {
    for (const storey of scene.storeys) {
      const rooms = scene.rooms.filter((r) => r.storeyId === storey.id);
      if (!rooms.length) continue;
      const instances = scene.instances.filter((i) => i.storeyId === storey.id);
      byStoreyId[storey.id] = renderPng(
        scene,
        rooms,
        instances,
        storey.elevationM,
        scene.ui.activeRoomId,
        640,
        400
      );
    }
    for (const room of scene.rooms) {
      const storey = scene.storeys.find((s) => s.id === room.storeyId);
      const instances = scene.instances.filter((i) => i.roomId === room.id);
      byRoomId[room.id] = renderPng(
        scene,
        [room],
        instances,
        storey?.elevationM ?? 0,
        room.id,
        480,
        300
      );
    }
  } catch {
    /* Vector 3D in PDF still renders */
  }
  return { byStoreyId, byRoomId };
}
