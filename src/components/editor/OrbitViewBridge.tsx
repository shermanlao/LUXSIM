"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Camera3dView } from "@luxsim/project-io";

export type { Camera3dView };

/** Tracks orbit pose and restores a saved view once controls are ready.
 *  When frameKey changes (for example a different isolated room), the camera is reframed. */
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
    const view = initialView ?? viewRef.current;
    if (!view || !controls) return;
    const key = frameKey ?? "__init__";
    if (appliedKey.current === key) return;
    camera.position.set(...view.position);
    camera.up.set(0, 1, 0);
    camera.updateProjectionMatrix();
    controls.target.set(...view.target);
    controls.update();
    appliedKey.current = key;
  }, [camera, controls, initialView, viewRef, frameKey]);

  useFrame(() => {
    if (!controls) return;
    viewRef.current = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
    };
  });

  return null;
}
