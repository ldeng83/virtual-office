import { islandKey } from './hosted';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { diveState, playerState } from './fun-state';
import { nearestSpot, pointer, SPOTS, type Spot } from './interact';
import { Label } from './label';

// Shows what can be used: a ring and the action under the pointer, an "E" prompt on the nearest
// spot as you walk up to it, and a marker on every spot in view while Q is held.
const typing = (e: KeyboardEvent) =>
  !islandKey(e) || !!(e.target as HTMLElement).closest?.('input,textarea,select,[contenteditable=true],.modal');
const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

export function InteractionHints({ seat, onUse }: { seat: string | null; onUse: (spot: Spot) => void }) {
  const anchor = useRef<THREE.Group>(null),
    ring = useRef<THREE.Mesh>(null),
    markers = useRef<THREE.InstancedMesh>(null),
    near = useRef<Spot | null>(null),
    showAll = useRef(false),
    use = useRef(onUse);
  use.current = onUse;
  const [chip, setChip] = useState<{ label: string; key: boolean } | null>(null),
    shown = useRef('');
  const tools = useMemo(
    () => ({ matrix: new THREE.Matrix4(), position: new THREE.Vector3(), scale: new THREE.Vector3() }),
    [],
  );
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
        if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
        const key = e.key.toLowerCase();
        if (key === 'q') showAll.current = true;
        if (key === 'e' && !e.repeat && near.current) use.current(near.current);
      },
      up = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() === 'q') showAll.current = false;
      },
      clear = () => (showAll.current = false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime,
      busy = !!seat || diveState.under;
    near.current = busy ? null : nearestSpot(playerState.x, playerState.z);
    // The pointer wins; otherwise the prompt sits on whatever you're standing next to.
    const hovered = diveState.under ? null : pointer.spot,
      target = hovered ?? near.current,
      key = !!target && target.id === near.current?.id,
      signature = target ? `${target.id}|${target.label}|${key}` : '';
    if (signature !== shown.current) {
      shown.current = signature;
      setChip(target ? { label: target.label, key } : null);
    }
    if (anchor.current) {
      anchor.current.visible = !!target;
      if (target) anchor.current.position.set(target.x, target.y + 1.55, target.z);
    }
    if (ring.current) {
      ring.current.visible = !!target;
      if (target) {
        ring.current.position.set(target.x, target.y + 0.16, target.z);
        ring.current.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
      }
    }
    const all = markers.current;
    if (all) {
      all.visible = showAll.current && !diveState.under;
      if (all.visible) {
        SPOTS.forEach((spot, i) => {
          const pulse = 0.55 + Math.sin(t * 3 + i) * 0.07;
          tools.matrix.compose(
            tools.position.set(spot.x, spot.y + 0.18, spot.z),
            flat,
            tools.scale.set(pulse, pulse, pulse),
          );
          all.setMatrixAt(i, tools.matrix);
        });
        all.instanceMatrix.needsUpdate = true;
      }
    }
  });
  return (
    <>
      <group ref={anchor} visible={false}>
        <Label zIndex={24}>
          {chip && (
            <div className="use-chip">
              {chip.key && <kbd>E</kbd>}
              {chip.label}
            </div>
          )}
        </Label>
      </group>
      <mesh ref={ring} visible={false} rotation={[-Math.PI / 2, 0, 0]} renderOrder={29} raycast={() => null}>
        <ringGeometry args={[0.5, 0.62, 40]} />
        <meshBasicMaterial
          color="#ffd76a"
          transparent
          opacity={0.95}
          depthTest={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <instancedMesh
        ref={markers}
        args={[undefined, undefined, SPOTS.length]}
        visible={false}
        frustumCulled={false}
        renderOrder={28}
        raycast={() => null}
      >
        <ringGeometry args={[0.32, 0.6, 28]} />
        <meshBasicMaterial
          color="#ffd76a"
          transparent
          opacity={0.85}
          depthTest={false}
          toneMapped={false}
          fog={false}
        />
      </instancedMesh>
    </>
  );
}
