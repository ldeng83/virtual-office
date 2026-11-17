import { shoreDistance } from './shoreline.ts';
import { highlandsDistance } from './highlands.ts';
import { turnToward } from './steering.ts';
import { reef, type Point } from './world.ts';

// Scuba diving off the fishing jetty: a guided tour of the reef and the shipwreck that you can take
// over and swim yourself, an air supply, and a logbook of what you meet down there.
export const DIVE_DEPTH = 2.5;
export const SEABED = -3.45;
// The wreck lies further out, past the reef.
export const wreck = { x: reef.x - 17, z: reef.z + 5.5, heading: 0.7 };
export const chest: Point = [wreck.x + 3.2, wreck.z + 2.6];
// You can swim anywhere inside this circle of sea, as long as you keep off the beach.
export const DIVE_AREA = { x: reef.x - 10.5, z: reef.z + 2.7, r: 22 };
const SHORE_MARGIN = 2.5;
export const canSwim = (x: number, z: number) =>
  Math.hypot(x - DIVE_AREA.x, z - DIVE_AREA.z) < DIVE_AREA.r &&
  shoreDistance(x, z) > SHORE_MARGIN &&
  highlandsDistance(x, z) > SHORE_MARGIN;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

// The guided tour: out to the reef and round it in a figure of eight, on to the wreck and round
// that, then back to the ladder. A smooth curve through these points, swum at a steady speed.
const TOUR_SPEED = 1.15,
  SINK_SECONDS = 4;
function tourPoints(launch: Point): Point[] {
  const eight = Array.from({ length: 12 }, (_, i): Point => {
    const u = ((i + 0.5) / 12) * Math.PI * 2;
    return [reef.x + Math.sin(u) * 4.2, reef.z + Math.sin(u * 2) * 2.4];
  });
  const circle = Array.from({ length: 9 }, (_, i): Point => {
    const a = 0.2 - (i / 8) * Math.PI * 1.75;
    return [wreck.x + Math.cos(a) * 5.2, wreck.z + Math.sin(a) * 4.2];
  });
  return [launch, [launch[0] - 2.5, launch[1] + 1.6], ...eight, ...circle, [reef.x + 1, reef.z + 4.5], launch];
}
const catmull = (a: number, b: number, c: number, d: number, t: number) =>
  0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
type Tour = { points: Point[]; lengths: number[]; total: number };
const tours = new Map<string, Tour>();
function tour(launch: Point): Tour {
  const key = launch.join(',');
  let found = tours.get(key);
  if (!found) {
    const control = tourPoints(launch),
      at = (i: number) => control[Math.max(0, Math.min(control.length - 1, i))],
      points: Point[] = [];
    for (let i = 0; i < control.length - 1; i++)
      for (let step = 0; step < 12; step++) {
        const t = step / 12,
          [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
        points.push([catmull(a[0], b[0], c[0], d[0], t), catmull(a[1], b[1], c[1], d[1], t)]);
      }
    points.push(launch);
    const lengths = [0];
    for (let i = 1; i < points.length; i++)
      lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    tours.set(key, (found = { points, lengths, total: lengths[lengths.length - 1] }));
  }
  return found;
}
const EASE = 1.5;
export const tourSeconds = (launch: Point) => tour(launch).total / TOUR_SPEED + EASE;
// Where the guided dive is `t` seconds in (the ride's path: see rides.ts).
export function tourPose(launch: Point, t: number) {
  const { points, lengths, total } = tour(launch),
    duration = tourSeconds(launch),
    at = Math.max(0, Math.min(duration, t)),
    // Ease away from the ladder and back in to it; steady in between.
    goal =
      at < EASE
        ? (TOUR_SPEED * at * at) / (2 * EASE)
        : at > duration - EASE
          ? total - (TOUR_SPEED * (duration - at) ** 2) / (2 * EASE)
          : TOUR_SPEED * (at - EASE / 2);
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < goal) i++;
  const span = lengths[i] - lengths[i - 1],
    f = span ? clamp01((goal - lengths[i - 1]) / span) : 1,
    depth = smooth(t / SINK_SECONDS) * smooth((duration - t) / SINK_SECONDS);
  return {
    x: points[i - 1][0] + (points[i][0] - points[i - 1][0]) * f,
    y: -DIVE_DEPTH * depth + Math.sin(t * 1.3) * 0.08 * depth,
    z: points[i - 1][1] + (points[i][1] - points[i - 1][1]) * f,
    done: t >= duration,
  };
}

// Swimming it yourself. A full tank lasts three minutes; when it runs low you head back up.
export const AIR_SECONDS = 180;
const SWIM_SPEED = 2.3,
  RETURN_SPEED = 3.4;
export const airLeft = (t: number) => clamp01(1 - t / AIR_SECONDS);
export type Diver = {
  t: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  roll: number;
  // Unset while the guided tour is swimming for you.
  mode?: 'free' | 'return';
};
// One frame of free swimming (steer is a direction, or null to drift) or of the swim back to the
// ladder. Returns true once you're back at the top of the ladder.
export function stepSwim(launch: Point, diver: Diver, steer: Point | null, dt: number) {
  diver.t += dt;
  if (diver.mode !== 'return' && diver.t >= AIR_SECONDS) diver.mode = 'return';
  if (diver.mode === 'return') {
    const dx = launch[0] - diver.x,
      dz = launch[1] - diver.z,
      away = Math.hypot(dx, dz),
      step = Math.min(away, RETURN_SPEED * dt);
    if (away > 1e-4) {
      diver.x += (dx / away) * step;
      diver.z += (dz / away) * step;
      if (away > 0.5) diver.heading = turnToward(diver.heading, Math.atan2(dx, dz), dt, 4);
    }
    // Come up the last few metres as you reach the ladder.
    const depth = DIVE_DEPTH * smooth((away - 0.3) / 5);
    diver.y += (-depth - diver.y) * (1 - Math.exp(-dt * 3));
    diver.roll = 0;
    return away < 0.15 && diver.y > -0.25;
  }
  const length = steer ? Math.hypot(steer[0], steer[1]) : 0;
  if (steer && length > 0.03) {
    const dx = (steer[0] / length) * SWIM_SPEED * dt,
      dz = (steer[1] / length) * SWIM_SPEED * dt;
    if (canSwim(diver.x + dx, diver.z)) diver.x += dx;
    if (canSwim(diver.x, diver.z + dz)) diver.z += dz;
    const want = Math.atan2(dx, dz),
      turn = Math.atan2(Math.sin(want - diver.heading), Math.cos(want - diver.heading));
    diver.heading = turnToward(diver.heading, want, dt, 5);
    diver.roll = Math.max(-0.3, Math.min(0.3, -turn * 0.4));
  } else diver.roll *= Math.exp(-dt * 4);
  const cruise = -DIVE_DEPTH + Math.sin(diver.t * 1.3) * 0.08;
  diver.y += (cruise - diver.y) * (1 - Math.exp(-dt * 2));
  return false;
}

// The logbook: everything you can meet on a dive. Swim within `near` of it and it's logged.
export const SPECIES = [
  { id: 'reef', icon: '🪸', name: 'The coral reef', near: 4 },
  { id: 'wreck', icon: '⚓', name: 'The shipwreck', near: 6.5 },
  { id: 'chest', icon: '💰', name: 'A treasure chest', near: 1.8 },
  { id: 'reef-fish', icon: '🐠', name: 'Reef fish', near: 3 },
  { id: 'turtle', icon: '🐢', name: 'A sea turtle', near: 3.5 },
  { id: 'ray', icon: '🪽', name: 'A manta ray', near: 4 },
  { id: 'school', icon: '🐟', name: 'A school of silversides', near: 4.5 },
  { id: 'jellyfish', icon: '🪼', name: 'Jellyfish', near: 3.5 },
  { id: 'dolphin', icon: '🐬', name: 'Dolphins', near: 5 },
  { id: 'shark', icon: '🦈', name: 'A shark', near: 8 },
  { id: 'whale', icon: '🐋', name: 'A humpback whale', near: 12 },
] as const;
export type SpeciesId = (typeof SPECIES)[number]['id'];
const nearness = Object.fromEntries(SPECIES.map(s => [s.id, s.near])) as Record<SpeciesId, number>;
export const inSight = (id: SpeciesId, dx: number, dz: number) => Math.hypot(dx, dz) < nearness[id];
