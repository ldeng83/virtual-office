import { ISLAND_CENTER_Z, ISLAND_X_SCALE, shoreDistance, shorePoint } from './shoreline.ts';
import { HIGHLANDS, highlandsDistance, highlandsPoint, WEST_JETTY } from './highlands.ts';
import { wreck } from './dive.ts';
import { bluff, jetty, marina, reef, type Point } from './world.ts';

// Where the boats go. Each boat has a few named trips and picks one when you board, so a ride isn't
// the same every time; if a whale or a pod of dolphins is within reach, the trip bends out to pass it.
// A trip is a closed course: a line of points from just off the launch, round and back again, which
// the boat follows at a steady speed.
export type BoatKind = 'kayak' | 'jetski' | 'sailboat' | 'parasail';
export type Course = { points: Point[]; lengths: number[]; total: number };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export const coastAngle = (p: Point) => Math.atan2(p[1] - ISLAND_CENTER_Z, p[0] / ISLAND_X_SCALE);

// Routes along the coast swing wide round the docks and the bluff instead of sailing through them.
const obstacles = [
  { angle: coastAngle([marina.x, marina.z1]), width: 0.16, push: 6 },
  { angle: coastAngle([jetty.x0, jetty.z]), width: 0.2, push: 6.5 },
  { angle: coastAngle([bluff.x, bluff.z]), width: 0.12, push: 2.5 },
];
const swingWide = (a: number) =>
  obstacles.reduce((sum, o) => sum + o.push * Math.exp(-((wrap(a - o.angle) / o.width) ** 2)), 0);
// A point `offset` off the office island's coast at angle `a`, and the same for the Highlands.
const coast = (a: number, offset: number) => shorePoint(a, offset + swingWide(a));
const hill = highlandsPoint;
const range = (from: number, to: number, step: number): number[] => {
  const count = Math.max(2, Math.ceil(Math.abs(to - from) / step) + 1);
  return Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));
};

// The docks boats must keep off: the fishing jetty, the water sports dock and the Highlands' jetty.
const DOCKS: [Point, Point][] = [
  [
    [jetty.x0 - 0.5, jetty.z],
    [jetty.x1, jetty.z],
  ],
  [
    [marina.x, marina.z0],
    [marina.x, marina.z1 + 2],
  ],
  [
    [WEST_JETTY.x1 - 2, WEST_JETTY.z],
    [WEST_JETTY.x0, WEST_JETTY.z],
  ],
];
const nearestOn = (p: Point, [a, b]: [Point, Point]): Point => {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = clamp01(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1));
  return [a[0] + dx * t, a[1] + dz * t];
};
// Nudge a point out of the shallows and away from the docks. In the strait the two coasts push
// against each other and the point settles between them.
function clear(p: Point, land: number, dock: number): Point {
  let [x, z] = p;
  for (let pass = 0; pass < 14; pass++) {
    let moved = false;
    const push = (fromX: number, fromZ: number, by: number) => {
      const d = Math.hypot(x - fromX, z - fromZ) || 1;
      x += ((x - fromX) / d) * by;
      z += ((z - fromZ) / d) * by;
      moved = true;
    };
    const main = shoreDistance(x, z),
      high = highlandsDistance(x, z);
    if (main < land) push(0, ISLAND_CENTER_Z, (land - main) * 0.6 + 0.05);
    if (high < land) push(HIGHLANDS.x, HIGHLANDS.z, (land - high) * 0.6 + 0.05);
    for (const segment of DOCKS) {
      const [nx, nz] = nearestOn([x, z], segment),
        d = Math.hypot(x - nx, z - nz);
      if (d < dock) push(nx, nz, (dock - d) * 0.6 + 0.05);
    }
    if (!moved) break;
  }
  return [x, z];
}

const catmull = (a: number, b: number, c: number, d: number, t: number) =>
  0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
function measure(points: Point[]): Course {
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return { points, lengths, total: lengths[lengths.length - 1] };
}
// A smooth closed course through the given points (first and last are the same spot off the launch),
// kept clear of land and docks, with its points evenly spaced.
function build(control: Point[], land: number, soft: number, dock = 4): Course {
  const n = control.length - 1,
    at = (i: number) => control[((i % n) + n) % n],
    dense: Point[] = [];
  for (let i = 0; i < n; i++)
    for (let step = 0; step < 6; step++) {
      const t = step / 6,
        [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      dense.push([catmull(a[0], b[0], c[0], d[0], t), catmull(a[1], b[1], c[1], d[1], t)]);
    }
  dense.push(dense[0]);
  return tidy(dense, land, dock, soft);
}
function tidy(points: Point[], land: number, dock: number, soft: number): Course {
  // Even out the spacing, clear the land, then round off the corners: the faster the boat, the wider its turns.
  const rough = measure(points),
    count = Math.max(40, Math.round(rough.total / 1.2));
  let even = Array.from({ length: count + 1 }, (_, i) => clear(pointAt(rough, (i / count) * rough.total), land, dock));
  for (let pass = 0; pass < soft; pass++)
    even = even.map((p, i): Point => {
      if (i === 0 || i === count) return p;
      const a = even[i - 1],
        b = even[i + 1];
      return clear([(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4], land, dock);
    });
  return measure(even);
}
function pointAt(course: Course, distance: number): Point {
  const { points, lengths } = course,
    goal = Math.max(0, Math.min(course.total, distance));
  let low = 1,
    high = lengths.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (lengths[mid] < goal) low = mid + 1;
    else high = mid;
  }
  const span = lengths[low] - lengths[low - 1],
    f = span ? (goal - lengths[low - 1]) / span : 0;
  return [
    points[low - 1][0] + (points[low][0] - points[low - 1][0]) * f,
    points[low - 1][1] + (points[low][1] - points[low - 1][1]) * f,
  ];
}

// ---- The trips ----
// A full lap of the office island, `turn` = 1 with the angle (anticlockwise on the map), -1 against.
const lap = (launch: Point, turn: number, offset: (a: number) => number) =>
  range(0, Math.PI * 2, 0.09).map(da => {
    const a = coastAngle(launch) + da * turn;
    return coast(a, offset(a));
  });
// An out-and-back oval along the coast: out wide, back closer in (or the other way for `wide` < 0).
const alongCoast = (launch: Point, sweep: number, mid: number, wide: number) =>
  range(0, Math.PI * 2, 0.16).map(u => {
    const a = coastAngle(launch) + (sweep / 2) * (1 - Math.cos(u));
    return coast(a, mid + wide * Math.sin(u));
  });
// A loop straight out to sea and back, starting and ending close in.
const outToSea = (launch: Point, near: number, far: number, spread: number) =>
  range(0, Math.PI * 2, 0.2).map(u => {
    const a = coastAngle(launch) + spread * Math.sin(u);
    return coast(a, near + ((far - near) / 2) * (1 - Math.cos(u)));
  });
// A loop out over the reef and round the wreck, starting from the end nearest the jetty.
function roundTheDiveSites(near: number, far: number, across: number): Point[] {
  const mx = (reef.x + wreck.x) / 2,
    mz = (reef.z + wreck.z) / 2,
    dx = wreck.x - reef.x,
    dz = wreck.z - reef.z,
    d = Math.hypot(dx, dz),
    half = (d + near + far) / 2;
  return range(0, Math.PI * 2, 0.3).map((u): Point => {
    const forward = (far - near) / 2 - Math.cos(u) * half,
      side = Math.sin(u) * across;
    return [mx + (dx / d) * forward - (dz / d) * side, mz + (dz / d) * forward + (dx / d) * side];
  });
}
const closed = (gate: Point, ...parts: Point[][]): Point[] => [gate, ...parts.flat(), gate];

// ---- Voyages ----
// Trips out to a named part of the open sea and home again, so between them the boats cover all
// of it. The sea is the box in open-sea.ts; boats keep a little inside its edge.
const SEA = { minX: -94, maxX: 99, minZ: -139, maxZ: 66 };
const landClear = (x: number, z: number) => Math.min(shoreDistance(x, z), highlandsDistance(x, z));
// A ring of open water round both islands, for getting to the far side of them.
const RING = (() => {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const a of range(0, Math.PI * 2, 0.05))
    for (const [x, z] of [shorePoint(a, 0), highlandsPoint(a, 0)]) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, rx: ((maxX - minX) / 2) * 1.5, rz: ((maxZ - minZ) / 2) * 1.2 };
})();
const ringAngle = ([x, z]: Point) => Math.atan2((z - RING.z) / RING.rz, (x - RING.x) / RING.rx);
const ringPoint = (angle: number, lane: number): Point => [
  Math.max(SEA.minX, Math.min(SEA.maxX, RING.x + Math.cos(angle) * (RING.rx + lane))),
  Math.max(SEA.minZ, Math.min(SEA.maxZ, RING.z + Math.sin(angle) * (RING.rz + lane))),
];
// Can a boat go straight from one point to the other without running into land?
function openWater(a: Point, b: Point, margin: number) {
  const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
  for (let i = 0; i <= steps; i++)
    if (landClear(a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps) < margin) return false;
  return true;
}
// What the boat does when it gets there. Each is a list of [ahead, across] steps, in turn-widths,
// entered from the left of the way in and left on the right.
export const PATTERNS = ['loop', 'eight', 'zigzag', 'spiral', 'triangle', 'clover', 'sweep'] as const;
export type Pattern = (typeof PATTERNS)[number];
const SHAPES: Record<Pattern, () => Point[]> = {
  // Once round.
  loop: () => range(-2.2, 2.2, 0.55).map(u => [Math.cos(u), Math.sin(u)]),
  // A figure of eight, one lobe beyond the other.
  eight: () => range(0.25, Math.PI * 2 - 0.25, 0.4).map(u => [1.3 * (1 - Math.cos(u)), -1.15 * Math.sin(2 * u)]),
  // (The weave is on the way out; at the far end it's a plain turn.)
  zigzag: () => range(-2.2, 2.2, 0.55).map(u => [Math.cos(u), Math.sin(u)]),
  // Winding in to the middle and out again.
  spiral: () =>
    range(0, 1, 0.045).map(u => {
      const angle = -2.2 + u * (4.4 + Math.PI * 2),
        r = 1.7 - 1.15 * Math.sin(Math.PI * u);
      return [r * Math.cos(angle), r * Math.sin(angle)];
    }),
  // Three marks to round, like a regatta course.
  triangle: () => [
    [-0.3, -2],
    [1.1, -1.1],
    [2.5, 0],
    [1.1, 1.1],
    [-0.3, 2],
  ],
  // Three leaves.
  clover: () =>
    range(-2.4, 2.4, 0.2).map(u => {
      const r = 1.15 + 0.95 * Math.cos(3 * u);
      return [r * Math.cos(u), r * Math.sin(u)];
    }),
  // One long, wide sweep across it.
  sweep: () => [
    [-0.7, -2.8],
    [0.5, -1.5],
    [1, 0],
    [0.5, 1.5],
    [-0.7, 2.8],
  ],
};
const inSea = ([x, z]: Point): Point => [
  Math.max(SEA.minX, Math.min(SEA.maxX, x)),
  Math.max(SEA.minZ, Math.min(SEA.maxZ, z)),
];
// Slide a pattern back inside the sea, whole, rather than flattening it against the edge.
function fitInSea(points: Point[]): Point[] {
  const xs = points.map(p => p[0]),
    zs = points.map(p => p[1]),
    slide = (low: number, high: number, min: number, max: number) =>
      low < min ? min - low : high > max ? max - high : 0,
    dx = slide(Math.min(...xs), Math.max(...xs), SEA.minX, SEA.maxX),
    dz = slide(Math.min(...zs), Math.max(...zs), SEA.minZ, SEA.maxZ);
  return points.map(([x, z]) => inSea([x + dx, z + dz]));
}
// Out to `target`, a pattern there, and home: straight out if the way is clear, otherwise round
// the islands on the ring (out on one lane, back on another, so the wakes don't cross).
// `circuit` carries on round both islands instead of turning back.
function voyage(
  launch: Point,
  target: Point,
  near: number,
  turn: number,
  pattern: Pattern = 'loop',
  circuit = false,
): Point[] {
  const gate = coast(coastAngle(launch), near),
    from = ringAngle(gate),
    to = ringAngle(target),
    // The short way round to the target's side.
    way = wrap(to - from) >= 0 ? 1 : -1,
    span = Math.abs(wrap(to - from));
  const direct = !circuit && openWater(gate, target, near + 4),
    approach = direct ? Math.atan2(target[1] - gate[1], target[0] - gate[0]) : to + (way * Math.PI) / 2,
    cos = Math.cos(approach),
    sin = Math.sin(approach),
    // A point `ahead` and `across` of `from`, across being to the side the boat turns towards.
    off = (from: Point, ahead: number, across: number): Point => [
      from[0] + ahead * cos - across * way * sin,
      from[1] + ahead * sin + across * way * cos,
    ],
    // A circuit sweeps past the target on its way round instead of doubling back.
    there = circuit
      ? [target]
      : fitInSea(SHAPES[pattern]().map(([ahead, across]) => off(target, ahead * turn, across * turn))),
    weave = pattern === 'zigzag';
  if (direct) {
    // A teardrop: out along one side (weaving, for a zigzag), back along the other.
    const length = Math.hypot(target[0] - gate[0], target[1] - gate[1]),
      wide = length * 0.16,
      along = (f: number, across: number) =>
        inSea(off([gate[0] + (target[0] - gate[0]) * f, gate[1] + (target[1] - gate[1]) * f], 0, across)),
      legs = Math.max(3, Math.round(length / 14)),
      out = weave
        ? range(1, legs - 1, 1).map(i => along(i / legs, -wide * 0.6 + (i % 2 ? -1 : 1) * Math.min(9, wide)))
        : [along(0.5, -wide)];
    return closed(gate, out, there, [along(0.5, wide)]);
  }
  const first = 0.3,
    last = Math.max(0.35, span - 0.25),
    out = range(first, last, weave ? 0.22 : 0.28).map((da, i) => ringPoint(from + way * da, weave && i % 2 ? 16 : 0)),
    back = circuit
      ? range(span + 0.25, Math.PI * 2 - 0.3, 0.28).map(da => ringPoint(from + way * da, 0))
      : range(last, first, 0.28).map(da => ringPoint(from + way * da, weave ? 26 : 9));
  return closed(gate, out, there, back);
}
// Named parts of the sea, spread over all of it.
const WATERS = {
  southBanks: { name: 'the south banks', at: [4, 60] as Point },
  southWest: { name: 'the south-west deep', at: [-72, 52] as Point },
  southEast: { name: 'the south-east shoals', at: [78, 52] as Point },
  farWest: { name: 'the far west', at: [-88, 2] as Point },
  farEast: { name: 'the far east', at: [93, 4] as Point },
  westReach: { name: 'the western reach', at: [-84, -52] as Point },
  eastReach: { name: 'the eastern reach', at: [90, -50] as Point },
  highWest: { name: 'the sea west of the Highlands', at: [-78, -96] as Point },
  highEast: { name: 'the sea east of the Highlands', at: [86, -98] as Point },
  northWest: { name: 'the north-west corner', at: [-80, -130] as Point },
  north: { name: 'the open sea north of the Highlands', at: [8, -133] as Point },
  northEast: { name: 'the north-east corner', at: [86, -130] as Point },
};
type Water = keyof typeof WATERS;
const FLOURISH: Record<Pattern, string> = {
  loop: 'once round and home',
  eight: 'a figure of eight out there, then home',
  zigzag: 'weaving all the way out',
  spiral: 'a spiral in and out when you get there',
  triangle: 'three marks to round out there',
  clover: 'a clover-leaf turn out there',
  sweep: 'one long sweep across it and home',
};
// One voyage to each of `waters`, each with a different pattern (starting from `first`).
const voyages = (
  waters: Water[],
  near: number,
  turn: number,
  land: number,
  first: number,
  doing: (name: string) => string,
  start: (name: string, flourish: string) => string,
  circuits: Water[] = [],
): Trip[] =>
  waters.map((id, i) => {
    const circuit = circuits.includes(id),
      pattern = PATTERNS[(i + first) % PATTERNS.length];
    return {
      doing: doing(WATERS[id].name),
      start: start(WATERS[id].name, circuit ? 'right round both islands' : FLOURISH[pattern]),
      pattern: circuit ? undefined : pattern,
      path: launch => voyage(launch, WATERS[id].at, near, turn, pattern, circuit),
      land,
    };
  });
const EVERYWHERE = Object.keys(WATERS) as Water[];

type Trip = {
  // What the seat message says while you're on it, and the notice when you set off.
  doing: string;
  start: string;
  path: (launch: Point) => Point[];
  land: number;
  // Voyages: the pattern sailed at the far end.
  pattern?: Pattern;
};
const kayakOff = () => 5.5,
  jetskiOff = (a: number) => 11 + 2.2 * Math.sin(a * 9),
  sailOff = (a: number) => 8.5 + 1.2 * Math.sin(a * 3);
export const TRIPS: Record<BoatKind, Trip[]> = {
  kayak: [
    {
      doing: 'Paddling round the island',
      start: '🛶 Paddling the coast, all the way round the island.',
      path: launch => lap(launch, 1, kayakOff),
      land: 3,
    },
    {
      doing: 'Paddling up the strait',
      start: '🛶 Up the strait today: under the rope bridge and back.',
      path: launch => alongCoast(launch, 2.3, 5.6, 2.6),
      land: 2.8,
    },
    {
      doing: 'Paddling out over the reef and the wreck',
      start: '🛶 A short paddle out over the reef and round the wreck buoy.',
      path: () => roundTheDiveSites(2, 12, 14),
      land: 3,
    },
    ...voyages(
      EVERYWHERE,
      5.5,
      7,
      3,
      0,
      name => `Paddling out to ${name}`,
      (name, flourish) => `🛶 A long paddle today, out to ${name}: ${flourish}.`,
    ),
  ],
  jetski: [
    {
      doing: 'Lapping the island on the jet ski',
      start: '🚤 Full throttle! A lap of the island on the jet ski.',
      path: launch => lap(launch, 1, jetskiOff),
      land: 4,
    },
    {
      doing: 'Slaloming up the west coast',
      start: '🚤 A slalom run up the west coast and a fast straight home.',
      path: launch =>
        range(0, Math.PI * 2, 0.1).map(u => {
          const a = coastAngle(launch) + 0.8 * (1 - Math.cos(u));
          return coast(a, 15 + 5 * Math.sin(u) + 3.2 * Math.sin(a * 13) * Math.max(0, Math.sin(u)));
        }),
      land: 4,
    },
    {
      doing: 'Round both islands on the jet ski',
      start: '🚤 The long one: round the Highlands too, through the strait both ways.',
      path: launch => {
        const a0 = coastAngle(launch);
        return closed(
          coast(a0, 11),
          // Up the west coast, east through the strait, anticlockwise round the Highlands…
          range(a0 + 0.3, 4.1, 0.3).map(a => coast(a, 11)),
          [
            [-30, -53.5],
            [-12, -55.5],
            [8, -56],
            [27, -57],
          ],
          range(0.75, -Math.PI, 0.35).map(a => hill(a, 10)),
          [hill(2.82, 17), hill(2.3, 10)],
          // …east through the strait again and home down the east coast.
          [
            [-12, -54.5],
            [8, -54.5],
            [28, -53],
          ],
          range(-0.7, a0 - 0.3, 0.3).map(a => coast(a, 11)),
        );
      },
      land: 3.5,
    },
    ...voyages(
      EVERYWHERE,
      11,
      12,
      4,
      2,
      name => `Racing out to ${name}`,
      (name, flourish) => `🚤 Full throttle for ${name}: ${flourish}.`,
      ['north', 'northWest', 'northEast', 'highEast'],
    ),
  ],
  sailboat: [
    {
      doing: 'Sailing round the island',
      start: '⛵ Sails up. A slow, calm lap of the island.',
      path: launch => lap(launch, -1, sailOff),
      land: 4,
    },
    {
      doing: 'Sailing out to the open sea',
      start: '⛵ Sails up, and out to the open sea today: a long loop south and back.',
      path: launch => outToSea(launch, 9, 40, 0.7),
      land: 4,
    },
    {
      doing: 'Sailing over to the Highlands',
      start: '⛵ Sails up, bound for the Highlands: up the west coast, past their jetty and home.',
      path: launch => {
        const a0 = coastAngle(launch);
        return closed(
          coast(a0, 8.5),
          range(a0 + 0.3, 4.0, 0.3).map(a => coast(a, 9)),
          [hill(2.4, 11), hill(2.82, 18), hill(-2.9, 12), hill(-2.45, 11)],
          [hill(-2.35, 21), hill(-2.95, 25), hill(2.85, 27)],
          range(3.75, a0 + 0.3, 0.3).map(a => coast(a, 18)),
        );
      },
      land: 4,
    },
    ...voyages(
      EVERYWHERE,
      8.5,
      10,
      4,
      4,
      name => `Sailing out to ${name}`,
      (name, flourish) => `⛵ Sails up, bound for ${name}: ${flourish}.`,
      ['north'],
    ),
  ],
  parasail: [
    {
      doing: 'Parasailing up the west coast',
      start: '🪂 Hold on: the boat lifts you up for the best view of the west coast.',
      path: launch => alongCoast(launch, 2.1, 16, 6),
      land: 5,
    },
    {
      doing: 'Parasailing along the east coast',
      start: '🪂 Hold on: up you go, east about today, past the arrival pier.',
      path: launch => alongCoast(launch, -2.1, 16, 6),
      land: 5,
    },
    // The tow boat keeps to wide water; the north is a long haul round the outside of the Highlands.
    ...voyages(
      ['southBanks', 'southWest', 'southEast', 'farWest', 'farEast', 'westReach', 'eastReach', 'north'],
      16,
      12,
      6,
      0,
      name => `Parasailing over ${name}`,
      (name, flourish) => `🪂 Hold on: up you go, out over ${name}: ${flourish}.`,
      ['north'],
    ),
  ],
};
export const BOAT_SPEED: Record<BoatKind, number> = { kayak: 2.6, jetski: 7.2, sailboat: 2.5, parasail: 2.55 };
// How many rounding passes each boat's course gets.
const SOFT: Record<BoatKind, number> = { kayak: 8, jetski: 30, sailboat: 12, parasail: 8 };
const EASE: Record<BoatKind, number> = { kayak: 4, jetski: 4, sailboat: 4, parasail: 6 };

const courses = new Map<string, Course>();
export function tripCourse(kind: BoatKind, launch: Point, trip: number): Course {
  const index = ((trip % TRIPS[kind].length) + TRIPS[kind].length) % TRIPS[kind].length,
    key = `${kind}|${launch.join(',')}|${index}`;
  let found = courses.get(key);
  if (!found) {
    const plan = TRIPS[kind][index],
      path = plan.path(launch);
    // Paths that come back to where they started are already closed loops.
    const control =
      Math.hypot(path[0][0] - path[path.length - 1][0], path[0][1] - path[path.length - 1][1]) < 1e-6
        ? path
        : [...path, path[0]];
    courses.set(key, (found = build(control, plan.land, SOFT[kind])));
  }
  return found;
}
// Long voyages are made at a brisker pace, so no ride outstays its welcome.
const LONGEST: Record<BoatKind, number> = { kayak: 210, jetski: 110, sailboat: 240, parasail: 150 };
export const courseSeconds = (kind: BoatKind, course: Course) =>
  Math.min(course.total / BOAT_SPEED[kind], LONGEST[kind]);
// Where the boat is `t` seconds in: easing off the mooring onto the course, round it at a steady
// speed, and easing back in. `k` is how far out on the course it is (1 once clear of the mooring).
export function courseAt(kind: BoatKind, course: Course, launch: Point, t: number) {
  const seconds = courseSeconds(kind, course),
    [x, z] = pointAt(course, clamp01(t / seconds) * course.total),
    k = smooth(t / EASE[kind]) * smooth((seconds - t) / EASE[kind]);
  return { x: launch[0] + (x - launch[0]) * k, z: launch[1] + (z - launch[1]) * k, k, done: t >= seconds };
}
// The longest any trip can take, with room for a detour (ride errands are planned to last this long).
export const DETOUR_STRETCH = 1.2;
export const longestTrip = (kind: BoatKind, launch: Point) =>
  Math.max(...TRIPS[kind].map((_, i) => courseSeconds(kind, tripCourse(kind, launch, i)))) * DETOUR_STRETCH;

// ---- Detours ----
// Something worth a closer look, and where it will be `seconds` from now (null once it has gone).
export type Sight = {
  kind: 'whale' | 'dolphins' | 'shark';
  x: number;
  z: number;
  present: boolean;
  ahead?: (seconds: number) => { x: number; z: number; present: boolean };
};
const REACH: Partial<Record<BoatKind, number>> = { kayak: 16, jetski: 45, sailboat: 40 };
const STANDOFF = 6;
// The middle of the course is free to bend; the ends stay put by the mooring.
function nearestIndex(course: Course, target: Point) {
  let best = -1,
    distance = Infinity;
  course.points.forEach((p, i) => {
    const along = course.lengths[i] / course.total,
      d = Math.hypot(p[0] - target[0], p[1] - target[1]);
    if (along > 0.15 && along < 0.85 && d < distance) {
      best = i;
      distance = d;
    }
  });
  return { index: best, distance };
}
// Bend the course out to pass `target` at a respectful distance. Null if it's out of reach, too
// close to land, or would make the trip much longer.
export function detour(course: Course, target: Point, reach: number, land = 4, soft = 8): Course | null {
  const { index, distance } = nearestIndex(course, target);
  if (index < 0 || distance > reach || distance < STANDOFF + 2) return null;
  if (Math.min(shoreDistance(...target), highlandsDistance(...target)) < land + STANDOFF) return null;
  const [px, pz] = course.points[index],
    pull = (distance - STANDOFF) / distance,
    shift: Point = [(target[0] - px) * pull, (target[1] - pz) * pull],
    width = Math.max(24, Math.hypot(...shift) * 1.5);
  const bent = course.points.map((p, i): Point => {
    const away = Math.abs(course.lengths[i] - course.lengths[index]) / width,
      weight = away >= 1 ? 0 : Math.cos((away * Math.PI) / 2) ** 2;
    return [p[0] + shift[0] * weight, p[1] + shift[1] * weight];
  });
  const result = tidy(bent, land, 4, soft);
  return result.total <= course.total * DETOUR_STRETCH ? result : null;
}
// Setting off: is there a whale (first choice) or a pod of dolphins this trip could swing past?
// It aims for where the animal will be by the time the boat gets there.
export function planDetour(kind: BoatKind, course: Course, sights: Sight[]) {
  const reach = REACH[kind];
  if (!reach) return null;
  for (const wanted of ['whale', 'dolphins'] as const)
    for (const sight of sights) {
      if (sight.kind !== wanted || !sight.present) continue;
      let meet = { x: sight.x, z: sight.z, present: true };
      // Twice round: where it'll be when we arrive, then again for the arrival time that implies.
      for (let pass = 0; pass < 2 && sight.ahead; pass++) {
        const { index } = nearestIndex(course, [meet.x, meet.z]);
        if (index < 0) break;
        meet = sight.ahead((course.lengths[index] / course.total) * courseSeconds(kind, course));
      }
      if (!meet.present) continue;
      const bent = detour(course, [meet.x, meet.z], reach, 4, SOFT[kind]);
      if (bent) return { course: bent, sight: wanted };
    }
  return null;
}
