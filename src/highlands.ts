import { shorePoint, WALK_INSET } from './shoreline.ts';

// The Highlands: a wild second island north of the office, reached by a rope bridge (or the water taxi).
// A mountain with a summit lookout, a lake in a birch grove, a creek down from a waterfall pool, a gorge,
// pine forest and three marked trails. Everything here is plain data and maths so the scene, walking,
// pathfinding and tests all agree on where the ground is.
type Point = [number, number];

// ---- Shape ----
export const HIGHLANDS = { x: 8, z: -88, base: 27, xScale: 1.3 };
export const highlandsRadius = (a: number) =>
  HIGHLANDS.base * (1 + 0.1 * Math.sin(3 * a + 0.7) + 0.06 * Math.sin(5 * a + 2));
// Distance outside the coast (negative inland), in the same squashed units as the main island's shoreDistance.
export function highlandsDistance(x: number, z: number) {
  const qx = (x - HIGHLANDS.x) / HIGHLANDS.xScale,
    qz = z - HIGHLANDS.z;
  return Math.hypot(qx, qz) - highlandsRadius(Math.atan2(qz, qx));
}
export function highlandsPoint(a: number, offset = 0): Point {
  const r = highlandsRadius(a) + offset;
  return [HIGHLANDS.x + Math.cos(a) * r * HIGHLANDS.xScale, HIGHLANDS.z + Math.sin(a) * r];
}
// Anything north of this line belongs to the Highlands (the office island ends around z = -49).
export const HIGHLANDS_SPLIT = -56;
export const HIGHLANDS_OVERVIEW: [number, number, number] = [HIGHLANDS.x + 3, 0, HIGHLANDS.z - 4];
export const inHighlands = (_x: number, z: number) => z < HIGHLANDS_SPLIT;
// For the ocean shader: the same coast as highlandsDistance.
export const highlandsGLSL = `
    float highlandsDistance(vec2 p) {
        vec2 q = vec2((p.x - ${HIGHLANDS.x.toFixed(2)}) / ${HIGHLANDS.xScale.toFixed(2)}, p.y - (${HIGHLANDS.z.toFixed(2)}));
        float a = atan(q.y, q.x);
        return length(q) - ${HIGHLANDS.base.toFixed(2)} * (1.0 + 0.1 * sin(3.0 * a + 0.7) + 0.06 * sin(5.0 * a + 2.0));
    }
`;

// ---- Landmarks ----
export const PEAK = { x: 17, z: -99, h: 17, spread: 7.2 };
const SHOULDER = { x: 27, z: -105, h: 6, spread: 5 };
export const LAKE = { x: -3, z: -82, rx: 6, rz: 4.5, level: 0.45, bed: -0.05 };
export const POOL = { x: 6, z: -90.5, r: 2.1, level: 2.05, bed: 1.55 };
// The waterfall drops from a rock ledge on the uphill side of the pool.
// The waterfall cascades down the steep rim between the mountainside and the pool: from `top` to
// `foot` (on the pool's edge), facing the pool.
export const FALLS = (() => {
  const dx = PEAK.x - POOL.x,
    dz = PEAK.z - POOL.z,
    l = Math.hypot(dx, dz);
  const foot: Point = [POOL.x + (dx / l) * (POOL.r - 0.1), POOL.z + (dz / l) * (POOL.r - 0.1)],
    top: Point = [POOL.x + (dx / l) * 3.9, POOL.z + (dz / l) * 3.9];
  return { foot, top, facing: Math.atan2(-dx, -dz) };
})();
export const CREEK: Point[] = [
  [POOL.x - 1.5, POOL.z + 1.4],
  [2.6, -87],
  [1.2, -85.3],
  [LAKE.x + LAKE.rx - 0.4, -83.2],
];
export const GORGE: Point[] = [
  [20, -80],
  [26, -79],
  [32, -80.5],
  [37, -79.5],
];
export const LANDING: Point = [8, -67.6];
export const RANGER_HUT = { x: 3.4, z: -68.6, w: 3, d: 2.2 };
export const TRAIL_BOARD: Point = [11.8, -68.6];
export const CAMPSITE = { x: -12, z: -97, fire: [-12, -97] as Point };
// A timber jetty on the west coast where the water taxi ties up.
export const WEST_JETTY = { x0: -21.2, x1: -29.6, z: -79.6 };
export const TENTS: { x: number; z: number; angle: number; color: string }[] = [
  { x: -14.8, z: -99.6, angle: 0.6, color: '#e2785b' },
  { x: -9.4, z: -100, angle: -0.5, color: '#4f9fb7' },
];

// ---- Terrain height ----
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = clamp01(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
export const polylineDistance = (p: Point, line: Point[]) =>
  line.slice(1).reduce((best, q, i) => Math.min(best, segmentDistance(p, line[i], q)), Infinity);
const bump = (x: number, z: number, b: { x: number; z: number; h: number; spread: number }) =>
  b.h * Math.exp(-((x - b.x) ** 2 + (z - b.z) ** 2) / (2 * b.spread ** 2));

// Natural ground, before trails are cut into it.
export function naturalHeight(x: number, z: number) {
  const inland = -highlandsDistance(x, z);
  // Under the sea the seabed shelves away; the beach is flat; inland it rises gently into hills.
  if (inland < 0) return Math.max(-3.4, -0.1 + inland * 0.55);
  const rise = smoothstep(WALK_INSET - 0.4, WALK_INSET + 7, inland);
  const hills = (0.5 * Math.sin(x * 0.31 + 1.3) * Math.sin(z * 0.27 + 0.4) + 0.22 * Math.sin(x * 0.7 - z * 0.5)) * rise;
  let h = -0.1 + rise * 1.1 + hills + (bump(x, z, PEAK) + bump(x, z, SHOULDER)) * rise;
  // Lake basin, the waterfall pool, the creek channel and the gorge.
  const lake = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
  if (lake < 1.7) h = LAKE.bed + (h - LAKE.bed) * smoothstep(0.75, 1.7, lake);
  const pool = Math.hypot(x - POOL.x, z - POOL.z);
  if (pool < POOL.r + 1.6) h = POOL.bed + (h - POOL.bed) * smoothstep(POOL.r * 0.75, POOL.r + 1.6, pool);
  h -= 0.5 * Math.exp(-((polylineDistance([x, z], CREEK) / 0.85) ** 2));
  h -= 2.8 * Math.exp(-((polylineDistance([x, z], GORGE) / 1.5) ** 2));
  return h;
}
// Mountain trails are cut into the slope like real ones: a smoothed height profile along the path,
// with the ground easing into it a couple of units either side.
// Trail segments are kept in a coarse grid so "how far to the nearest trail" stays cheap.
type Segment = { trail: number; a: Point; b: Point; ha: number; hb: number };
const CELL = 3,
  REACH = 2.6;
let segmentGrid: Map<string, Segment[]> | null = null;
function trailSegments() {
  if (segmentGrid) return segmentGrid;
  segmentGrid = new Map();
  TRAILS.forEach((trail, index) => {
    // Lake Loop is flat enough as it is; the mountain trails get a smoothed (graded) profile.
    let heights = trail.points.map(p => naturalHeight(...p));
    const onDeck = trail.points.map(p => !!deckAt(...p));
    // Only the climb is graded; the low ground (and where trails meet at the hub) keeps its natural shape.
    const fixed = heights.map((h, i) => onDeck[i] || h < 2.5);
    if (trail.id !== 'lake')
      for (let pass = 0; pass < 6; pass++)
        heights = heights.map((h, i) => {
          if (fixed[i]) return h;
          const near = heights.slice(Math.max(0, i - 4), i + 5);
          return near.reduce((sum, v) => sum + v, 0) / near.length;
        });
    for (let i = 1; i < trail.points.length; i++) {
      const a = trail.points[i - 1],
        b = trail.points[i],
        graded = trail.id !== 'lake' && !onDeck[i - 1] && !onDeck[i] && !(fixed[i - 1] && fixed[i]);
      const seg: Segment = { trail: index, a, b, ha: graded ? heights[i - 1] : NaN, hb: graded ? heights[i] : NaN };
      for (
        let cx = Math.floor((Math.min(a[0], b[0]) - REACH) / CELL);
        cx <= Math.floor((Math.max(a[0], b[0]) + REACH) / CELL);
        cx++
      )
        for (
          let cz = Math.floor((Math.min(a[1], b[1]) - REACH) / CELL);
          cz <= Math.floor((Math.max(a[1], b[1]) + REACH) / CELL);
          cz++
        ) {
          const key = `${cx},${cz}`;
          const list = segmentGrid!.get(key);
          if (list) list.push(seg);
          else segmentGrid!.set(key, [seg]);
        }
    }
  });
  return segmentGrid;
}
// Nearest trail within REACH: distance, and the graded height there (NaN when it isn't graded).
function nearestTrail(x: number, z: number) {
  let best = Infinity,
    height = NaN;
  for (const seg of trailSegments().get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
    const { a, b } = seg,
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = clamp01(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1));
    const d = Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
    if (d < best) {
      best = d;
      height = seg.ha + (seg.hb - seg.ha) * t;
    }
  }
  return { distance: best, height };
}
export function terrainHeight(x: number, z: number) {
  const h = naturalHeight(x, z);
  if (highlandsDistance(x, z) > -WALK_INSET) return h;
  const near = nearestTrail(x, z);
  if (near.distance > REACH || Number.isNaN(near.height)) return h;
  return h + (near.height - h) * (1 - smoothstep(1.1, REACH, near.distance));
}

// ---- Bridges and decks (walk above the terrain or water) ----
// From `a` to `b`, `width` across; deck height eases from ya to yb with a rope-bridge sag in the middle.
// `ramp` is the length of the stair at each end, from the ground up to the deck.
export type Deck = {
  id: string;
  a: Point;
  b: Point;
  width: number;
  ya: number;
  yb: number;
  sag: number;
  ramp?: number;
  ground?: [number, number];
  kind: 'rope' | 'timber';
};
// The rope bridge over the strait is high enough for boats (and the sailboat's mast) to pass under.
export const BRIDGE_HEIGHT = 4.6;
const MAIN_SIDE: Point = [8, -45.6];
export const DECKS: Deck[] = [
  {
    id: 'strait',
    a: MAIN_SIDE,
    b: LANDING,
    width: 1.4,
    ya: BRIDGE_HEIGHT,
    yb: BRIDGE_HEIGHT,
    sag: 0.7,
    ramp: 4.2,
    ground: [0, naturalHeight(...LANDING)],
    kind: 'rope',
  },
  {
    id: 'gorge',
    a: [27.6, -76.4],
    b: [27.2, -82.8],
    width: 1.2,
    ya: naturalHeight(27.6, -76.4) + 0.15,
    yb: naturalHeight(27.2, -82.8) + 0.15,
    sag: 0.45,
    kind: 'rope',
  },
  {
    id: 'west-jetty',
    a: [WEST_JETTY.x0, WEST_JETTY.z],
    b: [WEST_JETTY.x1, WEST_JETTY.z],
    width: 1.6,
    ya: Math.max(0.12, naturalHeight(WEST_JETTY.x0, WEST_JETTY.z) + 0.12),
    yb: 0.15,
    sag: 0,
    kind: 'timber',
  },
  {
    id: 'lake-jetty',
    a: [LAKE.x, LAKE.z + LAKE.rz + 0.9],
    b: [LAKE.x, LAKE.z + LAKE.rz - 3],
    width: 1.3,
    ya: naturalHeight(LAKE.x, LAKE.z + LAKE.rz + 0.9) + 0.12,
    yb: LAKE.level + 0.32,
    sag: 0,
    kind: 'timber',
  },
];
function onDeck(deck: Deck, x: number, z: number) {
  const dx = deck.b[0] - deck.a[0],
    dz = deck.b[1] - deck.a[1],
    length = Math.hypot(dx, dz);
  const t = ((x - deck.a[0]) * dx + (z - deck.a[1]) * dz) / (length * length);
  if (t < 0 || t > 1) return null;
  const side = Math.abs((x - deck.a[0]) * dz - (z - deck.a[1]) * dx) / length;
  return side < deck.width / 2 ? { t, along: t * length, length } : null;
}
export function deckHeight(deck: Deck, t: number) {
  const length = Math.hypot(deck.b[0] - deck.a[0], deck.b[1] - deck.a[1]),
    along = t * length,
    ramp = deck.ramp ?? 0;
  // Stairs up from the ground at each end, then the span between them with its sag.
  if (ramp && along < ramp) return deck.ground![0] + (deck.ya - deck.ground![0]) * smoothstep(0, ramp, along);
  if (ramp && along > length - ramp)
    return deck.ground![1] + (deck.yb - deck.ground![1]) * smoothstep(0, ramp, length - along);
  const s = ramp ? clamp01((along - ramp) / (length - 2 * ramp)) : t;
  return deck.ya + (deck.yb - deck.ya) * s - deck.sag * Math.sin(Math.PI * s);
}
export function deckAt(x: number, z: number) {
  for (const deck of DECKS) {
    const on = onDeck(deck, x, z);
    if (on) return { deck, height: deckHeight(deck, on.t) };
  }
  return null;
}

// ---- Trails ----
export type Trail = {
  id: 'lake' | 'falls' | 'summit';
  name: string;
  level: 'Easy' | 'Moderate' | 'Hard';
  color: string;
  icon: string;
  points: Point[];
};
export const HUB: Point = [LANDING[0], LANDING[1] - 1.6];
// Smooth a coarse route into points about every 0.8 units (Catmull-Rom through the corners).
function smoothRoute(route: Point[], closed = false): Point[] {
  const pts = closed ? [...route, route[0]] : route,
    out: Point[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)] ?? pts[i],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[Math.min(pts.length - 1, i + 2)];
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.8));
    for (let s = 0; s < steps; s++) {
      const t = s / steps,
        t2 = t * t,
        t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const lakeRing = Array.from({ length: 14 }, (_, i) => {
  const a = Math.PI / 2 + (i / 14) * Math.PI * 2;
  return [LAKE.x + Math.cos(a) * (LAKE.rx + 2.7), LAKE.z + Math.sin(a) * (LAKE.rz + 2.7)] as Point;
});
// Summit Ridge zigzags up the mountain's south face in switchbacks, so the climb stays gentle.
export const SUMMIT: Point = [PEAK.x, PEAK.z + 0.6];
const switchbacks: Point[] = [[22, -86.5], [12, -87.6], [21, -91], [13, -92.2], [20, -94.6], [14.4, -96.2], SUMMIT];
export const TRAILS: Trail[] = [
  {
    id: 'lake',
    name: 'Lakeside Loop',
    level: 'Easy',
    color: '#5aa469',
    icon: '🟢',
    points: smoothRoute([HUB, [3, -72], [-1, -74.6], ...lakeRing, [-1, -74.6], [3, -72], HUB]),
  },
  {
    id: 'falls',
    name: 'Waterfall Trail',
    level: 'Moderate',
    color: '#3f86c7',
    icon: '🔵',
    points: smoothRoute([
      HUB,
      [10.5, -72.5],
      [9.5, -77],
      [6.5, -81],
      [3.4, -84.6],
      [2.2, -88.4],
      [3.3, -91.4],
      [4.6, -93.6],
      [6, -94.6],
    ]),
  },
  {
    id: 'summit',
    name: 'Summit Ridge',
    level: 'Hard',
    color: '#3b3b3b',
    icon: '⚫',
    points: smoothRoute([HUB, [15, -71], [22, -73], [27.6, -74.6], [27.6, -76.4], [27.2, -82.8], ...switchbacks]),
  },
];
export const trailById = (id: Trail['id']) => TRAILS.find(t => t.id === id)!;
export const nearTrail = (x: number, z: number, within = 1.15) =>
  within <= REACH
    ? nearestTrail(x, z).distance < within
    : TRAILS.some(t => polylineDistance([x, z], t.points) < within);
// Checkpoints you pass to complete a trail (every few points, plus the end).
export const checkpoints = (trail: Trail) =>
  trail.points.filter((_, i) => i % 12 === 6 || i === trail.points.length - 1);
// A cave opens in the rock beside the waterfall (the Waterfall Trail ends at its mouth),
// and a bench looks out from a switchback corner on the way to the summit.
export const CAVE = { x: 6.4, z: -95.6, facing: Math.atan2(4.6 - 6.4, -93.6 + 95.6) };
export const RIDGE_VIEW: Point = [22.7, -90.4];

// ---- Walking ----
const gradedSlope = (x: number, z: number) => {
  const e = 0.3;
  return (
    Math.hypot(terrainHeight(x + e, z) - terrainHeight(x - e, z), terrainHeight(x, z + e) - terrainHeight(x, z - e)) /
    (2 * e)
  );
};
// Off the trails, steepness is judged on the natural ground (the graded trail benches don't open shortcuts).
const slope = (x: number, z: number) => {
  const e = 0.35;
  return (
    Math.hypot(naturalHeight(x + e, z) - naturalHeight(x - e, z), naturalHeight(x, z + e) - naturalHeight(x, z - e)) /
    (2 * e)
  );
};
export const inLake = (x: number, z: number) => Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz) < 1.08;
export const inPool = (x: number, z: number) => Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 0.35;
export const inCreek = (x: number, z: number) => polylineDistance([x, z], CREEK) < 0.6;
// Ground rules on the Highlands (props and trees are checked by the caller).
export function highlandsWalkable(x: number, z: number) {
  if (deckAt(x, z)) return true;
  if (highlandsDistance(x, z) > -WALK_INSET) return false;
  if (inLake(x, z) || inPool(x, z)) return false;
  // Trails cross the creek on stepping stones and climb where the slope is too steep to wander.
  // (Only along the cut path itself: stepping down between switchbacks is too steep.)
  if (nearTrail(x, z)) return polylineDistance([x, z], GORGE) > 1.6 && gradedSlope(x, z) < 2;
  if (inCreek(x, z) || polylineDistance([x, z], GORGE) < 2.2) return false;
  return slope(x, z) < 0.55;
}
// Height of whatever you're standing on, anywhere in the world (the office island is flat).
export function groundHeight(x: number, z: number) {
  const deck = deckAt(x, z);
  if (deck) return deck.height;
  return inHighlands(x, z) ? Math.max(0, terrainHeight(x, z)) : 0;
}

// ---- Forest ----
// Deterministic scatter so the forest is the same for everyone (and trees never move).
function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const VIEW_FROM: Point = [0.5, 0.86];
const viewLines: [Point, Point][] = [FALLS.foot, FALLS.top, [CAVE.x, CAVE.z] as Point].map(p => [
  p,
  [p[0] + VIEW_FROM[0] * 11, p[1] + VIEW_FROM[1] * 11],
]);
export type Tree = { x: number; z: number; kind: 'pine' | 'birch' | 'palm'; scale: number; turn: number };
export const FOREST: Tree[] = (() => {
  const rand = random(20261116),
    trees: Tree[] = [],
    taken = new Map<string, Point[]>();
  const key = (x: number, z: number) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
  const clear = (x: number, z: number, gap: number) => {
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const [tx, tz] of taken.get(key(x + i * 2, z + j * 2)) ?? [])
          if (Math.hypot(tx - x, tz - z) < gap) return false;
    return true;
  };
  const keepOut: Point[] = [
    LANDING,
    [RANGER_HUT.x, RANGER_HUT.z],
    TRAIL_BOARD,
    CAMPSITE.fire,
    SUMMIT,
    [CAVE.x, CAVE.z],
    RIDGE_VIEW,
  ];
  for (let i = 0; i < 9000 && trees.length < 420; i++) {
    const x = HIGHLANDS.x + (rand() * 2 - 1) * 42,
      z = HIGHLANDS.z + (rand() * 2 - 1) * 34,
      inland = -highlandsDistance(x, z);
    if (inland < WALK_INSET + 0.6) continue;
    if (inLake(x, z) || Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz) < 1.3) continue;
    if (Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 2.4 || polylineDistance([x, z], CREEK) < 1.3) continue;
    if (
      polylineDistance([x, z], GORGE) < 2.6 ||
      nearTrail(x, z, 2) ||
      DECKS.some(d => segmentDistance([x, z], d.a, d.b) < 2.2)
    )
      continue;
    if (keepOut.some(p => Math.hypot(p[0] - x, p[1] - z) < 4.5)) continue;
    if (Math.hypot(x - CAMPSITE.x, z - CAMPSITE.z) < 6.5 || Math.hypot(x - PEAK.x, z - PEAK.z) < 3) continue;
    // Keep a clear line of sight from the usual camera angle (south-east, above) to the falls and the cave.
    if (viewLines.some(([a, b]) => segmentDistance([x, z], a, b) < 2.8)) continue;
    // Birches round the lake, palms near the beach, pines everywhere else (thinning near the top).
    const lakeRing = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
    const h = terrainHeight(x, z);
    const kind: Tree['kind'] = inland < WALK_INSET + 3.5 ? 'palm' : lakeRing < 2.8 ? 'birch' : 'pine';
    if (kind === 'pine' && h > 13 && rand() < 0.7) continue;
    const gap = kind === 'palm' ? 3.2 : kind === 'birch' ? 2.2 : 1.9;
    if (!clear(x, z, gap)) continue;
    trees.push({ x, z, kind, scale: 0.8 + rand() * 0.45, turn: rand() * Math.PI * 2 });
    const k = key(x, z);
    taken.set(k, [...(taken.get(k) ?? []), [x, z]]);
  }
  return trees;
})();
// Trees block walking: a little spatial index keeps that check fast.
const treeIndex = new Map<string, Tree[]>();
for (const t of FOREST) {
  const k = `${Math.floor(t.x / 2)},${Math.floor(t.z / 2)}`;
  treeIndex.set(k, [...(treeIndex.get(k) ?? []), t]);
}
export function treeAt(x: number, z: number) {
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (const t of treeIndex.get(`${Math.floor(x / 2) + i},${Math.floor(z / 2) + j}`) ?? [])
        if (Math.hypot(t.x - x, t.z - z) < (t.kind === 'palm' ? 0.55 : 0.5) * t.scale) return true;
  return false;
}

// ---- Where things go on the office island ----
// The bridge leaves from the north shore, next to the games lawn.
export const BRIDGE_FOOT = MAIN_SIDE;
export const MAIN_NORTH_SHORE = shorePoint(-Math.PI / 2);
