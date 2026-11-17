import { hoverSpot } from './interact';
import { useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraView } from './camera-view';
import { Label } from './label';
import { shorePoint, WALK_INSET } from './shoreline';
import { stepAlongPath, turnToward } from './steering';
import { findPath, locations, seats, walkable, type Point } from './world';

const ignore = () => {};

// ---------------- Mochi, the island cat ----------------
// Wanders between sunny spots, naps, and follows you for a while after you pet her.
// Sunny outdoor spots she likes (the café terrace, plaza, firepit, games lawn, garden, town hall steps, boardwalk).
const CAT_SPOTS: Point[] = (
  [
    [0, -2.6],
    [11, 5],
    [2.2, 5.6],
    [19.2, -8.2],
    [8.5, -31.4],
    [-10.5, -30.4],
    [-11.6, 0.6],
    [25.6, -12],
    [-4, -16],
  ] as Point[]
).filter(p => walkable(...p));
export function Cat({
  player,
  motion,
  onPet,
}: {
  player: RefObject<THREE.Vector3>;
  motion: boolean;
  onPet: () => void;
}) {
  const group = useRef<THREE.Group>(null),
    body = useRef<THREE.Group>(null),
    tail = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(CAT_SPOTS[0][0], 0, CAT_SPOTS[0][1])),
    path = useRef<Point[]>([]),
    mover = useRef({ speed: 0 });
  const state = useRef<{ mode: 'nap' | 'walk' | 'sit'; until: number; followUntil: number; repath: number }>({
    mode: 'nap',
    until: 8,
    followUntil: 0,
    repath: 0,
  });
  const clock = useRef(0);
  const [hearts, setHearts] = useState(0);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    dt = Math.min(dt, 0.05);
    if (motion) clock.current += dt;
    const t = clock.current,
      s = state.current,
      me = player.current;
    const following = t < s.followUntil && me;
    if (following && t > s.repath) {
      s.repath = t + 1.2;
      const d = Math.hypot(me.x - pos.current.x, me.z - pos.current.z);
      if (d > 1.6) {
        const toward: Point = [me.x + ((pos.current.x - me.x) / d) * 0.9, me.z + ((pos.current.z - me.z) / d) * 0.9];
        const route = walkable(...toward) ? findPath([pos.current.x, pos.current.z], toward) : [];
        if (route.length) {
          path.current = route;
          s.mode = 'walk';
        }
      }
    }
    if (!following && t > s.until && s.mode !== 'walk') {
      // Pick the next sunny spot and stroll there.
      const next = CAT_SPOTS[Math.floor(Math.random() * CAT_SPOTS.length)];
      path.current = findPath([pos.current.x, pos.current.z], next);
      s.mode = path.current.length ? 'walk' : 'sit';
      s.until = t + 6;
    }
    let moving = false;
    if (s.mode === 'walk' && motion) {
      const step = stepAlongPath(pos.current, path.current, mover.current, dt, following ? 2.2 : 1.3, 0.2);
      if (step) {
        pos.current.x += step.dx;
        pos.current.z += step.dz;
        if (Math.hypot(step.dx, step.dz) > 1e-5)
          g.rotation.y = turnToward(g.rotation.y, Math.atan2(step.dx, step.dz), dt, 8);
        moving = true;
      }
      if (!path.current.length) {
        s.mode = following ? 'sit' : Math.random() < 0.6 ? 'nap' : 'sit';
        s.until = t + (s.mode === 'nap' ? 14 + Math.random() * 16 : 5 + Math.random() * 6);
      }
    }
    g.position.set(pos.current.x, 0.12, pos.current.z);
    if (body.current) {
      const nap = s.mode === 'nap' && !moving;
      body.current.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.03 : nap ? -0.14 : 0;
      body.current.scale.y = nap ? 0.75 + Math.sin(t * 1.6) * 0.03 : 1;
    }
    if (tail.current)
      tail.current.rotation.z = s.mode === 'nap' && !moving ? 1.2 : Math.sin(t * (moving ? 6 : 2)) * 0.35;
  });
  return (
    <group
      ref={group}
      name="island-cat"
      scale={1.35}
      onClick={e => {
        e.stopPropagation();
        if (e.delta >= 6) return;
        state.current.followUntil = clock.current + 25;
        state.current.repath = 0;
        setHearts(h => h + 1);
        onPet();
        window.setTimeout(() => setHearts(h => Math.max(0, h - 1)), 2200);
      }}
      onPointerOver={e => {
        e.stopPropagation();
        const at = group.current!.position;
        hoverSpot({ id: 'cat', x: at.x, y: at.y - 0.6, z: at.z, label: 'Pet Mochi' });
      }}
      onPointerOut={() => hoverSpot(null)}
    >
      <group ref={body}>
        <mesh position={[0, 0.22, 0]} scale={[0.17, 0.15, 0.3]} castShadow>
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial color="#e39a5a" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.2, 0.18]} scale={[0.1, 0.1, 0.08]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#fbf1e4" />
        </mesh>
        <group position={[0, 0.36, 0.3]}>
          <mesh scale={[0.13, 0.12, 0.12]} castShadow>
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial color="#e39a5a" roughness={0.9} />
          </mesh>
          {[-1, 1].map(side => (
            <mesh key={side} position={[side * 0.07, 0.11, -0.01]} rotation={[0, 0, -side * 0.3]}>
              <coneGeometry args={[0.045, 0.09, 4]} />
              <meshStandardMaterial color="#d6874a" />
            </mesh>
          ))}
          {[-1, 1].map(side => (
            <mesh key={`e${side}`} position={[side * 0.045, 0.02, 0.11]}>
              <sphereGeometry args={[0.016, 6, 4]} />
              <meshBasicMaterial color="#2a2420" />
            </mesh>
          ))}
        </group>
        {[-1, 1].flatMap(sx =>
          [-1, 1].map(sz => (
            <mesh key={`${sx}${sz}`} position={[sx * 0.08, 0.06, sz * 0.17]}>
              <cylinderGeometry args={[0.03, 0.03, 0.14, 6]} />
              <meshStandardMaterial color="#e39a5a" />
            </mesh>
          )),
        )}
        <group ref={tail} position={[0, 0.26, -0.27]}>
          <mesh position={[0, 0.12, -0.04]} rotation={[-0.4, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.03, 0.3, 6]} />
            <meshStandardMaterial color="#d6874a" />
          </mesh>
        </group>
      </group>
      {hearts > 0 && (
        <Label position={[0, 0.85, 0]} zIndex={22}>
          <div className="cat-hearts" aria-hidden="true">
            <span>♥</span>
            <span>♥</span>
            <span>♥</span>
          </div>
        </Label>
      )}
    </group>
  );
}

// ---------------- Seashell hunt ----------------
// Five shells wash up along the coast each day, in spots you can walk to.
export type Shell = { id: string; point: Point; kind: 'scallop' | 'spiral' };
export function dailyShells(day: string): Shell[] {
  let seed = [...day].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const candidates = Array.from(
    { length: 72 },
    (_, i) => shorePoint((i / 72) * Math.PI * 2, -WALK_INSET - 0.45) as Point,
  ).filter(
    p =>
      walkable(...p) &&
      seats.every(s => Math.hypot(s.point[0] - p[0], s.point[1] - p[1]) > 1.5) &&
      locations.every(l => Math.hypot(l.point[0] - p[0], l.point[1] - p[1]) > 1.5),
  );
  const picked: Shell[] = [];
  while (picked.length < 5 && candidates.length) {
    const [point] = candidates.splice(Math.floor(random() * candidates.length), 1);
    if (picked.every(s => Math.hypot(s.point[0] - point[0], s.point[1] - point[1]) > 6))
      picked.push({ id: `${day}-${picked.length}`, point, kind: random() < 0.5 ? 'scallop' : 'spiral' });
  }
  return picked;
}
export function Shells({
  shells,
  player,
  onCollect,
  onWalk,
}: {
  shells: Shell[];
  player: RefObject<THREE.Vector3>;
  onCollect: (id: string) => void;
  onWalk: (point: Point) => void;
}) {
  const group = useRef<THREE.Group>(null),
    collected = useRef(new Set<string>());
  useFrame(({ clock }) => {
    const me = player.current;
    group.current?.children.forEach((child, i) => {
      const shell = shells[i];
      if (!shell) return;
      child.position.y = 0.16 + Math.sin(clock.elapsedTime * 2 + i) * 0.03;
      child.rotation.y = clock.elapsedTime * 0.6 + i;
      if (me && !collected.current.has(shell.id) && Math.hypot(me.x - shell.point[0], me.z - shell.point[1]) < 0.85) {
        collected.current.add(shell.id);
        onCollect(shell.id);
      }
    });
  });
  return (
    <group ref={group} name="seashells">
      {shells.map(shell => (
        <group
          key={shell.id}
          position={[shell.point[0], 0.16, shell.point[1]]}
          onClick={e => {
            e.stopPropagation();
            if (e.delta < 6) onWalk(shell.point);
          }}
        >
          {shell.kind === 'scallop' ? (
            <mesh rotation={[-1.2, 0, 0]} scale={[0.17, 0.17, 0.17]}>
              <circleGeometry args={[1, 9, 0, Math.PI]} />
              <meshStandardMaterial
                color="#f6d2c4"
                side={THREE.DoubleSide}
                emissive="#f6c2a8"
                emissiveIntensity={0.25}
              />
            </mesh>
          ) : (
            <mesh rotation={[0, 0, 1.2]}>
              <coneGeometry args={[0.07, 0.22, 7]} />
              <meshStandardMaterial color="#f2e2c4" emissive="#e8cfa0" emissiveIntensity={0.25} />
            </mesh>
          )}
          <mesh position={[0, 0.18, 0]} raycast={ignore}>
            <sphereGeometry args={[0.035, 6, 4]} />
            <meshBasicMaterial color="#fffbe8" transparent opacity={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------- Passing showers and rainbows ----------------
const DROPS = 700;
export function Rain({ raining, motion }: { raining: boolean; motion: boolean }) {
  const lines = useRef<THREE.LineSegments>(null),
    level = useRef(0);
  const { geometry, offsets } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(DROPS * 6), 3));
    const offsets = Array.from({ length: DROPS }, () => [
      Math.random() * 44 - 22,
      Math.random() * 12,
      Math.random() * 44 - 22,
    ]);
    return { geometry, offsets };
  }, []);
  useFrame((_, dt) => {
    level.current = THREE.MathUtils.damp(level.current, raining ? 1 : 0, 0.8, Math.min(dt, 0.1));
    const line = lines.current;
    if (!line) return;
    line.visible = level.current > 0.02;
    if (!line.visible) return;
    (line.material as THREE.LineBasicMaterial).opacity = 0.45 * level.current;
    const [fx, fz] = cameraView.focus,
      array = geometry.attributes.position.array as Float32Array;
    offsets.forEach((o, i) => {
      if (motion) o[1] -= dt * 16;
      if (o[1] < 0) o[1] += 12;
      const x = fx + o[0],
        z = fz + o[2];
      array.set([x, o[1] + 0.2, z, x + 0.03, o[1] + 0.75, z + 0.03], i * 6);
    });
    geometry.attributes.position.needsUpdate = true;
  });
  return (
    <lineSegments ref={lines} geometry={geometry} raycast={ignore} frustumCulled={false}>
      <lineBasicMaterial color="#cfe3ef" transparent opacity={0} depthWrite={false} />
    </lineSegments>
  );
}
export function Rainbow({ visible }: { visible: boolean }) {
  const group = useRef<THREE.Group>(null),
    level = useRef(0);
  const bands = ['#e57373', '#f2a65a', '#f5d76e', '#8fcf8a', '#6fb4e0', '#8a8fd6', '#b58ad6'];
  useFrame((_, dt) => {
    level.current = THREE.MathUtils.damp(level.current, visible ? 1 : 0, 0.6, Math.min(dt, 0.1));
    const g = group.current;
    if (!g) return;
    g.visible = level.current > 0.01;
    g.children.forEach(
      child => (((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.42 * level.current),
    );
  });
  return (
    <group ref={group} position={[-6, -4, -62]} rotation={[0, 0.5, 0]} name="rainbow">
      {bands.map((color, i) => (
        <mesh key={color} raycast={ignore}>
          <torusGeometry args={[40 - i * 1.1, 0.55, 6, 90, Math.PI]} />
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} fog={false} />
        </mesh>
      ))}
    </group>
  );
}
