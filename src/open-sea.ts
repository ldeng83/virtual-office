import { shoreDistance, shorePoint } from './shoreline.ts';
import { highlandsDistance, highlandsPoint } from './highlands.ts';
import type { Period } from './daylight.ts';

// Life out on the open sea: dolphin pods, schools, whales, a shark and flying fish cross the whole
// sea from edge to edge, each crossing on a new route. Everything here is a pure function of time,
// so pausing motion freezes it and the tests can walk through hours of it.
export type Point = [number, number];
// A little wider than the camera can pan, so animals arrive from beyond the view.
export const SEA = { minX: -100, maxX: 105, minZ: -145, maxZ: 72 };
export const landDistance = (x: number, z: number) => Math.min(shoreDistance(x, z), highlandsDistance(x, z));

const fract = (v: number) => v - Math.floor(v);
export const rand = (a: number, b: number, c = 0) =>
  fract(Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + 0.5) * 43758.5453);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

// ---- Crossings: a curved route from one edge of the sea to another, clear of both islands ----
export type Crossing = { a: Point; c: Point; b: Point; length: number };
function edgePoint(edge: number, along: number): Point {
  const x = SEA.minX + (SEA.maxX - SEA.minX) * along,
    z = SEA.minZ + (SEA.maxZ - SEA.minZ) * along;
  return edge === 0 ? [SEA.minX, z] : edge === 1 ? [SEA.maxX, z] : edge === 2 ? [x, SEA.minZ] : [x, SEA.maxZ];
}
const bezier = (r: Crossing, u: number): Point => {
  const v = 1 - u;
  return [v * v * r.a[0] + 2 * v * u * r.c[0] + u * u * r.b[0], v * v * r.a[1] + 2 * v * u * r.c[1] + u * u * r.b[1]];
};
function measure(a: Point, c: Point, b: Point, margin: number): Crossing | null {
  const route = { a, c, b, length: 0 };
  let last = a;
  for (let i = 1; i <= 40; i++) {
    const p = bezier(route, i / 40);
    if (landDistance(p[0], p[1]) < margin) return null;
    route.length += Math.hypot(p[0] - last[0], p[1] - last[1]);
    last = p;
  }
  return route.length > 130 && route.length < 300 ? route : null;
}
const routes = new Map<string, Crossing>();
// The `n`th crossing of traveller `slot`, keeping `margin` away from land.
export function crossing(slot: number, n: number, margin: number): Crossing {
  const key = `${slot}:${n}:${margin}`;
  const known = routes.get(key);
  if (known) return known;
  let route: Crossing | null = null;
  for (let k = 0; k < 24 && !route; k++) {
    const from = Math.floor(rand(slot, n, k) * 4),
      to = (from + 1 + Math.floor(rand(slot, n, k + 0.1) * 3)) % 4;
    route = measure(
      edgePoint(from, rand(slot, n, k + 0.2)),
      [
        SEA.minX + (SEA.maxX - SEA.minX) * rand(slot, n, k + 0.3),
        SEA.minZ + (SEA.maxZ - SEA.minZ) * rand(slot, n, k + 0.4),
      ],
      edgePoint(to, rand(slot, n, k + 0.5)),
      margin,
    );
  }
  // A lane down the open west side always works.
  route ??= measure([-90, SEA.maxZ], [-98, -36], [-90, SEA.minZ], 0)!;
  if (routes.size > 400) routes.clear();
  routes.set(key, route);
  return route;
}

// Where traveller `slot` is: `cycle` seconds per crossing, the last `rest` of them out of sight.
// `back` trails a follower that many units behind along the route; `side` puts it abreast.
export function travel(slot: number, t: number, cycle: number, margin: number, rest = 8, back = 0, side = 0) {
  const clock = t + slot * 37.3,
    n = Math.floor(clock / cycle),
    route = crossing(slot, n, margin),
    seconds = cycle - rest,
    lead = (clock - n * cycle) / seconds,
    u = clamp01(lead - back / route.length),
    v = 1 - u;
  const [x, z] = bezier(route, u);
  const dx = 2 * v * (route.c[0] - route.a[0]) + 2 * u * (route.b[0] - route.c[0]),
    dz = 2 * v * (route.c[1] - route.a[1]) + 2 * u * (route.b[1] - route.c[1]),
    d = Math.hypot(dx, dz) || 1;
  // Animals rise from the deep as they arrive and sink away as they leave.
  const presence = lead >= 1 ? 0 : smooth((lead * seconds) / 4) * smooth(((1 - lead) * seconds) / 4);
  return {
    x: x + (dz / d) * side,
    z: z - (dx / d) * side,
    heading: Math.atan2(dx, dz),
    presence,
    n,
    speed: route.length / seconds,
  };
}
export type Swimmer = { x: number; y: number; z: number; heading: number; pitch: number; presence: number };
const DEEP = 3.2;

// ---- Dolphin pods ----
export const PODS = [4, 3, 5];
const LEAP_EVERY = 11,
  LEAP_SECONDS = 2.2;
export function podMember(pod: number, member: number, t: number): Swimmer & { leap: number } {
  const row = Math.ceil(member / 2),
    side = member === 0 ? 0 : (member % 2 ? 1 : -1) * (0.75 + row * 0.45);
  const at = travel(pod, t, 96 + pod * 14, 7, 8, row * 1.5 + (member % 2) * 0.5, side);
  // One after another down the pod, each a beat behind the last.
  const phase = (((t + pod * 4.1 - member * 0.6) % LEAP_EVERY) + LEAP_EVERY) % LEAP_EVERY,
    leaping = phase < LEAP_SECONDS && at.presence > 0.95,
    leap = leaping ? Math.sin((phase / LEAP_SECONDS) * Math.PI) : 0;
  return {
    x: at.x,
    z: at.z,
    y: -0.65 + leap * 1.6 - (1 - at.presence) * DEEP,
    heading: at.heading,
    pitch: leaping ? -Math.cos((phase / LEAP_SECONDS) * Math.PI) * 0.65 : 0,
    leap,
    presence: at.presence,
  };
}

// ---- Roaming schools (gulls circle over them) and flying fish ----
export const ROAMING_SCHOOLS = 3;
export function schoolPose(school: number, t: number): Swimmer {
  const at = travel(10 + school, t, 150 + school * 17, 7, 10);
  return {
    x: at.x,
    z: at.z,
    y: -0.72 + Math.sin(t * 0.3 + school) * 0.08 - (1 - at.presence) * DEEP,
    heading: at.heading,
    pitch: 0,
    presence: at.presence,
  };
}
export const FLYING_SHOALS = 2,
  FLYERS = 6;
export function flyingFish(shoal: number, member: number, t: number): Swimmer & { air: number } {
  const at = travel(20 + shoal, t, 74 + shoal * 9, 9, 6, member * 0.9, ((member % 3) - 1) * 0.8);
  // Skip, glide, splash, swim a moment, skip again.
  const phase = (t * 1.15 + member * 0.43 + shoal) % 3,
    gliding = phase < 1.3 && at.presence > 0.95,
    air = gliding ? Math.sin((phase / 1.3) * Math.PI) : 0;
  return {
    x: at.x,
    z: at.z,
    y: -0.6 + air * 1.05 - (1 - at.presence) * DEEP,
    heading: at.heading,
    pitch: gliding ? -Math.cos((phase / 1.3) * Math.PI) * 0.4 : 0,
    air,
    presence: at.presence,
  };
}

// ---- Whales ----
export const WHALES = 2;
const SURFACE_EVERY = 26,
  BREACH_AIR = 3.2;
// Whales are showiest at dawn and golden hour, and mostly sleep at night.
export const breachChance = (period: Period) =>
  period === 'dawn' || period === 'golden' ? 0.6 : period === 'night' ? 0.08 : 0.22;
export type WhalePose = Swimmer & {
  roll: number;
  // 0–1 through the blow while the whale is at the surface, otherwise -1.
  spout: number;
  // 0–1 through the splash after a breach, otherwise -1.
  splash: number;
  breaching: boolean;
  // Counts surfacings, so each breach can be told apart.
  event: number;
};
export function whalePose(whale: number, t: number, chance = 0.22): WhalePose {
  const at = travel(30 + whale, t, 215 + whale * 40, 16, 14);
  const clock = t + whale * 11,
    event = Math.floor(clock / SURFACE_EVERY),
    s = clock - event * SURFACE_EVERY,
    awake = at.presence > 0.95,
    breaching = awake && rand(whale, event, 9) < chance;
  let y = -1.75,
    pitch = 0,
    roll = 0,
    spout = -1,
    splash = -1;
  if (breaching) {
    if (s < BREACH_AIR) {
      // Up and out nose first, a half roll, and back in on its side.
      const k = s / BREACH_AIR;
      y += Math.sin(k * Math.PI) * 4.3;
      pitch = -Math.cos(k * Math.PI) * 0.95;
      roll = smooth(k * 1.4) * 0.9 * Math.sin(k * Math.PI);
    } else if (s < BREACH_AIR + 2.6) splash = (s - BREACH_AIR) / 2.6;
  } else if (awake && s < 9) {
    // Roll up to breathe, blow, then lift the flukes and slide under.
    const up = smooth(s / 2) * smooth((9 - s) / 2.4);
    y += up * 1.05;
    if (s > 1.6 && s < 4.2) spout = (s - 1.6) / 2.6;
    const dive = smooth((s - 5.6) / 1.6) * smooth((9 - s) / 1.4);
    pitch = dive * 0.55;
    y += dive * 0.35;
  }
  return {
    x: at.x,
    z: at.z,
    y: y - (1 - at.presence) * DEEP,
    heading: at.heading,
    pitch,
    roll,
    spout,
    splash,
    breaching: breaching && s < BREACH_AIR,
    event,
    presence: at.presence,
  };
}

// ---- A harmless shark, far out: only the fin shows ----
export function sharkPose(t: number): Swimmer {
  const weave = Math.sin(t * 0.21) * 3.5,
    at = travel(40, t, 230, 13, 20, 0, weave);
  return {
    x: at.x,
    z: at.z,
    y: -0.78 - (1 - at.presence) * DEEP,
    heading: at.heading + Math.cos(t * 0.21) * 0.25,
    pitch: 0,
    presence: at.presence,
  };
}

// ---- A turtle that commutes across the strait between the two islands ----
const STRAIT_SOUTH = shorePoint(-Math.PI / 2 - 0.5, 2.2),
  STRAIT_NORTH = highlandsPoint(Math.PI / 2 + 0.45, 2.2),
  STRAIT_SECONDS = 200;
export function straitTurtle(t: number): Swimmer {
  const turn = (t / STRAIT_SECONDS) * Math.PI * 2,
    u = 0.5 - 0.5 * Math.cos(turn),
    north = Math.sin(turn) >= 0;
  const dx = STRAIT_NORTH[0] - STRAIT_SOUTH[0],
    dz = STRAIT_NORTH[1] - STRAIT_SOUTH[1];
  return {
    x: STRAIT_SOUTH[0] + dx * u,
    z: STRAIT_SOUTH[1] + dz * u,
    y: -0.5 + Math.sin(t * 0.45) * 0.1,
    heading: Math.atan2(dx, dz) + (north ? 0 : Math.PI),
    pitch: 0,
    presence: 1,
  };
}

// ---- Jellyfish drifting over the reef, by the dive site ----
export const JELLYFISH = 7;
export function jellyPose(reef: { x: number; z: number }, i: number, t: number) {
  const a = i * 2.4 + t * 0.02,
    r = 2.6 + (i % 4) * 1.15,
    pulse = 0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.9);
  return {
    // West of the jetty's end, over the deeper side of the reef.
    x: reef.x - 3.5 + Math.cos(a) * r,
    z: reef.z + Math.sin(a) * r * 0.9,
    y: -1.05 + (i % 3) * 0.14 + pulse * 0.12,
    pulse,
  };
}

// ---- Words for the activity feed ----
export function seaRegion(x: number, z: number) {
  if (z < -50 && z > -62 && Math.abs(x) < 45) return 'in the strait';
  if (z < -118) return 'north of the Highlands';
  if (z > 22) return 'south of the island';
  const side = x < 4 ? 'west' : 'east';
  return z < -58 ? `off the Highlands' ${side} shore` : `off the ${side} coast`;
}
