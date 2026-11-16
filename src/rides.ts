import { ISLAND_CENTER_Z, ISLAND_X_SCALE, shorePoint } from './shoreline.ts';
import { bluff, jetty, marina, reef, type Point } from './world.ts';

// Autopilot rides: each one is a path over time, starting and ending at its launch spot.
// The player controller follows the rider; the boats, skis and chute follow `ride` (in fun-state).
export type RideKind = 'kayak' | 'jetski' | 'sailboat' | 'parasail' | 'climb' | 'scuba';
export type RidePose = {
  x: number;
  y: number;
  z: number;
  heading: number;
  // Lean into turns (boats), or the chute's swing.
  roll: number;
  // The climb holds at the top until you stand up; the other rides end back at the launch.
  done: boolean;
  // The tow boat, when the rider isn't in the vehicle (parasailing).
  boat?: { x: number; z: number; heading: number };
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const coastAngle = (p: Point) => Math.atan2(p[1] - ISLAND_CENTER_Z, p[0] / ISLAND_X_SCALE);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
// Water routes swing wide round the docks and the bluff instead of sailing through them.
const obstacles = [
  { angle: coastAngle([marina.x, marina.z1]), width: 0.16, push: 6 },
  { angle: coastAngle([jetty.x0, jetty.z]), width: 0.2, push: 6.5 },
  { angle: coastAngle([bluff.x, bluff.z]), width: 0.12, push: 2.5 },
];
const swingWide = (a: number) =>
  obstacles.reduce((sum, o) => sum + o.push * Math.exp(-((wrap(a - o.angle) / o.width) ** 2)), 0);

// A loop round the island: ease out from the launch, circle once, ease back in.
function loop(launch: Point, t: number, speed: number, offset: (a: number) => number, ease = 4) {
  const duration = (Math.PI * 2) / Math.abs(speed),
    a = coastAngle(launch) + speed * t,
    [lx, lz] = shorePoint(a, offset(a) + swingWide(a)),
    k = smooth(t / ease) * smooth((duration - t) / ease);
  return { x: launch[0] + (lx - launch[0]) * k, z: launch[1] + (lz - launch[1]) * k, k, duration };
}
const ROUTES = {
  kayak: { speed: 0.07, offset: () => 5.5 },
  jetski: { speed: 0.16, offset: (a: number) => 11 + 2.2 * Math.sin(a * 9) },
  sailboat: { speed: -0.05, offset: (a: number) => 8.5 + 1.2 * Math.sin(a * 3) },
  parasail: { speed: 0.065, offset: () => 11 },
};
export const PARASAIL_HEIGHT = 10;
export const CLIMB_SECONDS = 22;

// Where the rider is `t` seconds into the ride. Heading comes from where the ride goes next.
export function ridePose(kind: RideKind, launch: Point, t: number): RidePose {
  if (kind === 'climb') return climbPose(launch, t);
  if (kind === 'scuba') return withHeading(t => divePose(launch, t), t);
  if (kind === 'parasail') return parasailPose(launch, t);
  const route = ROUTES[kind];
  const at = (t: number) => {
    const p = loop(launch, t, route.speed, route.offset);
    // Jet skis hop a wave every few seconds once they're out on the water.
    const phase = t % 5.5,
      hop = kind === 'jetski' && p.k > 0.95 && phase > 4.6 ? Math.sin(((phase - 4.6) / 0.9) * Math.PI) * 0.55 : 0;
    return { x: p.x, y: hop, z: p.z, done: t >= p.duration };
  };
  const pose = withHeading(at, t);
  // Lean into the turn: how fast the heading is changing.
  const turn = wrap(withHeading(at, t + 0.3).heading - pose.heading);
  pose.roll =
    Math.max(-0.35, Math.min(0.35, -turn * (kind === 'jetski' ? 2.2 : 1.2))) + (kind === 'sailboat' ? 0.08 : 0);
  return pose;
}
function withHeading(at: (t: number) => { x: number; y: number; z: number; done: boolean }, t: number): RidePose {
  const p = at(t),
    q = at(t + 0.15);
  const moving = Math.hypot(q.x - p.x, q.z - p.z) > 1e-4;
  return { ...p, heading: moving ? Math.atan2(q.x - p.x, q.z - p.z) : NaN, roll: 0 };
}

// The tow boat circles wide; the rider rises behind it on a long line, then lands back on the deck.
function parasailPose(launch: Point, t: number): RidePose {
  const boatAt = (t: number) => {
    const p = loop(launch, t, ROUTES.parasail.speed, ROUTES.parasail.offset, 6);
    return { x: p.x, y: 0, z: p.z, done: t >= p.duration };
  };
  const boat = withHeading(boatAt, t),
    duration = (Math.PI * 2) / ROUTES.parasail.speed,
    lift = smooth((t - 4) / 10) * smooth((duration - t - 3) / 10),
    line = 0.9 + 6.5 * lift,
    heading = Number.isNaN(boat.heading) ? 0 : boat.heading;
  return {
    x: boat.x - Math.sin(heading) * line,
    y: lift * PARASAIL_HEIGHT,
    z: boat.z - Math.cos(heading) * line,
    heading,
    roll: Math.sin(t * 0.9) * 0.08 * lift,
    done: boat.done,
    boat: { x: boat.x, z: boat.z, heading },
  };
}

// Up the face hold by hold, a step back from the edge, then turn to take in the view.
export const climbFaceZ = (y: number) => bluff.faceZ - (bluff.lean * y) / bluff.h;
function climbPose(launch: Point, t: number): RidePose {
  const s = clamp01(t / CLIMB_SECONDS),
    // Pull up, pause, reach: a little stepwise rhythm on the way up.
    step = s * 14,
    y = bluff.h * ((Math.floor(step) + smooth((step % 1) * 1.6)) / 14);
  if (t < CLIMB_SECONDS)
    return {
      x: launch[0] + Math.sin(step * 0.9) * 0.35,
      y,
      z: Math.min(launch[1], climbFaceZ(y) + 0.32),
      heading: Math.PI,
      roll: Math.sin(step * Math.PI) * 0.08,
      done: false,
    };
  const over = smooth((t - CLIMB_SECONDS) / 2);
  return {
    x: launch[0],
    y: bluff.h,
    z: climbFaceZ(bluff.h) + 0.32 - over * 1.1,
    heading: over < 1 ? Math.PI : 0,
    roll: 0,
    done: false,
  };
}

// Down the ladder, out over the reef in a lazy figure of eight, then back up.
export const DIVE_DEPTH = 2.5;
const DIVE_SWIM = 0.11;
export const DIVE_SECONDS = 5 + (Math.PI * 2) / DIVE_SWIM + 5;
function divePose(launch: Point, t: number) {
  const u = Math.max(0, t - 5) * DIVE_SWIM,
    out = smooth((t - 2) / 5) * smooth((DIVE_SECONDS - t - 2) / 5),
    loopX = reef.x + Math.sin(u) * 4.2,
    loopZ = reef.z + Math.sin(u * 2) * 2.4;
  const depth = smooth(t / 4) * smooth((DIVE_SECONDS - t) / 4);
  return {
    x: launch[0] + (loopX - launch[0]) * out,
    y: -DIVE_DEPTH * depth + Math.sin(t * 1.3) * 0.08 * depth,
    z: launch[1] + (loopZ - launch[1]) * out,
    done: t >= DIVE_SECONDS,
  };
}

// How the rider sits in each ride (in the avatar's own frame, like seatPose).
export function riderPose(kind: RideKind, t: number, depth = 0) {
  switch (kind) {
    case 'kayak':
      return { y: -0.58, pitch: 0, z: 0, roll: 0 };
    case 'jetski':
      return { y: -0.42, pitch: 0.12, z: -0.1, roll: 0 };
    case 'sailboat':
      return { y: -0.55, pitch: 0, z: 0, roll: 0 };
    case 'parasail':
      return { y: -0.55, pitch: 0, z: 0, roll: 0 };
    case 'climb':
      return { y: 0, pitch: 0.12, z: 0, roll: 0 };
    case 'scuba':
      // Lie flat and kick once under the surface.
      return { y: 0, pitch: (Math.PI / 2) * clamp01(depth / 1.2), z: 0, roll: Math.sin(t * 2.4) * 0.06 };
  }
}
