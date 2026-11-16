import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { batchStatic } from './batch';

// Wrap scenery that never moves; see batch.ts.
export function StaticBatch({ name, children }: { name?: string; children: ReactNode }) {
  const group = useRef<THREE.Group>(null),
    done = useRef(false);
  // On the first frame everything inside has mounted, so bake it then.
  useFrame(() => {
    if (done.current || !group.current) return;
    done.current = true;
    batchStatic(group.current);
  });
  return (
    <group ref={group} name={name}>
      {children}
    </group>
  );
}
