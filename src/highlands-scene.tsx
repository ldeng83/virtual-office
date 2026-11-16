import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Period } from './daylight';
import { cameraView } from './camera-view';
import { Label } from './label';
import { StaticBatch } from './static-batch';
import { WALK_INSET } from './shoreline';
import {
  CAMPSITE,
  CAVE,
  CREEK,
  DECKS,
  deckAt,
  deckHeight,
  FALLS,
  FOREST,
  groundHeight,
  highlandsDistance,
  highlandsWalkable,
  LAKE,
  naturalHeight,
  PEAK,
  POOL,
  RANGER_HUT,
  SUMMIT,
  TENTS,
  terrainHeight,
  TRAIL_BOARD,
  TRAILS,
  treeAt,
  type Deck,
  type Trail,
} from './highlands';

// The Highlands in 3D: terrain, water, bridges, trails, forest, camp, cave, summit, wildlife and clouds.
type V3 = [number, number, number];
type Point = [number, number];
const ignore = () => {};
function Box({ p, s, c, r = [0, 0, 0] }: { p: V3; s: V3; c: string; r?: V3 }) {
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={0.85} />
    </mesh>
  );
}
function Cyl({ p, r, h, c, r2, rot = [0, 0, 0] }: { p: V3; r: number; h: number; c: string; r2?: number; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[r, r2 ?? r, h, 10]} />
      <meshStandardMaterial color={c} roughness={0.85} />
    </mesh>
  );
}
function Rock({ p, s, c = '#a59c8c', turn = 0 }: { p: V3; s: V3; c?: string; turn?: number }) {
  return (
    <mesh position={p} scale={s} rotation={[0, turn, 0]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={c} roughness={0.95} flatShading />
    </mesh>
  );
}
const at = (x: number, z: number, lift = 0): V3 => [x, groundHeight(x, z) + lift, z];

export function HighlandsScene({
  onWalk,
  onHike,
  player,
  night,
  period,
  motion,
}: {
  onWalk: (point: Point, dragDistance: number) => void;
  onHike: (trail: Trail['id']) => void;
  player: RefObject<THREE.Vector3>;
  night: number;
  period: Period;
  motion: boolean;
}) {
  return (
    <group name="highlands">
      <HighlandsTerrain onWalk={onWalk} />
      <Water motion={motion} />
      <StaticBatch name="highlands-props">
        {DECKS.map(deck => (
          <DeckMesh key={deck.id} deck={deck} />
        ))}
        <TrailPaths />
        <RangerHut />
        <Tents />
        <CaveMouth />
        <SummitCairn />
        <FallsCliff />
      </StaticBatch>
      <TrailBoard onHike={onHike} />
      <Campfire night={night} motion={motion} />
      <Crystals night={night} />
      <SummitFlag motion={motion} />
      <Forest />
      <Deer player={player} motion={motion} />
      <Birds player={player} motion={motion} />
      <Fireflies night={night} motion={motion} />
      <SummitClouds period={period} motion={motion} />
    </group>
  );
}

// ---- Terrain: one height-mapped mesh, coloured by what's there ----
const colors = {
  sand: new THREE.Color('#dfcc9e'),
  meadow: new THREE.Color('#a9bd8e'),
  forest: new THREE.Color('#8ea775'),
  high: new THREE.Color('#9fae86'),
  rock: new THREE.Color('#a59c8c'),
  bed: new THREE.Color('#7f9483'),
};
function HighlandsTerrain({ onWalk }: { onWalk: (point: Point, dragDistance: number) => void }) {
  const geometry = useMemo(() => {
    const x0 = -36,
      x1 = 54,
      z0 = -126,
      z1 = -58,
      step = 0.6,
      nx = Math.round((x1 - x0) / step) + 1,
      nz = Math.round((z1 - z0) / step) + 1;
    const positions = new Float32Array(nx * nz * 3),
      vertexColors = new Float32Array(nx * nz * 3),
      c = new THREE.Color();
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * step,
          z = z0 + j * step,
          k = j * nx + i,
          h = terrainHeight(x, z),
          d = highlandsDistance(x, z);
        positions.set([x, h, z], k * 3);
        const e = 0.4,
          steep =
            Math.hypot(
              naturalHeight(x + e, z) - naturalHeight(x - e, z),
              naturalHeight(x, z + e) - naturalHeight(x, z - e),
            ) /
            (2 * e);
        const lake = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
        if (d > -WALK_INSET + 0.5) c.copy(colors.sand);
        else if (lake < 1.15 || Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 0.4) c.copy(colors.bed);
        else {
          c.copy(colors.meadow).lerp(colors.forest, Math.min(1, Math.max(0, (h - 1.2) / 3)));
          if (h > 9) c.lerp(colors.high, Math.min(1, (h - 9) / 5));
          if (steep > 0.75 || h > 14) c.lerp(colors.rock, Math.min(1, Math.max((steep - 0.75) * 2, (h - 14) / 2)));
        }
        // A little variation so the hills don't look flat-painted.
        c.offsetHSL(0, 0, Math.sin(x * 1.7) * Math.sin(z * 1.3) * 0.02);
        vertexColors.set([c.r, c.g, c.b], k * 3);
      }
    const index: number[] = [];
    for (let j = 0; j < nz - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i,
          b = a + 1,
          cc = a + nx,
          dd = cc + 1;
        // Skip quads far out under the sea.
        if ([a, b, cc, dd].every(v => positions[v * 3 + 1] < -3.3)) continue;
        index.push(a, cc, b, b, cc, dd);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh
      name="highlands-ground"
      geometry={geometry}
      receiveShadow
      onClick={event => {
        event.stopPropagation();
        onWalk([event.point.x, event.point.z], event.delta);
      }}
    >
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
  );
}

// ---- Water: the lake, the waterfall pool, the creek and the falls ----
function ribbon(points: Point[], width: number, height: (p: Point) => number) {
  const positions: number[] = [],
    index: number[] = [];
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz) || 1,
      nx = (-dz / l) * (width / 2),
      nz = (dx / l) * (width / 2),
      y = height(p);
    positions.push(p[0] + nx, y, p[1] + nz, p[0] - nx, y, p[1] - nz);
    if (i) index.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, (i - 1) * 2 + 1, i * 2, i * 2 + 1);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
const densify = (line: Point[], step = 0.4) =>
  line.flatMap((p, i) => {
    if (!i) return [p];
    const a = line[i - 1],
      n = Math.ceil(Math.hypot(p[0] - a[0], p[1] - a[1]) / step);
    return Array.from(
      { length: n },
      (_, k) => [a[0] + ((p[0] - a[0]) * (k + 1)) / n, a[1] + ((p[1] - a[1]) * (k + 1)) / n] as Point,
    );
  });
function Water({ motion }: { motion: boolean }) {
  const creek = useMemo(
    () =>
      ribbon(densify([[POOL.x - 0.6, POOL.z + 0.6], ...CREEK]), 0.8, p =>
        Math.max(LAKE.level, terrainHeight(...p) + 0.12),
      ),
    [],
  );
  const fallsTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#d9f2f5';
    ctx.fillRect(0, 0, 32, 128);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = i % 3 ? '#ffffff' : '#a9dbe3';
      ctx.fillRect(Math.random() * 32, Math.random() * 128, 2 + Math.random() * 3, 10 + Math.random() * 30);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 2);
    return t;
  }, []);
  useEffect(() => () => fallsTexture.dispose(), [fallsTexture]);
  const foam = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (!motion) return;
    fallsTexture.offset.y += dt * 1.4;
    foam.current?.children.forEach((f, i) => {
      const s = 0.8 + ((clock.elapsedTime * 0.7 + i / 3) % 1) * 0.9;
      f.scale.set(s, 1, s);
      ((f as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.5 * (1.7 - s);
    });
  });
  // The cascade: a sheet of moving water laid down the rim, from the cliff top to the pool.
  const topY = groundHeight(...FALLS.top) + 0.35,
    run = Math.hypot(FALLS.top[0] - FALLS.foot[0], FALLS.top[1] - FALLS.foot[1]),
    drop = topY - POOL.level,
    sheet = Math.hypot(run, drop),
    lean = -Math.atan2(run, drop);
  return (
    <group name="highlands-water">
      <mesh
        position={[LAKE.x, LAKE.level, LAKE.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[LAKE.rx * 1.08, LAKE.rz * 1.08, 1]}
        raycast={ignore}
      >
        <circleGeometry args={[1, 48]} />
        <meshStandardMaterial color="#5fa7b3" transparent opacity={0.82} roughness={0.15} />
      </mesh>
      {/* Lily pads */}
      {[
        [-5.5, -80.2],
        [-4.8, -80.8],
        [-6.4, -81.5],
        [-1.2, -84.6],
        [-0.4, -83.9],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, LAKE.level + 0.02, z]} rotation={[-Math.PI / 2, 0, i]} raycast={ignore}>
          <circleGeometry args={[0.32, 10, 0.4, Math.PI * 1.8]} />
          <meshStandardMaterial color="#6f9a55" />
        </mesh>
      ))}
      <mesh position={[POOL.x, POOL.level, POOL.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={ignore}>
        <circleGeometry args={[POOL.r + 0.25, 32]} />
        <meshStandardMaterial color="#6cb5c0" transparent opacity={0.85} roughness={0.15} />
      </mesh>
      <mesh geometry={creek} raycast={ignore}>
        <meshStandardMaterial color="#6cb5c0" transparent opacity={0.85} roughness={0.2} />
      </mesh>
      {/* The falls: a sheet of moving water from the ledge down into the pool */}
      <mesh
        position={[
          (FALLS.foot[0] + FALLS.top[0]) / 2 + Math.sin(FALLS.facing) * 0.15,
          (POOL.level + topY) / 2,
          (FALLS.foot[1] + FALLS.top[1]) / 2 + Math.cos(FALLS.facing) * 0.15,
        ]}
        rotation={[lean, FALLS.facing, 0, 'YXZ']}
        raycast={ignore}
      >
        <planeGeometry args={[1.3, sheet]} />
        <meshStandardMaterial map={fallsTexture} transparent opacity={0.88} side={THREE.DoubleSide} roughness={0.2} />
      </mesh>
      <group
        ref={foam}
        position={[
          FALLS.foot[0] + Math.sin(FALLS.facing) * 0.4,
          POOL.level + 0.03,
          FALLS.foot[1] + Math.cos(FALLS.facing) * 0.4,
        ]}
      >
        {[0, 1, 2].map(i => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} raycast={ignore}>
            <ringGeometry args={[0.35, 0.6, 20]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
function FallsCliff() {
  // Rocks line both sides of the cascade and cap the ledge it pours from, sitting on the ground.
  const along = (t: number, side: number, size: number, i: number) => {
    const x = FALLS.foot[0] + (FALLS.top[0] - FALLS.foot[0]) * t + Math.cos(FALLS.facing) * side,
      z = FALLS.foot[1] + (FALLS.top[1] - FALLS.foot[1]) * t - Math.sin(FALLS.facing) * side;
    return (
      <Rock
        key={i}
        p={[x, groundHeight(x, z) + size * 0.45, z]}
        s={[size, size * 0.9, size * 0.8]}
        turn={i * 1.3}
        c={i % 2 ? '#948b7c' : '#a59c8c'}
      />
    );
  };
  return (
    <group name="falls-cliff">
      {[
        [0.05, -1.05, 0.7],
        [0.05, 1.05, 0.75],
        [0.45, -1.15, 0.85],
        [0.45, 1.15, 0.8],
        [0.85, -1.1, 0.9],
        [0.85, 1.1, 0.95],
        [1.15, 0, 1.1],
        [1.1, -1.2, 0.8],
        [1.1, 1.2, 0.85],
      ].map(([t, side, size], i) => along(t, side, size, i))}
    </group>
  );
}

// ---- Bridges and jetties ----
function DeckMesh({ deck }: { deck: Deck }) {
  const dx = deck.b[0] - deck.a[0],
    dz = deck.b[1] - deck.a[1],
    length = Math.hypot(dx, dz),
    turn = Math.atan2(dx, dz),
    n = Math.ceil(length / 0.32);
  const point = (t: number, side = 0, lift = 0): V3 => [
    deck.a[0] + dx * t + Math.cos(turn) * side,
    deckHeight(deck, t) + lift,
    deck.a[1] + dz * t - Math.sin(turn) * side,
  ];
  const ropes = useMemo(
    () =>
      deck.kind === 'rope'
        ? [-1, 1].map(
            s =>
              new THREE.TubeGeometry(
                new THREE.CatmullRomCurve3(
                  Array.from({ length: 24 }, (_, i) => new THREE.Vector3(...point(i / 23, (s * deck.width) / 2, 0.95))),
                ),
                64,
                0.035,
                5,
              ),
          )
        : [],
    [deck],
  );
  const span = deck.ramp ? [deck.ramp / length, 1 - deck.ramp / length] : [0, 1];
  return (
    <group name={`deck-${deck.id}`}>
      {Array.from({ length: n }, (_, i) => {
        const t = (i + 0.5) / n;
        return (
          <Box key={i} p={point(t)} s={[deck.width, 0.07, 0.28]} r={[0, turn, 0]} c={i % 2 ? '#b8946a' : '#a98762'} />
        );
      })}
      {deck.kind === 'rope' && (
        <>
          {ropes.map((g, i) => (
            <mesh key={i} geometry={g} castShadow>
              <meshStandardMaterial color="#c9b48a" roughness={0.9} />
            </mesh>
          ))}
          {/* Hangers from rope to deck */}
          {Array.from({ length: Math.floor(n / 4) }, (_, i) =>
            [-1, 1].map(s => {
              const t = ((i + 0.5) * 4) / n,
                p = point(t, (s * deck.width) / 2, 0.47);
              return <Cyl key={`${i}${s}`} p={p} r={0.015} h={0.95} c="#c9b48a" />;
            }),
          )}
          {/* Posts at each end of the span (and stilts under the strait's stairs) */}
          {span.map(t =>
            [-1, 1].map(s => {
              const [x, y, z] = point(t, (s * (deck.width + 0.2)) / 2);
              const bottom = Math.min(groundHeight(x, z), deck.ramp ? -2 : y - 1.2);
              return (
                <Cyl key={`${t}${s}`} p={[x, (bottom + y + 1.3) / 2, z]} r={0.11} h={y + 1.3 - bottom} c="#7d6447" />
              );
            }),
          )}
          {deck.ramp &&
            Array.from({ length: 6 }, (_, i) => {
              const t = (i < 3 ? (i + 1) * 0.9 : length - (i - 2) * 0.9) / length,
                [x, y, z] = point(t);
              return [-1, 1].map(s => {
                const px = x + Math.cos(turn) * s * 0.55,
                  pz = z - Math.sin(turn) * s * 0.55,
                  bottom = Math.min(groundHeight(px, pz) - 0.1, -2);
                return <Cyl key={`${i}${s}`} p={[px, (bottom + y) / 2, pz]} r={0.07} h={y - bottom} c="#7d6447" />;
              });
            })}
        </>
      )}
      {deck.kind === 'timber' &&
        Array.from({ length: Math.floor(length / 1.6) + 1 }, (_, i) =>
          [-1, 1].map(s => {
            const t = Math.min(1, (i * 1.6) / length),
              [x, y, z] = point(t, (s * (deck.width - 0.1)) / 2);
            return <Cyl key={`${i}${s}`} p={[x, y - 0.6, z]} r={0.07} h={1.3} c="#7d6447" />;
          }),
        )}
    </group>
  );
}

// ---- Trails: a dirt path with coloured markers ----
function TrailPaths() {
  const paths = useMemo(
    () =>
      TRAILS.map(trail => {
        // Leave out the stretches on bridges (they have their own planks).
        const runs: Point[][] = [[]];
        for (const p of trail.points)
          if (deckAt(...p)) runs.push([]);
          else runs[runs.length - 1].push(p);
        return runs.filter(r => r.length > 1).map(r => ribbon(r, 0.95, p => terrainHeight(...p) + 0.05));
      }),
    [],
  );
  return (
    <group name="trails">
      {paths.flat().map((g, i) => (
        <mesh key={i} geometry={g} receiveShadow raycast={ignore}>
          <meshStandardMaterial color="#cdb58b" roughness={1} />
        </mesh>
      ))}
      {TRAILS.flatMap(trail =>
        trail.points
          .filter((p, i) => i % 11 === 5 && !deckAt(...p))
          .map((p, i) => {
            const j = trail.points.indexOf(p),
              q = trail.points[Math.min(trail.points.length - 1, j + 1)],
              l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1,
              x = p[0] + ((q[1] - p[1]) / l) * 0.85,
              z = p[1] - ((q[0] - p[0]) / l) * 0.85,
              y = terrainHeight(x, z);
            return (
              <group key={`${trail.id}-${i}`} position={[x, y, z]}>
                <Box p={[0, 0.32, 0]} s={[0.12, 0.64, 0.12]} c="#8a6a4b" />
                <Box p={[0, 0.68, 0]} s={[0.16, 0.12, 0.16]} c={trail.color} />
              </group>
            );
          }),
      )}
    </group>
  );
}
function TrailBoard({ onHike }: { onHike: (trail: Trail['id']) => void }) {
  // The board's buttons show when the camera is nearby.
  const [near, setNear] = useState(false);
  useFrame(() => {
    const [fx, fz] = cameraView.focus,
      close = Math.hypot(fx - TRAIL_BOARD[0], fz - TRAIL_BOARD[1]) < 9;
    if (close !== near) setNear(close);
  });
  const [x, y, z] = at(...TRAIL_BOARD);
  return (
    <group name="trail-board" position={[x, y, z]}>
      <StaticBatch>
        {[-0.75, 0.75].map(dx => (
          <Box key={dx} p={[dx, 0.8, 0]} s={[0.12, 1.6, 0.12]} c="#7d6447" />
        ))}
        <Box p={[0, 1.25, 0]} s={[1.7, 0.9, 0.08]} c="#e8dcc3" />
        <Box p={[0, 1.8, 0]} s={[1.9, 0.08, 0.4]} c="#6b5139" />
        {TRAILS.map((t, i) => (
          <Box key={t.id} p={[-0.45, 1.5 - i * 0.26, 0.05]} s={[0.55, 0.14, 0.02]} c={t.color} />
        ))}
      </StaticBatch>
      {near && (
        <Label position={[0, 2.5, 0]} zIndex={14}>
          <div className="trail-picker">
            <strong>Trails · pick one to hike</strong>
            {TRAILS.map(t => (
              <button key={t.id} onClick={() => onHike(t.id)}>
                <i style={{ background: t.color }} />
                {t.name}
                <span>{t.level}</span>
              </button>
            ))}
          </div>
        </Label>
      )}
    </group>
  );
}

// ---- Places along the way ----
function RangerHut() {
  const { x, z, w, d } = RANGER_HUT,
    y = groundHeight(x, z);
  return (
    <group name="ranger-hut" position={[x, y, z]}>
      <Box p={[0, -0.3, 0]} s={[w + 0.3, 0.6, d + 0.3]} c="#8d8473" />
      <Box p={[0, 1, 0]} s={[w, 2, d]} c="#9c7a54" />
      <Box p={[0, 2.25, d / 4]} s={[w + 0.4, 0.1, d / 2 + 0.6]} r={[0.5, 0, 0]} c="#4f5f4e" />
      <Box p={[0, 2.25, -d / 4]} s={[w + 0.4, 0.1, d / 2 + 0.6]} r={[-0.5, 0, 0]} c="#4f5f4e" />
      <Box p={[0.5, 0.75, d / 2 + 0.01]} s={[0.7, 1.5, 0.04]} c="#5e4632" />
      <Box p={[-0.8, 1.2, d / 2 + 0.01]} s={[0.6, 0.5, 0.04]} c="#cfe3e6" />
      <Box p={[0.9, 2.6, -0.4]} s={[0.3, 0.8, 0.3]} c="#7b7468" />
      <Box p={[0, 2.05, d / 2 + 0.05]} s={[1.6, 0.3, 0.04]} c="#3f6252" />
    </group>
  );
}
function Tents() {
  return (
    <group name="tents">
      {TENTS.map((t, i) => {
        const y = groundHeight(t.x, t.z);
        return (
          <group key={i} position={[t.x, y, t.z]} rotation={[0, t.angle, 0]}>
            <mesh position={[0, 0.65, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 1.4]} castShadow>
              <coneGeometry args={[1.1, 1.3, 4]} />
              <meshStandardMaterial color={t.color} roughness={0.8} flatShading />
            </mesh>
            <Box p={[0, 0.35, 0.95]} s={[0.5, 0.7, 0.04]} c="#3b3b36" />
          </group>
        );
      })}
    </group>
  );
}
function Campfire({ night, motion }: { night: number; motion: boolean }) {
  const flames = useRef<THREE.Group>(null),
    light = useRef<THREE.PointLight>(null);
  const glow = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffb35c', emissive: '#ff8a3d', emissiveIntensity: 1 }),
    [],
  );
  useFrame(({ clock }) => {
    const t = motion ? clock.elapsedTime : 0;
    glow.emissiveIntensity = 0.8 + night * 2 + Math.sin(t * 9) * 0.15;
    if (light.current) light.current.intensity = night * (3 + Math.sin(t * 7) * 0.4);
    flames.current?.children.forEach((f, i) => {
      f.scale.y = 1 + Math.sin(t * (6 + i) + i) * 0.2;
      f.rotation.y = t * 0.5 + i;
    });
  });
  const [x, y, z] = at(...CAMPSITE.fire);
  return (
    <group name="campfire" position={[x, y, z]}>
      <StaticBatch>
        {Array.from({ length: 9 }, (_, i) => {
          const a = (i / 9) * Math.PI * 2;
          return (
            <Rock
              key={i}
              p={[Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55]}
              s={[0.16, 0.12, 0.14]}
              c="#8d8a80"
              turn={i}
            />
          );
        })}
        {[0, 1.2].map(r => (
          <Cyl key={r} p={[0, 0.12, 0]} r={0.06} h={0.8} c="#6b4f36" rot={[0, r, Math.PI / 2]} />
        ))}
      </StaticBatch>
      <group ref={flames} position={[0, 0.3, 0]}>
        {[0, 1, 2].map(i => (
          <mesh key={i} position={[Math.cos(i * 2) * 0.1, 0, Math.sin(i * 2) * 0.1]} material={glow} raycast={ignore}>
            <coneGeometry args={[0.16 - i * 0.03, 0.55 - i * 0.08, 6]} />
          </mesh>
        ))}
      </group>
      <pointLight ref={light} position={[0, 1, 0]} color="#ffab59" distance={7} decay={2} intensity={0} />
    </group>
  );
}
function CaveMouth() {
  const y = groundHeight(CAVE.x, CAVE.z),
    // Rocks heaped behind and around the opening (the opening faces CAVE.facing).
    f = CAVE.facing,
    place = (forward: number, side: number, lift: number, s: V3, i: number) => (
      <Rock
        key={i}
        p={[
          CAVE.x + Math.sin(f) * forward + Math.cos(f) * side,
          y + lift,
          CAVE.z + Math.cos(f) * forward - Math.sin(f) * side,
        ]}
        s={s}
        turn={i * 0.9}
        c={i % 2 ? '#948b7c' : '#a59c8c'}
      />
    );
  return (
    <group name="cave">
      {place(-0.9, 0, 1.3, [1.9, 1.5, 1.4], 0)}
      {place(0, -1.25, 0.6, [0.8, 1.1, 0.9], 1)}
      {place(0, 1.25, 0.6, [0.8, 1.1, 0.9], 2)}
      {place(-0.2, 0, 1.75, [1.3, 0.5, 0.9], 3)}
      {place(-1.6, 0.8, 0.8, [1.2, 1.2, 1.1], 4)}
      {place(-1.6, -0.9, 0.7, [1.1, 1, 1.1], 5)}
      <mesh position={[CAVE.x + Math.sin(f) * 0.05, y + 0.02, CAVE.z + Math.cos(f) * 0.05]} rotation={[0, f, 0]}>
        <circleGeometry args={[0.9, 16, 0, Math.PI]} />
        <meshBasicMaterial color="#1d1b19" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
function Crystals({ night }: { night: number }) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color: '#c9a7ff', emissive: '#9a6bff', emissiveIntensity: 1.2, roughness: 0.2 }),
    [],
  );
  useEffect(() => {
    material.emissiveIntensity = 1 + night * 1.5;
  }, [night, material]);
  const y = groundHeight(CAVE.x, CAVE.z),
    f = CAVE.facing;
  return (
    <group name="crystals">
      {[
        [0.35, -0.5, 0.32],
        [0.5, 0.45, 0.24],
        [0.65, 0.05, 0.18],
      ].map(([fw, s, size], i) => (
        <mesh
          key={i}
          position={[
            CAVE.x + Math.sin(f) * fw + Math.cos(f) * s,
            y + size,
            CAVE.z + Math.cos(f) * fw - Math.sin(f) * s,
          ]}
          rotation={[0.3 * i, i, 0.2]}
          material={material}
          raycast={ignore}
        >
          <octahedronGeometry args={[size, 0]} />
        </mesh>
      ))}
    </group>
  );
}
function SummitCairn() {
  const [x, y, z] = at(...SUMMIT);
  return (
    <group name="summit-cairn" position={[x + 0.9, y, z - 0.6]}>
      {[0.42, 0.34, 0.27, 0.2, 0.14].map((r, i, all) => (
        <Rock
          key={i}
          p={[Math.sin(i) * 0.05, all.slice(0, i).reduce((s, v) => s + v * 0.95, 0) + r * 0.6, 0]}
          s={[r, r * 0.6, r]}
          turn={i}
          c="#8f8a80"
        />
      ))}
    </group>
  );
}
function SummitFlag({ motion }: { motion: boolean }) {
  const flag = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (flag.current && motion) flag.current.rotation.y = Math.sin(clock.elapsedTime * 3) * 0.25;
  });
  const [x, y, z] = at(...SUMMIT);
  return (
    <group name="summit-flag" position={[x - 0.6, y, z - 0.9]}>
      <Cyl p={[0, 1.2, 0]} r={0.04} h={2.4} c="#d9d4c7" />
      <mesh ref={flag} position={[0.3, 2.15, 0]} castShadow raycast={ignore}>
        <planeGeometry args={[0.6, 0.38]} />
        <meshStandardMaterial color="#e2563b" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ---- Forest: instanced pines, birches and palms (they never move) ----
function useInstances(geometry: THREE.BufferGeometry, trees: typeof FOREST, color: (i: number) => string) {
  return useMemo(() => {
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }),
      trees.length,
    );
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      c = new THREE.Color();
    trees.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.turn);
      m.compose(
        new THREE.Vector3(t.x, groundHeight(t.x, t.z) - 0.05, t.z),
        q,
        new THREE.Vector3(t.scale, t.scale, t.scale),
      );
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(color(i)));
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.raycast = ignore;
    mesh.computeBoundingSphere();
    return mesh;
  }, [geometry, trees]);
}
const shift = (g: THREE.BufferGeometry, y: number) => g.translate(0, y, 0);
function Forest() {
  const kinds = useMemo(() => {
    const pines = FOREST.filter(t => t.kind === 'pine'),
      birches = FOREST.filter(t => t.kind === 'birch'),
      palms = FOREST.filter(t => t.kind === 'palm');
    const pineCrown = mergeGeometries([
      shift(new THREE.ConeGeometry(1.15, 1.7, 7), 1.7),
      shift(new THREE.ConeGeometry(0.9, 1.4, 7), 2.55),
      shift(new THREE.ConeGeometry(0.6, 1.2, 7), 3.3),
    ])!;
    const palmCrown = mergeGeometries(
      Array.from({ length: 6 }, (_, n) => {
        const leaf = new THREE.SphereGeometry(1, 6, 4).scale(1, 0.09, 0.27);
        leaf
          .translate(0.65, 0, 0)
          .rotateZ(-0.2)
          .rotateY((n * Math.PI) / 3);
        return leaf.translate(0, 2.5, 0);
      }),
    )!;
    return { pines, birches, palms, pineCrown, palmCrown };
  }, []);
  const greens = ['#5f8a5e', '#567f57', '#6a9466', '#4f7650'];
  const pineTrunks = useInstances(
    useMemo(() => shift(new THREE.CylinderGeometry(0.1, 0.17, 1.2, 6), 0.6), []),
    kinds.pines,
    () => '#7a5a3e',
  );
  const pineCrowns = useInstances(kinds.pineCrown, kinds.pines, i => greens[i % greens.length]);
  const birchTrunks = useInstances(
    useMemo(() => shift(new THREE.CylinderGeometry(0.08, 0.11, 2.6, 6), 1.3), []),
    kinds.birches,
    () => '#ece8dc',
  );
  const birchCrowns = useInstances(
    useMemo(() => shift(new THREE.IcosahedronGeometry(0.9, 0).scale(1, 1.25, 1), 3), []),
    kinds.birches,
    i => ['#b5c96a', '#a3bf62', '#c8cf74'][i % 3],
  );
  const palmTrunks = useInstances(
    useMemo(() => shift(new THREE.CylinderGeometry(0.13, 0.22, 2.5, 7), 1.25), []),
    kinds.palms,
    () => '#b19972',
  );
  const palmCrowns = useInstances(kinds.palmCrown, kinds.palms, i => (i % 2 ? '#638769' : '#719576'));
  return (
    <group name="forest">
      {[pineTrunks, pineCrowns, birchTrunks, birchCrowns, palmTrunks, palmCrowns].map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}

// ---- Wildlife ----
const DEER_HOMES: Point[] = [
  [-8, -71],
  [-16, -84],
  [0, -108],
  [34, -84],
];
const walkableNear = (home: Point, radius: number, seed: number) => {
  const out: Point[] = [];
  for (let i = 0; out.length < 14 && i < 400; i++) {
    const a = i * 2.39996 + seed,
      r = radius * Math.sqrt(((i * 37) % 97) / 97);
    const p: Point = [home[0] + Math.cos(a) * r, home[1] + Math.sin(a) * r];
    if (highlandsWalkable(...p) && !treeAt(...p)) out.push(p);
  }
  return out.length ? out : [home];
};
function Deer({ player, motion }: { player: RefObject<THREE.Vector3>; motion: boolean }) {
  const herd = useRef<THREE.Group>(null);
  const state = useMemo(
    () =>
      DEER_HOMES.map((home, i) => {
        const spots = walkableNear(home, 5, i);
        return { spots, x: spots[0][0], z: spots[0][1], target: spots[0], wait: 2 + i, heading: 0, flee: 0, step: 0 };
      }),
    [],
  );
  useFrame((_, dt) => {
    if (!motion || !herd.current) return;
    dt = Math.min(dt, 0.05);
    const me = player.current;
    herd.current.children.forEach((deer, i) => {
      const d = state[i];
      const away = me ? Math.hypot(me.x - d.x, me.z - d.z) : Infinity;
      // Startled: bound off to the far side of their clearing.
      if (away < 4.5 && d.flee <= 0 && me) {
        d.target = d.spots.reduce((best, p) =>
          Math.hypot(p[0] - me.x, p[1] - me.z) > Math.hypot(best[0] - me.x, best[1] - me.z) ? p : best,
        );
        d.flee = 3;
        d.wait = 0;
      }
      d.flee -= dt;
      const dx = d.target[0] - d.x,
        dz = d.target[1] - d.z,
        dist = Math.hypot(dx, dz),
        speed = d.flee > 0 ? 3.6 : 0.7;
      let moving = false;
      if (dist > 0.1 && d.wait <= 0) {
        const s = Math.min(dist, speed * dt);
        d.x += (dx / dist) * s;
        d.z += (dz / dist) * s;
        d.heading = Math.atan2(dx, dz);
        d.step += dt * (d.flee > 0 ? 14 : 7);
        moving = true;
      } else if ((d.wait -= dt) < -4 - (i % 3) * 2) {
        d.target = d.spots[Math.floor(Math.random() * d.spots.length)];
        d.wait = 0;
      }
      deer.position.set(
        d.x,
        groundHeight(d.x, d.z) + (moving && d.flee > 0 ? Math.abs(Math.sin(d.step)) * 0.25 : 0),
        d.z,
      );
      deer.rotation.y = d.heading;
      const [, neck, ...legs] = deer.children;
      // Head down to graze while standing still.
      if (neck) neck.rotation.x = moving ? 0 : 0.9 + Math.sin(d.step + i) * 0.05;
      legs.slice(0, 4).forEach((leg, k) => (leg.rotation.x = moving ? Math.sin(d.step + (k % 2) * Math.PI) * 0.5 : 0));
      if (!moving) d.step += dt;
    });
  });
  return (
    <group ref={herd} name="deer">
      {state.map((_, i) => (
        <group key={i}>
          <mesh position={[0, 0.75, 0]} scale={[0.26, 0.28, 0.55]} castShadow raycast={ignore}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#a8774c" roughness={0.9} />
          </mesh>
          <group position={[0, 0.9, 0.42]}>
            <Box p={[0, 0.2, 0.05]} s={[0.12, 0.42, 0.12]} r={[-0.4, 0, 0]} c="#a8774c" />
            <Box p={[0, 0.42, 0.2]} s={[0.15, 0.15, 0.28]} c="#9b6c44" />
            {i % 2 === 0 &&
              [-1, 1].map(s => (
                <Box key={s} p={[s * 0.1, 0.6, 0.12]} s={[0.03, 0.3, 0.03]} r={[0, 0, s * 0.4]} c="#d9c7a3" />
              ))}
          </group>
          {[
            [-0.13, 0.3],
            [0.13, -0.3],
            [0.13, 0.3],
            [-0.13, -0.3],
          ].map(([x, z], k) => (
            <group key={k} position={[x, 0.55, z]}>
              <Box p={[0, -0.27, 0]} s={[0.07, 0.55, 0.07]} c="#7d5638" />
            </group>
          ))}
          <Box p={[0, 0.85, -0.55]} s={[0.1, 0.12, 0.08]} c="#f2eadb" />
        </group>
      ))}
    </group>
  );
}
function Birds({ player, motion }: { player: RefObject<THREE.Vector3>; motion: boolean }) {
  const flocks = useMemo(
    () =>
      (
        [
          [14, -74],
          [-10, -91],
          [22, -86],
        ] as Point[]
      ).map(spot => {
        const tree = FOREST.filter(t => t.kind !== 'palm').reduce((best, t) =>
          Math.hypot(t.x - spot[0], t.z - spot[1]) < Math.hypot(best.x - spot[0], best.z - spot[1]) ? t : best,
        );
        return {
          tree,
          top: groundHeight(tree.x, tree.z) + (tree.kind === 'pine' ? 3.9 : 3.6) * tree.scale,
          flying: 0,
          lift: 0,
        };
      }),
    [],
  );
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (!group.current) return;
    const t = motion ? clock.elapsedTime : 0,
      me = player.current;
    group.current.children.forEach((flock, f) => {
      const s = flocks[f];
      if (me && Math.hypot(me.x - s.tree.x, me.z - s.tree.z) < 6 && s.flying <= 0) s.flying = 10;
      s.flying -= motion ? dt : 0;
      s.lift = THREE.MathUtils.damp(s.lift, s.flying > 0 ? 1 : 0, 1.2, Math.min(dt, 0.1));
      flock.children.forEach((bird, i) => {
        const a = t * 1.1 + (i / 5) * Math.PI * 2;
        const perch: V3 = [
          s.tree.x + Math.cos(i * 1.3) * 0.35,
          s.top + (i % 2) * 0.1,
          s.tree.z + Math.sin(i * 1.3) * 0.35,
        ];
        const air: V3 = [
          s.tree.x + Math.cos(a) * (2.5 + (i % 2)),
          s.top + 3.5 + Math.sin(a * 2 + i) * 0.6,
          s.tree.z + Math.sin(a) * (2.5 + (i % 2)),
        ];
        bird.position.set(...(perch.map((v, k) => v + (air[k] - v) * s.lift) as V3));
        bird.rotation.y = s.lift > 0.2 ? -a : i;
        const flap = s.lift > 0.1 ? Math.sin(t * 18 + i) * 0.7 : 0.1;
        bird.children[0].rotation.z = flap;
        bird.children[1].rotation.z = -flap;
      });
    });
  });
  return (
    <group ref={group} name="birds">
      {flocks.map((_, f) => (
        <group key={f}>
          {Array.from({ length: 5 }, (_, i) => (
            <group key={i}>
              {[1, -1].map(side => (
                <mesh key={side} position={[side * 0.09, 0, 0]} raycast={ignore}>
                  <boxGeometry args={[0.18, 0.015, 0.08]} />
                  <meshStandardMaterial color="#3d3a36" />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
function Fireflies({ night, motion }: { night: number; motion: boolean }) {
  const count = 56;
  const spots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const camp = i % 3 === 0,
          a = i * 2.4,
          r = camp ? 2 + (i % 5) * 0.8 : 1.15 + (i % 4) * 0.35;
        const [x, z] = camp
          ? [CAMPSITE.x + Math.cos(a) * r, CAMPSITE.z + Math.sin(a) * r]
          : [LAKE.x + Math.cos(a) * LAKE.rx * r, LAKE.z + Math.sin(a) * LAKE.rz * r];
        return { x, z, y: Math.max(LAKE.level, groundHeight(x, z)) + 0.6 + (i % 4) * 0.3, phase: i * 1.7 };
      }),
    [],
  );
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.045, 6, 4),
      new THREE.MeshBasicMaterial({ color: '#e9ff8a', transparent: true, opacity: 0, toneMapped: false }),
      count,
    );
    m.raycast = ignore;
    m.frustumCulled = false;
    return m;
  }, []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ clock }) => {
    const material = mesh.material as THREE.MeshBasicMaterial,
      show = Math.max(0, (night - 0.45) / 0.35);
    material.opacity = show;
    mesh.visible = show > 0.01;
    if (!mesh.visible) return;
    const t = motion ? clock.elapsedTime : 0;
    spots.forEach((s, i) => {
      const blink = 0.6 + 0.4 * Math.max(0, Math.sin(t * 2.3 + s.phase));
      matrix
        .makeScale(blink, blink, blink)
        .setPosition(
          s.x + Math.sin(t * 0.4 + s.phase) * 0.6,
          s.y + Math.sin(t * 0.7 + s.phase) * 0.3,
          s.z + Math.cos(t * 0.35 + s.phase) * 0.6,
        );
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}
function SummitClouds({ period, motion }: { period: Period; motion: boolean }) {
  const group = useRef<THREE.Group>(null),
    material = useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color: '#ffffff',
          transparent: true,
          opacity: 0,
          roughness: 1,
          depthWrite: false,
        }),
      [],
    );
  const puffs = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2;
        return { a, r: 9 + (i % 3) * 1.6, y: 9 + (i % 2) * 1.2 };
      }),
    [],
  );
  useFrame(({ clock }, dt) => {
    // A cloud bank wraps the mountain below the summit in the early morning, then burns off.
    const want = period === 'dawn' || period === 'morning' ? 0.75 : 0;
    material.opacity = THREE.MathUtils.damp(material.opacity, want, 0.6, Math.min(dt, 0.1));
    if (group.current) {
      group.current.visible = material.opacity > 0.01;
      if (motion) group.current.rotation.y = clock.elapsedTime * 0.01;
    }
  });
  return (
    <group position={[PEAK.x, 0, PEAK.z]}>
      <group ref={group} visible={false}>
        {puffs.map((p, i) => (
          <group key={i} position={[Math.cos(p.a) * p.r, p.y, Math.sin(p.a) * p.r]}>
            {[
              [0, 0, 0, 1.6],
              [1.4, -0.2, 0.3, 1.2],
              [-1.3, -0.3, -0.2, 1.1],
              [0.4, 0.5, -0.6, 1],
            ].map(([x, y, z, r], k) => (
              <mesh key={k} position={[x, y, z]} scale={[r, r * 0.55, r]} material={material} raycast={ignore}>
                <sphereGeometry args={[1, 12, 8]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}
