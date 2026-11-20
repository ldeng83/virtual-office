import { groundHeight, JUMP_LEDGES, LAKE } from './highlands.ts';

// Sky jumps off the summit: a wingsuit flight and a parachute jump. Each ledge has several routes,
// and every jump draws one at random (never the same one twice in a row). A route is a list of
// timed 3D waypoints, flown smoothly from one to the next; it ends standing at its `exit`.
type Point = [number, number];
export type JumpKind = 'wingsuit' | 'parachute';
// [x, y, z, seconds into the jump]
export type Waypoint = [number, number, number, number];
export type JumpRoute = {
  name: string;
  // What the activity feed says as you jump.
  start: string;
  path: Waypoint[];
  // When the canopy opens (the wingsuit pops its chute near the end).
  open: number;
  // When you hit the water (the lake splash), then swim to the bank.
  splash?: number;
  exit: Point;
};
export type JumpPhase = 'fly' | 'fall' | 'canopy' | 'swim' | 'landed';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
// The first and last waypoints: standing on the ledge, standing at the exit.
const ledgeStart = (kind: JumpKind): Waypoint => {
  const [x, z] = JUMP_LEDGES[kind].point;
  return [x, groundHeight(x, z), z, 0];
};
const touchdown = ([x, z]: Point, t: number): Waypoint => [x, groundHeight(x, z), z, t];

// Swimming: at the surface (the swimmer's pose sinks the body in, rides.ts).
const SWIM_Y = LAKE.level - 0.3;
export const JUMP_ROUTES: Record<JumpKind, JumpRoute[]> = {
  wingsuit: [
    {
      name: 'Gorge run',
      start: '🦅 Wingsuit · Gorge run: down past the falls, through the gorge and out to sea.',
      path: [
        ledgeStart('wingsuit'),
        [15.1, 15.8, -93.3, 0.5],
        [13.6, 13.6, -90.8, 1.5],
        [11.4, 10.6, -88.4, 2.5],
        [13.6, 9.4, -85, 3.5],
        [18, 8.6, -82.4, 4.4],
        [22.5, 6, -80.4, 5.3],
        [28, 4.6, -80, 6.2],
        [34, 4.2, -80.4, 7.1],
        [40, 4, -79, 8.1],
        [47, 4, -72, 9.4],
        [51, 4, -60, 11],
        [52, 4.2, -46, 12.8],
        [50, 4.6, -33, 14.5],
        [47, 6.2, -24, 16],
        [43, 5.6, -19.4, 17.8],
        [39.6, 4.4, -17.5, 19.4],
        touchdown([35.5, -17], 21.4),
      ],
      open: 15.6,
      exit: [35.5, -17],
    },
    {
      name: 'Lake skim',
      start: '🦅 Wingsuit · Lake skim: low over the lake, then up and over the woods to the campsite.',
      path: [
        ledgeStart('wingsuit'),
        [15.1, 15.8, -93.3, 0.5],
        [13.2, 13.2, -90.6, 1.5],
        [9.6, 9.6, -88.6, 2.5],
        [4.4, 5.6, -87.6, 3.4],
        [1, 2.6, -84.6, 4.2],
        [-2, 1.5, -82.6, 4.9],
        [-6, 1.4, -82, 5.5],
        [-9.4, 2.6, -82.6, 6.2],
        [-11.2, 6.6, -85.2, 7.2],
        [-12, 8.6, -88.6, 8.2],
        [-12.2, 8, -91.8, 9.4],
        [-12.1, 5.4, -93.4, 11.2],
        [-12, 2.8, -94.2, 12.8],
        touchdown([-12, -94.5], 14),
      ],
      open: 9,
      exit: [-12, -94.5],
    },
    {
      name: 'Island hop',
      start: '🦅 Wingsuit · Island hop: a long glide over open sea to the office island.',
      path: [
        ledgeStart('wingsuit'),
        [15.1, 15.8, -93.3, 0.5],
        [15.8, 13.4, -90.4, 1.5],
        [16.6, 10.8, -86.4, 2.6],
        [15, 9.4, -81, 3.7],
        [11, 8.8, -75, 4.8],
        [5, 8.2, -70.6, 5.9],
        [-3, 7.6, -66.4, 7.1],
        [-15, 6.8, -62, 8.6],
        [-27, 6, -57, 10.2],
        [-33, 5.4, -50, 11.4],
        [-28, 5.2, -45, 12.5],
        [-18, 5.4, -45.6, 13.7],
        [-8, 6, -47, 14.9],
        [-2.4, 4.6, -44.4, 16.4],
        [0.6, 2.6, -41.8, 18],
        touchdown([2, -40], 19.4),
      ],
      open: 14.6,
      exit: [2, -40],
    },
  ],
  parachute: [
    {
      name: 'Meadow spiral',
      start: '🪂 Parachute · Meadow spiral: drifting down the mountain and circling into the trailhead meadow.',
      path: [
        ledgeStart('parachute'),
        [18.1, 15.6, -93.4, 0.5],
        [18.3, 14.4, -91.6, 1.2],
        [18.6, 13.6, -89.6, 2],
        [19, 12.4, -86, 3.4],
        [17.6, 11.2, -81.6, 5],
        [15, 10, -77, 6.8],
        [13.4, 8.8, -72.6, 8.4],
        [10.6, 7.8, -70.2, 9.6],
        [11, 6.8, -67.8, 10.8],
        [13.6, 5.8, -68.4, 12],
        [13.8, 4.8, -71.4, 13.2],
        [11.2, 3.8, -72.6, 14.4],
        [8.8, 2.8, -71.4, 15.6],
        [8.8, 1.8, -70.4, 16.6],
        touchdown([9, -70.4], 17.8),
      ],
      open: 1.2,
      exit: [9, -70.4],
    },
    {
      name: 'Coast drift',
      start: '🪂 Parachute · Coast drift: out across the lake woods and down along the west shore.',
      path: [
        ledgeStart('parachute'),
        [18.1, 15.6, -93.4, 0.5],
        [18.3, 14.4, -91.6, 1.2],
        [17.4, 13.6, -89, 2.2],
        [12, 12.4, -88.4, 4],
        [6, 11.2, -89, 6],
        [0, 10, -88.4, 8],
        [-6, 9, -87.4, 10],
        [-12, 8, -86.8, 12],
        [-18, 7.4, -86.6, 14],
        [-24, 6.4, -86.4, 16],
        [-29, 5, -85, 18],
        [-30.4, 4, -82, 19.6],
        [-27.4, 3, -80.6, 21],
        [-23.6, 2, -80.4, 22.4],
        touchdown([-20.2, -80.4], 23.8),
      ],
      open: 1.2,
      exit: [-20.2, -80.4],
    },
    {
      name: 'Lake splash',
      start: '🪂 Parachute · Lake splash: straight for the lake, a splash, and a swim to the bank.',
      path: [
        ledgeStart('parachute'),
        [18.1, 15.6, -93.4, 0.5],
        [18.3, 14.4, -91.6, 1.2],
        [17.4, 13.6, -89, 2.2],
        [12, 12.2, -88.4, 4],
        [6, 10.6, -88.6, 6],
        [1, 8.6, -87, 8],
        [-2, 6.4, -85, 9.8],
        [-3.4, 4, -83.4, 11.6],
        [-3.8, 2, -82.6, 13.2],
        [-4, SWIM_Y, -82.4, 14.4],
        [-5.4, SWIM_Y, -82.3, 16],
        [-7.2, SWIM_Y, -82.2, 18],
        [-8.8, SWIM_Y + 0.15, -82.1, 19.6],
        touchdown([-9.6, -82], 20.8),
      ],
      open: 1.2,
      splash: 14.4,
      exit: [-9.6, -82],
    },
  ],
};
export const jumpSeconds = (route: JumpRoute) => route.path[route.path.length - 1][3];

// A fresh route for this ledge: any but the one it drew last time.
const lastDrawn: Record<string, number> = {};
export function drawRoute(ledge: string, count: number, pick = Math.random()) {
  const last = lastDrawn[ledge],
    options = Array.from({ length: count }, (_, i) => i).filter(i => i !== last || count === 1),
    drawn = options[Math.min(options.length - 1, Math.floor(clamp01(pick) * options.length))];
  lastDrawn[ledge] = drawn;
  return drawn;
}

// Where you are along a route: a smooth curve through the waypoints at their times (Hermite, with
// tangents from the neighbouring waypoints, so speed changes gently from one stretch to the next).
function along(path: Waypoint[], t: number): [number, number, number] {
  const end = path[path.length - 1];
  if (t <= 0) return [path[0][0], path[0][1], path[0][2]];
  if (t >= end[3]) return [end[0], end[1], end[2]];
  let i = 1;
  while (path[i][3] < t) i++;
  const a = path[i - 1],
    b = path[i],
    d = b[3] - a[3],
    u = (t - a[3]) / d,
    tangent = (k: number, axis: number) => {
      const p = path[Math.max(0, k - 1)],
        q = path[Math.min(path.length - 1, k + 1)];
      // Standing still at either end: you leave the ledge and arrive at the exit from rest.
      if (k === 0 || k === path.length - 1) return 0;
      return (q[axis] - p[axis]) / (q[3] - p[3]);
    },
    h00 = 2 * u ** 3 - 3 * u ** 2 + 1,
    h10 = u ** 3 - 2 * u ** 2 + u,
    h01 = -2 * u ** 3 + 3 * u ** 2,
    h11 = u ** 3 - u ** 2;
  return [0, 1, 2].map(
    axis => h00 * a[axis] + h10 * d * tangent(i - 1, axis) + h01 * b[axis] + h11 * d * tangent(i, axis),
  ) as [number, number, number];
}

export type JumpPose = {
  x: number;
  y: number;
  z: number;
  heading: number;
  roll: number;
  phase: JumpPhase;
  done: boolean;
};
export function jumpPhase(kind: JumpKind, route: JumpRoute, t: number): JumpPhase {
  if (t >= jumpSeconds(route)) return 'landed';
  if (route.splash !== undefined && t >= route.splash) return 'swim';
  if (t >= route.open) return 'canopy';
  return kind === 'wingsuit' ? 'fly' : 'fall';
}
// `t` seconds into a jump along `route`. The wingsuit banks into its turns; under the canopy you
// swing gently, like the parasail.
export function jumpPose(kind: JumpKind, route: JumpRoute, t: number): JumpPose {
  const [x, y, z] = along(route.path, t),
    phase = jumpPhase(kind, route, t),
    headingAt = (s: number) => {
      const p = along(route.path, s),
        q = along(route.path, s + 0.15);
      return Math.hypot(q[0] - p[0], q[2] - p[2]) > 1e-4 ? Math.atan2(q[0] - p[0], q[2] - p[2]) : NaN;
    },
    heading = headingAt(t);
  let roll = 0;
  if (phase === 'fly' && !Number.isNaN(heading)) {
    const ahead = headingAt(t + 0.4);
    if (!Number.isNaN(ahead)) roll = Math.max(-0.7, Math.min(0.7, -wrap(ahead - heading) * 1.6));
  } else if (phase === 'canopy') roll = Math.sin(t * 0.9) * 0.08 * smooth((t - route.open) / 1.5);
  return { x, y, z, heading, roll, phase, done: phase === 'landed' };
}

// Gentle motion: no flight at all. The canopy opens as you step off the ledge and floats you straight
// down to the trail below it; then the view fades and you're at the route's landing spot.
export const GENTLE_SECONDS = 6;
export function gentlePose(kind: JumpKind, t: number): JumpPose {
  const { point, angle } = JUMP_LEDGES[kind],
    out = 0.65 * smooth(t / 1.2),
    x = point[0] + Math.sin(angle) * out,
    z = point[1] + Math.cos(angle) * out,
    from = groundHeight(...point),
    to = groundHeight(point[0] + Math.sin(angle) * 0.65, point[1] + Math.cos(angle) * 0.65),
    done = t >= GENTLE_SECONDS;
  return {
    x,
    y: Math.max(groundHeight(x, z), from + (to - from) * smooth(t / (GENTLE_SECONDS - 0.5))),
    z,
    heading: angle,
    roll: 0,
    phase: done ? 'landed' : 'canopy',
    done,
  };
}

// Cutting away: the route stops and you float straight down to the ground below, then stand.
export const CUT_SPEED = 2.4;
export type CutAway = { x: number; y: number; z: number; t: number };
export function cutPose(cut: CutAway, heading: number, t: number): JumpPose {
  const ground = groundHeight(cut.x, cut.z),
    y = Math.max(ground, cut.y - CUT_SPEED * (t - cut.t)),
    done = y <= ground && t - cut.t > 0.3;
  return { x: cut.x, y, z: cut.z, heading, roll: 0, phase: done ? 'landed' : 'canopy', done };
}
