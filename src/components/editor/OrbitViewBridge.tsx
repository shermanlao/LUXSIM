"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Camera3dView } from "@luxsim/project-io";

export type { Camera3dView };

/** Tracks orbit pose and restores a saved view once controls are ready. */
export function OrbitViewBridge({
  viewRef,
  initialView,
}: {
  viewRef: React.MutableRefObject<Camera3dView | null>;
  initialView: Camera3dView | null;
}) {
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const applied = useRef(false);

  useLayoutEffect(() => {
    if (applied.current) return;
    const view = initialView ?? viewRef.current;
    if (!view || !controls) return;
    camera.position.set(...view.position);
    controls.target.set(...view.target);
    controls.update();
    applied.current = true;
  }, [camera, controls, initialView, viewRef]);

  useFrame(() => {
    if (!controls) return;
    viewRef.current = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
    };
  });

  return null;
}
