import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Period } from './daylight';
import { riders, seaState, spot, type SeaSight } from './fun-state';
import type { RideView } from './rides';
import { reef } from './world';
import { Turtle } from './sea-life';
import {
  FLYERS,
  FLYING_SHOALS,
  JELLYFISH,
  PODS,
  ROAMING_SCHOOLS,
  WHALES,
  breachChance,
  flyingFish,
  jellyPose,
  landDistance,
  podMember,
  rand,
  schoolPose,
  seaRegion,
  sharkPose,
  straitTurtle,
  whalePose,
  type Swimmer,
} from './open-sea';

// The open sea: roaming dolphin pods, schools with gulls over them, whales that spout and breach,
// flying fish by day, a far-off shark, jellyfish on the reef, a turtle crossing the strait, splash
// rings where anything breaks the surface and glowing plankton in every wake at night.
// The routes and timing are in open-sea.ts; this file draws them.

type V3 = [number, number, number];
type Part = { s: V3; p?: V3; r?: V3; c: string } | { tri: number[]; c: string };
const ignore = () => {};
const ball = new THREE.SphereGeometry(1, 8, 6).toNonIndexed().attributes.position.array;
// Each animal is one mesh (plus the parts that move), coloured per vertex, so a whole pod costs
// a handful of draw calls.
function sculpt(parts: Part[]) {
  const positions: number[] = [],
    colors: number[] = [];
  const matrix = new THREE.Matrix4(),
    v = new THREE.Vector3(),
    color = new THREE.Color();
  for (const part of parts) {
    const source = 'tri' in part ? part.tri : ball;
    if ('tri' in part) matrix.identity();
    else
      matrix.compose(
        new THREE.Vector3(...(part.p ?? [0, 0, 0])),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...(part.r ?? [0, 0, 0]))),
        new THREE.Vector3(...part.s),
      );
    color.set(part.c);
    for (let i = 0; i < source.length; i += 3) {
      v.set(source[i], source[i + 1], source[i + 2]).applyMatrix4(matrix);
      positions.push(v.x, v.y, v.z);
      colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
const sides = [-1, 1];
const fishColors = ['#e6b15d', '#ed9978', '#bad5bd'];
const shapes = {
  dolphin: sculpt([
    { s: [0.25, 0.23, 0.88], c: '#799da8' },
    { p: [0, -0.08, 0.18], s: [0.19, 0.14, 0.67], c: '#c5d7d0' },
    { p: [0, 0, 0.88], s: [0.11, 0.09, 0.3], c: '#799da8' },
    { tri: [0, 0.16, 0.09, 0, 0.54, -0.36, 0, 0.16, -0.61], c: '#648b99' },
    ...sides.map(side => ({ tri: [0, -0.05, 0.25, side * 0.5, -0.1, -0.4, 0, -0.05, -0.45], c: '#648b99' })),
    ...sides.map(side => ({ p: [side * 0.19, 0.07, 0.63] as V3, s: [0.025, 0.025, 0.025] as V3, c: '#294957' })),
  ]),
  dolphinTail: sculpt([{ s: [0.46, 0.045, 0.18], c: '#648b99' }]),
  whale: sculpt([
    { s: [1.05, 1, 3.6], c: '#5e7d90' },
    { p: [0, -0.42, 0.9], s: [0.96, 0.72, 2.8], c: '#d3dcd5' },
    { p: [0, 0.05, 2.75], s: [0.82, 0.66, 1.35], c: '#5e7d90' },
    { p: [0, 0.05, -3.4], s: [0.42, 0.4, 1.6], c: '#5e7d90' },
    { tri: [0, 0.92, -0.8, 0, 1.32, -1.6, 0, 0.86, -2.1], c: '#4c6878' },
    ...sides.map(side => ({ p: [side * 0.74, 0.05, 2.75] as V3, s: [0.07, 0.07, 0.07] as V3, c: '#1d2c36' })),
  ]),
  whaleFlukes: sculpt(
    sides.map(side => ({
      p: [side * 0.8, 0, -0.3] as V3,
      r: [0, side * 0.4, 0] as V3,
      s: [0.9, 0.07, 0.45] as V3,
      c: '#4c6878',
    })),
  ),
  whaleFlipper: sides.map(side =>
    sculpt([{ p: [side * 1.35, 0, -0.35], r: [0, side * 0.45, 0], s: [1.45, 0.07, 0.36], c: '#dfe6e0' }]),
  ),
  shark: sculpt([
    { s: [0.3, 0.28, 1.25], c: '#6b7f8a' },
    { tri: [0, 0.2, 0.4, 0, 1, -0.25, 0, 0.2, -0.45], c: '#56697a' },
    { tri: [0, 0.05, -1.05, 0, 0.62, -1.65, 0, -0.2, -1.5], c: '#56697a' },
  ]),
  fish: fishColors.map(c =>
    sculpt([
      { s: [0.085, 0.08, 0.24], c },
      { p: [0, 0, -0.27], s: [0.16, 0.025, 0.11], c },
    ]),
  ),
  flyer: sculpt([
    { s: [0.07, 0.07, 0.26], c: '#8fb7d6' },
    { p: [0, 0, -0.28], s: [0.1, 0.02, 0.09], c: '#8fb7d6' },
    ...sides.map(side => ({ tri: [0, 0.02, 0.12, side * 0.46, 0.08, -0.14, 0, 0.02, -0.1], c: '#e6f1f6' })),
  ]),
  gull: sculpt([
    { s: [0.09, 0.08, 0.24], c: '#f5f3ea' },
    { p: [0, 0.04, 0.22], s: [0.06, 0.06, 0.07], c: '#f5f3ea' },
    { p: [0, 0.03, 0.3], s: [0.02, 0.02, 0.05], c: '#e6a54a' },
  ]),
  gullWing: sides.map(side =>
    sculpt([
      { tri: [0, 0, 0.1, side * 0.36, 0, 0.04, 0, 0, -0.1], c: '#eeece3' },
      { tri: [side * 0.36, 0, 0.04, side * 0.62, 0, -0.08, 0, 0, -0.1], c: '#8d949a' },
    ]),
  ),
  jelly: sculpt([
    { s: [0.28, 0.2, 0.28], c: '#f3bedd' },
    ...[0, 1, 2, 3].map(i => ({
      p: [Math.cos(i * 1.57) * 0.12, -0.34, Math.sin(i * 1.57) * 0.12] as V3,
      s: [0.03, 0.3, 0.03] as V3,
      c: '#f7d7ea',
    })),
  ]),
};
const skin = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.8,
  side: THREE.DoubleSide,
});
const jellySkin = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  transparent: true,
  opacity: 0.72,
  emissive: '#ff8fd0',
  emissiveIntensity: 0.15,
});
const foam = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false });
const droplet = new THREE.SphereGeometry(0.16, 6, 4);
const glint = new THREE.PlaneGeometry(0.34, 0.06);

const SURFACE = -0.33,
  RINGS = 18,
  GLOW = 180,
  GLOW_SECONDS = 4,
  GLINTS = 11,
  GULLS = 3,
  SCHOOL_FISH = 9,
  PUFFS = 5,
  DROPS = 8;
const pods = PODS.flatMap((size, pod) => Array.from({ length: size }, (_, member) => ({ pod, member })));
const BOW_RIDES: Partial<Record<RideView['kind'], string>> = {
  sailboat: 'the sailboat',
  jetski: 'a jet ski',
  ferry: 'the water taxi',
};

function place(object: THREE.Object3D, p: Swimmer, roll = 0) {
  object.visible = p.presence > 0.01;
  object.position.set(p.x, p.y, p.z);
  object.rotation.set(p.pitch, p.heading, roll, 'YXZ');
}
function Dolphin() {
  return (
    <group>
      <mesh raycast={ignore} geometry={shapes.dolphin} material={skin} />
      <mesh raycast={ignore} geometry={shapes.dolphinTail} material={skin} position={[0, 0, -0.85]} />
    </group>
  );
}

export function OpenSea({ motion, period, darkness }: { motion: boolean; period: Period; darkness: number }) {
  const podGroup = useRef<THREE.Group>(null),
    escortGroup = useRef<THREE.Group>(null),
    schoolGroup = useRef<THREE.Group>(null),
    glintGroup = useRef<THREE.Group>(null),
    gullGroup = useRef<THREE.Group>(null),
    flyerGroup = useRef<THREE.Group>(null),
    whaleGroup = useRef<THREE.Group>(null),
    dropGroup = useRef<THREE.Group>(null),
    shark = useRef<THREE.Group>(null),
    turtle = useRef<THREE.Group>(null),
    jellyGroup = useRef<THREE.Group>(null),
    ringGroup = useRef<THREE.Group>(null),
    glow = useRef<THREE.InstancedMesh>(null);
  // Start from the wall clock, so the sea is somewhere new every visit.
  const elapsed = useRef((Date.now() / 1000) % 86400);
  const state = useRef({
    night: 0,
    flying: 0,
    leaping: {} as Record<string, boolean>,
    rings: Array.from({ length: RINGS }, () => ({ born: -99, size: 1 })),
    glow: Array.from({ length: GLOW }, () => ({ x: 0, z: 0, born: -99, size: 1 })),
    glowNext: 0,
    glowClock: 0,
    whales: Array.from({ length: WHALES }, () => ({
      event: -1,
      splash: false,
      spout: false,
      present: false,
      x: 0,
      z: 0,
    })),
    escort: { id: null as string | null, presence: 0, x: 0, z: 0, heading: 0, depth: 0, announced: false },
    shark: false,
    posted: {} as Record<string, number>,
    lastPost: -1e9,
  });
  const tools = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      flat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      color: new THREE.Color(),
      plankton: new THREE.Color('#58f2dc'),
      white: new THREE.Color('#ffffff'),
      // A soft round glow, so the plankton reads as light in the water and not as discs.
      soft: (() => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64;
        const context = canvas.getContext('2d')!,
          fade = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        fade.addColorStop(0, '#ffffff');
        fade.addColorStop(0.35, '#8a8a8a');
        fade.addColorStop(1, '#000000');
        context.fillStyle = fade;
        context.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
      })(),
    }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05),
      s = state.current;
    if (motion) elapsed.current += dt;
    const t = elapsed.current;
    s.night = THREE.MathUtils.damp(s.night, THREE.MathUtils.smoothstep(darkness, 0.55, 0.95), 2, dt);
    s.flying = THREE.MathUtils.damp(s.flying, period === 'morning' || period === 'midday' ? 1 : 0, 1.5, dt);
    const night = s.night;

    // Rings spread where something breaks the surface; plankton lights up where something passes.
    const ring = (x: number, z: number, size: number, delay = 0) => {
      const oldest = s.rings.reduce((best, r, i) => (r.born < s.rings[best].born ? i : best), 0);
      s.rings[oldest] = { born: t + delay, size };
      ringGroup.current?.children[oldest].position.set(x, SURFACE, z);
    };
    s.glowClock += motion ? dt : 0;
    const emitting = night > 0.03 && s.glowClock > 0.5;
    if (emitting) s.glowClock = 0;
    const wake = (x: number, z: number, size: number) => {
      if (!emitting) return;
      const seed = s.glowNext;
      s.glow[s.glowNext] = {
        x: x + (rand(seed, t) - 0.5) * size,
        z: z + (rand(t, seed) - 0.5) * size,
        born: t,
        size: size * (0.5 + rand(seed, 3) * 0.5),
      };
      s.glowNext = (s.glowNext + 1) % GLOW;
    };
    // The activity feed hears about the notable moments, but not too often.
    const sight = (
      key: string,
      every: number,
      icon: string,
      who: string,
      text: string,
      where: () => [number, number],
    ) => {
      const now = performance.now() / 1000;
      if (now - (s.posted[key] ?? -1e9) < every || now - s.lastPost < 40) return;
      s.posted[key] = s.lastPost = now;
      seaState.onSighting({ icon, who, text, where });
    };
    const sights: SeaSight[] = [];
    const dolphin = (object: THREE.Object3D, key: string, p: Swimmer & { leap: number }, index: number) => {
      place(object, p);
      object.children[1].rotation.x = Math.sin(t * 4 + index) * 0.25;
      const up = p.leap > 0;
      if (up !== !!s.leaping[key]) ring(p.x, p.z, 0.7);
      s.leaping[key] = up;
      if (p.presence > 0.9) wake(p.x, p.z, 0.9);
      if (p.presence > 0.5) spot('dolphin', p.x, p.z);
    };

    // Dolphin pods.
    podGroup.current?.children.forEach((object, i) => {
      const { pod, member } = pods[i],
        p = podMember(pod, member, t);
      dolphin(object, `p${i}`, p, i);
      if (member === 0)
        sights.push({
          kind: 'dolphins',
          x: p.x,
          z: p.z,
          present: p.presence > 0.5,
          ahead: seconds => {
            const q = podMember(pod, 0, t + seconds);
            return { x: q.x, z: q.z, present: q.presence > 0.5 };
          },
        });
    });

    // Now and then a pair comes over to ride the bow wave of a boat that's out on the water.
    // Divers get a visit every time: the pair circles them for as long as they're down.
    const e = s.escort,
      diver = (r?: RideView) => r?.kind === 'scuba' && r.y < -1.5 && r.t > 22,
      rideable = (r?: RideView) => !!r && (r.kind in BOW_RIDES || diver(r)) && landDistance(r.x, r.z) > 5;
    let boat = e.id ? riders[e.id] : undefined;
    if (!rideable(boat)) {
      boat = undefined;
      if (e.presence < 0.05) {
        const keen = rand(Math.floor(t / 70), 5) < 0.65;
        e.id = Object.keys(riders).find(id => rideable(riders[id]) && (keen || diver(riders[id]))) || null;
        e.announced = false;
      }
    } else Object.assign(e, { x: boat!.x, z: boat!.z, heading: boat!.heading, depth: diver(boat) ? boat!.y : 0 });
    e.presence = THREE.MathUtils.damp(e.presence, boat ? 1 : 0, 1.5, dt);
    escortGroup.current?.children.forEach((object, k) => {
      const side = k ? 1.5 : -1.5,
        ahead = 2 - k * 1.2,
        phase = (t + k * 2.7) % 6,
        leap = phase < 1.8 && e.presence > 0.95 ? Math.sin((phase / 1.8) * Math.PI) : 0,
        // Round a diver: in from the blue, then circling close.
        around = t * 0.75 + k * Math.PI,
        reach = 2.3 + Math.sin(t * 0.4 + k) * 0.5 + (1 - e.presence) * 20;
      if (e.depth < 0)
        return dolphin(
          object,
          `e${k}`,
          {
            x: e.x + Math.cos(around) * reach,
            z: e.z + Math.sin(around) * reach,
            y: Math.min(-0.95, e.depth + 0.45 + Math.sin(t * 1.1 + k * 2) * 0.4),
            heading: Math.atan2(-Math.sin(around), Math.cos(around)),
            pitch: Math.cos(t * 1.1 + k * 2) * 0.15,
            leap: 0,
            presence: e.presence,
          },
          k,
        );
      dolphin(
        object,
        `e${k}`,
        {
          x: e.x + Math.sin(e.heading) * ahead + Math.cos(e.heading) * side,
          z: e.z + Math.cos(e.heading) * ahead - Math.sin(e.heading) * side,
          y: -0.65 + leap * 1.4 - (1 - e.presence) * 3.2,
          heading: e.heading,
          pitch: leap ? -Math.cos((phase / 1.8) * Math.PI) * 0.6 : 0,
          leap,
          presence: e.presence,
        },
        k,
      );
    });
    if (boat && e.presence > 0.6 && !e.announced) {
      e.announced = true;
      const doing = diver(boat)
        ? 'came to play with a diver off the jetty'
        : `are riding the bow wave of ${BOW_RIDES[boat.kind]}`;
      sight('escort', 300, '🐬', 'Dolphins', doing, () => [e.x, e.z]);
    }
    // Boats leave a glowing wake at night too.
    for (const r of Object.values(riders))
      if (r.y > -0.3 && r.y < 1 && landDistance(r.x, r.z) > 1) wake(r.boat?.x ?? r.x, r.boat?.z ?? r.z, 1.1);

    // Roaming schools: fish under a shimmering patch, gulls wheeling above.
    for (let i = 0; i < ROAMING_SCHOOLS; i++) {
      const p = schoolPose(i, t),
        school = schoolGroup.current?.children[i],
        glints = glintGroup.current?.children[i],
        gulls = gullGroup.current?.children[i];
      if (school) {
        place(school, p);
        if (p.presence > 0.5) spot('school', p.x, p.z);
        school.children.forEach((fish, n) => (fish.rotation.y = Math.sin(t * 7 + n * 1.3) * 0.3));
      }
      if (glints) {
        glints.visible = p.presence > 0.3;
        glints.position.set(p.x, SURFACE + 0.02, p.z);
        glints.children.forEach((g, n) =>
          g.scale.setScalar(
            (0.5 + 0.5 * Math.sin(t * 3.1 + n * 1.7 + i)) ** 4 * p.presence * (1 - night * 0.7) + 0.001,
          ),
        );
      }
      if (gulls) {
        gulls.visible = p.presence > 0.3 && night < 0.6;
        gulls.children.forEach((gull, g) => {
          const a = t * (0.5 + g * 0.06) + g * 2.1 + i,
            r = 2.3 + g * 0.6;
          gull.position.set(
            p.x + Math.cos(a) * r,
            2.9 + g * 0.55 + Math.sin(t * 0.7 + g) * 0.3 + (1 - p.presence) * 4,
            p.z + Math.sin(a) * r,
          );
          gull.rotation.set(0, -a, -0.3, 'YXZ');
          const flap = Math.sin(t * 5 + g * 2) * 0.45 + 0.1;
          gull.children[1].rotation.z = flap;
          gull.children[2].rotation.z = -flap;
        });
      }
    }

    // Flying fish skip across the surface while the sun is high.
    flyerGroup.current?.children.forEach((fish, i) => {
      const shoal = Math.floor(i / FLYERS),
        p = flyingFish(shoal, i % FLYERS, t),
        key = `f${i}`;
      place(fish, p);
      fish.visible &&= s.flying > 0.02;
      fish.scale.setScalar(s.flying);
      if (fish.visible && p.air > 0 !== !!s.leaping[key]) ring(p.x, p.z, 0.3);
      s.leaping[key] = p.air > 0;
    });

    // Whales.
    const chance = breachChance(period);
    whaleGroup.current?.children.forEach((whale, i) => {
      const p = whalePose(i, t, chance),
        w = s.whales[i],
        [, flukes, left, right, ...puffs] = whale.children;
      place(whale, p, p.roll);
      if (p.presence > 0.5) spot('whale', p.x, p.z);
      Object.assign(w, { x: p.x, z: p.z });
      flukes.rotation.x = Math.sin(t * 1.1 + i) * 0.2 - p.pitch * 0.4;
      left.rotation.z = -0.25 + Math.sin(t * 0.6 + i) * 0.12;
      right.rotation.z = 0.25 - Math.sin(t * 0.6 + i) * 0.12;
      puffs.forEach((puff, n) => {
        const q = p.spout < 0 ? 0 : THREE.MathUtils.clamp((p.spout * 2.6 - n * 0.14) / 1.5, 0, 1);
        puff.visible = q > 0 && q < 1;
        puff.position.set((n - 2) * 0.25 * q, 1.05 + q * (3 + (n % 2) * 0.8), 2.3 - q * 0.5);
        puff.scale.setScalar(0.18 + q * 0.42);
        ((puff as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.sin(q * Math.PI) * 0.75;
      });
      const where = (): [number, number] => [w.x, w.z];
      const present = p.presence > 0.5;
      if (present && !w.present)
        sight('whale', 360, '🐋', 'A humpback whale', `was spotted ${seaRegion(p.x, p.z)}`, where);
      w.present = present;
      if (p.breaching && w.event !== p.event) {
        w.event = p.event;
        ring(p.x, p.z, 1.8);
        sight('breach', 150, '🐋', 'A humpback whale', `is breaching ${seaRegion(p.x, p.z)}`, where);
      }
      if (p.spout >= 0 && !w.spout) ring(p.x, p.z, 1.3);
      w.spout = p.spout >= 0;
      // The splash: wide rings and a crown of spray thrown out from where it landed.
      const drops = dropGroup.current?.children[i];
      if (p.splash >= 0 && !w.splash) {
        [2.4, 3.6, 4.8].forEach((size, n) => ring(p.x, p.z, size, n * 0.22));
        drops?.position.set(p.x, 0, p.z);
      }
      w.splash = p.splash >= 0;
      if (drops) {
        drops.visible = p.splash >= 0;
        const air = Math.max(0, p.splash) * 2.6;
        drops.children.forEach((drop, n) => {
          const a = (n / DROPS) * Math.PI * 2 + i,
            out = (1.6 + (n % 3) * 0.7) * air,
            y = -0.4 + (3.8 + (n % 2) * 1.4) * air - 4.4 * air * air;
          drop.visible = y > -0.4;
          drop.position.set(Math.cos(a) * out, y, Math.sin(a) * out);
        });
      }
      if (p.presence > 0.9) wake(p.x, p.z, 3);
      sights.push({
        kind: 'whale',
        x: p.x,
        z: p.z,
        present,
        ahead: seconds => {
          const q = whalePose(i, t + seconds, chance);
          return { x: q.x, z: q.z, present: q.presence > 0.5 };
        },
      });
    });

    // The shark's fin, the strait turtle and the jellyfish.
    if (shark.current) {
      const p = sharkPose(t),
        present = p.presence > 0.5;
      place(shark.current, p);
      if (present) spot('shark', p.x, p.z);
      shark.current.children[0].rotation.y = Math.sin(t * 1.6) * 0.08;
      if (present && !s.shark)
        sight('shark', 900, '🦈', 'A reef shark', `is cruising ${seaRegion(p.x, p.z)} (it's friendly)`, () => {
          const now = sharkPose(elapsed.current);
          return [now.x, now.z];
        });
      s.shark = present;
      sights.push({ kind: 'shark', x: p.x, z: p.z, present });
    }
    if (turtle.current) {
      const p = straitTurtle(t);
      place(turtle.current, p);
      if (p.presence > 0.5) spot('turtle', p.x, p.z);
      turtle.current.traverse(part => {
        if (part.name === 'flipper') part.rotation.z = Math.sin(t * 2.2) * 0.3 * Math.sign(part.position.x);
      });
    }
    jellySkin.emissiveIntensity = 0.15 + night * 1.5;
    jellyGroup.current?.children.forEach((jelly, i) => {
      const p = jellyPose(reef, i, t);
      jelly.position.set(p.x, p.y, p.z);
      spot('jellyfish', p.x, p.z);
      jelly.scale.set(1.15 - p.pulse * 0.25, 0.85 + p.pulse * 0.3, 1.15 - p.pulse * 0.25);
    });
    seaState.sights = sights;

    // Splash rings.
    ringGroup.current?.children.forEach((object, i) => {
      const { born, size } = s.rings[i],
        life = 1.3 + size * 0.45,
        age = (t - born) / life,
        material = (object as THREE.Mesh).material as THREE.MeshBasicMaterial;
      object.visible = age > 0 && age < 1;
      if (!object.visible) return;
      object.scale.setScalar(size * (0.25 + age * 1.1));
      material.opacity = (1 - age) ** 1.5 * (0.6 + night * 0.3);
      material.color.copy(tools.white).lerp(tools.plankton, night);
    });
    // Plankton: additive dots that fade behind whatever stirred them.
    if (glow.current) {
      glow.current.visible = night > 0.03;
      if (glow.current.visible) {
        s.glow.forEach((dot, i) => {
          const age = (t - dot.born) / GLOW_SECONDS,
            fade = age < 0 || age > 1 ? 0 : (1 - age) ** 2;
          tools.matrix.compose(
            tools.position.set(dot.x, SURFACE, dot.z),
            tools.flat,
            tools.scale.setScalar(dot.size * (0.45 + age * 0.6) * (fade ? 1 : 0)),
          );
          glow.current!.setMatrixAt(i, tools.matrix);
          glow.current!.setColorAt(i, tools.color.copy(tools.plankton).multiplyScalar(fade * night * 0.75));
        });
        glow.current.instanceMatrix.needsUpdate = true;
        if (glow.current.instanceColor) glow.current.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <group name="open-sea">
      <group ref={podGroup} name="dolphin-pods">
        {pods.map((_, i) => (
          <Dolphin key={i} />
        ))}
      </group>
      <group ref={escortGroup} name="bow-riders">
        <Dolphin />
        <Dolphin />
      </group>
      <group ref={schoolGroup} name="roaming-schools">
        {Array.from({ length: ROAMING_SCHOOLS }, (_, i) => (
          <group key={i}>
            {Array.from({ length: SCHOOL_FISH }, (_, n) => (
              <mesh
                key={n}
                raycast={ignore}
                geometry={shapes.fish[(n + i) % 3]}
                material={skin}
                position={[((n % 3) - 1) * 0.42, (n % 2) * 0.07, 0.6 - Math.floor(n / 3) * 0.6]}
              />
            ))}
          </group>
        ))}
      </group>
      <group ref={glintGroup} name="school-shimmer">
        {Array.from({ length: ROAMING_SCHOOLS }, (_, i) => (
          <group key={i}>
            {Array.from({ length: GLINTS }, (_, n) => (
              <mesh
                key={n}
                raycast={ignore}
                geometry={glint}
                material={foam}
                rotation={[-Math.PI / 2, 0, n * 0.9]}
                position={[Math.cos(n * 2.4) * (0.4 + (n % 3) * 0.55), 0, Math.sin(n * 2.4) * (0.4 + (n % 3) * 0.55)]}
              />
            ))}
          </group>
        ))}
      </group>
      <group ref={gullGroup} name="gulls">
        {Array.from({ length: ROAMING_SCHOOLS }, (_, i) => (
          <group key={i}>
            {Array.from({ length: GULLS }, (_, g) => (
              <group key={g} scale={1.2}>
                <mesh raycast={ignore} geometry={shapes.gull} material={skin} />
                {shapes.gullWing.map((wing, side) => (
                  <mesh key={side} raycast={ignore} geometry={wing} material={skin} />
                ))}
              </group>
            ))}
          </group>
        ))}
      </group>
      <group ref={flyerGroup} name="flying-fish">
        {Array.from({ length: FLYING_SHOALS * FLYERS }, (_, i) => (
          <mesh key={i} raycast={ignore} geometry={shapes.flyer} material={skin} />
        ))}
      </group>
      <group ref={whaleGroup} name="whales">
        {Array.from({ length: WHALES }, (_, i) => (
          <group key={i} scale={i ? 0.85 : 1}>
            <mesh raycast={ignore} geometry={shapes.whale} material={skin} />
            <mesh raycast={ignore} geometry={shapes.whaleFlukes} material={skin} position={[0, 0.05, -4.7]} />
            {shapes.whaleFlipper.map((flipper, side) => (
              <mesh
                key={side}
                raycast={ignore}
                geometry={flipper}
                material={skin}
                position={[side ? 0.8 : -0.8, -0.5, 1.4]}
              />
            ))}
            {Array.from({ length: PUFFS }, (_, n) => (
              <mesh key={n} raycast={ignore} visible={false}>
                <sphereGeometry args={[1, 7, 5]} />
                <meshBasicMaterial color="#f4fbff" transparent opacity={0} depthWrite={false} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      <group ref={dropGroup} name="breach-spray">
        {Array.from({ length: WHALES }, (_, i) => (
          <group key={i} visible={false}>
            {Array.from({ length: DROPS }, (_, n) => (
              <mesh key={n} raycast={ignore} geometry={droplet} material={foam} />
            ))}
          </group>
        ))}
      </group>
      <group ref={shark} name="shark" scale={1.3}>
        <mesh raycast={ignore} geometry={shapes.shark} material={skin} />
      </group>
      <group ref={turtle} name="strait-turtle">
        <Turtle />
      </group>
      <group ref={jellyGroup} name="jellyfish">
        {Array.from({ length: JELLYFISH }, (_, i) => (
          <mesh key={i} raycast={ignore} geometry={shapes.jelly} material={jellySkin} />
        ))}
      </group>
      <group ref={ringGroup} name="splash-rings">
        {Array.from({ length: RINGS }, (_, i) => (
          <mesh key={i} raycast={ignore} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[0.8, 1, 24]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <instancedMesh
        ref={glow}
        name="plankton"
        args={[undefined, undefined, GLOW]}
        raycast={ignore}
        frustumCulled={false}
      >
        <circleGeometry args={[1, 10]} />
        <meshBasicMaterial
          map={tools.soft}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
