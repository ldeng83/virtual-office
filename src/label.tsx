import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { diveState } from './fun-state';

// A DOM label pinned to a point in the 3D scene (name tags, place labels).
//
// Like drei's <Html>, each label renders into its own small React root positioned over the canvas,
// but it unmounts that root after React finishes committing instead of during the commit (which
// React 19 reports as "Attempted to synchronously unmount a root while React was already rendering"),
// and it hides itself when its 3D object or any parent is hidden.
const projected = new THREE.Vector3();

function isShown(object: THREE.Object3D | null) {
  for (let o = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

export function Label({
  position = [0, 0, 0],
  zIndex = 10,
  children,
}: {
  position?: [number, number, number];
  zIndex?: number;
  children: ReactNode;
}) {
  const { gl, camera, size } = useThree();
  const anchor = useRef<THREE.Group>(null);
  const [el] = useState(() => {
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;will-change:transform;';
    return div;
  });
  const root = useRef<Root | null>(null);
  useLayoutEffect(() => {
    const parent = gl.domElement.parentNode as HTMLElement | null;
    if (!parent) return;
    parent.appendChild(el);
    root.current = createRoot(el);
    return () => {
      const current = root.current;
      root.current = null;
      el.remove();
      // Unmount once React has finished the current commit.
      setTimeout(() => current?.unmount());
    };
  }, [gl, el]);
  useLayoutEffect(() => {
    el.style.zIndex = String(zIndex);
    root.current?.render(children);
  });
  useFrame(() => {
    const group = anchor.current;
    if (!group) return;
    projected.setFromMatrixPosition(group.matrixWorld);
    // Underwater you can't see the name tags of people up on the surface.
    const above = diveState.under && projected.y > -0.3;
    projected.project(camera);
    const visible =
      !above && isShown(group) && projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2;
    el.style.display = visible ? '' : 'none';
    if (!visible) return;
    const x = ((projected.x + 1) / 2) * size.width,
      y = ((1 - projected.y) / 2) * size.height;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
  });
  return <group ref={anchor} position={position} />;
}
