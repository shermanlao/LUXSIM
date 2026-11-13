"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { enforcePlanAlignedOrbit, type Camera3dView } from "@luxsim/project-io";

export type { Camera3dView };

function sameView(a: Camera3dView, b: Camera3dView): boolean {
  return (
    a.position[0] === b.position[0] &&
    a.position[1] === b.position[1] &&
    a.position[2] === b.position[2] &&
    a.target[0] === b.target[0] &&
    a.target[1] === b.target[1] &&
    a.target[2] === b.target[2]
  );
}

/** Tracks orbit pose and restores a saved view once controls are ready.
 *  When frameKey changes (for example a different isolated room), the camera is reframed.
 *  Near-plan views are kept on the south side so the floor plate matches Top. */
export function OrbitViewBridge({
  viewRef,
  initialView,
  frameKey,
}: {
  viewRef: React.MutableRefObject<Camera3dView | null>;
  initialView: Camera3dView | null;
  frameKey?: string;
}) {
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const appliedKey = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    const raw = initialView ?? viewRef.current;
    if (!raw || !controls) return;
    const key = frameKey ?? "__init__";
    if (appliedKey.current === key) return;
    const view = enforcePlanAlignedOrbit(raw);
    camera.position.set(...view.position);
    camera.up.set(0, 1, 0);
    camera.updateProjectionMatrix();
    controls.target.set(...view.target);
    controls.update();
    appliedKey.current = key;
  }, [camera, controls, initialView, viewRef, frameKey]);

  useFrame(() => {
    if (!controls) return;
    const current: Camera3dView = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
    };
    const aligned = enforcePlanAlignedOrbit(current);
    if (!sameView(current, aligned)) {
      camera.position.set(...aligned.position);
      camera.up.set(0, 1, 0);
      controls.update();
    }
    viewRef.current = aligned;
  });

  return null;
}
