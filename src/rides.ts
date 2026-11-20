import { turnToward } from './steering.ts';
import {
  courseAt,
  courseSeconds,
  longestTrip,
  planDetour,
  tripCourse,
  TRIPS,
  type BoatKind,
  type Course,
  type Sight,
} from './boat-trips.ts';
import { DIVE_DEPTH, tourPose, tourSeconds } from './dive.ts';
import {
  cutPose,
  drawRoute,
  GENTLE_SECONDS,
  gentlePose,
  jumpPose,
  jumpSeconds,
  JUMP_ROUTES,
  type CutAway,
  type JumpKind,
  type JumpPhase,
} from './jumps.ts';
import { bluff, seats, walkable, type Point, type Seat } from './world.ts';

// Autopilot rides: each one is a path over time, starting and ending at its launch spot.
// The player controller follows the rider; the boats, skis and chute follow `ride` (in fun-state).
export type RideKind = 'kayak' | 'jetski' | 'sailboat' | 'parasail' | 'climb' | 'scuba' | 'ferry' | JumpKind;
export const isJump = (kind: RideKind): kind is JumpKind => kind === 'wingsuit' || kind === 'parachute';
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
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export const PARASAIL_HEIGHT = 10;
export const CLIMB_SECONDS = 22;

// Where the rider is `t` seconds into the ride. Heading comes from where the ride goes next.
// Boats follow one of their trips (boat-trips.ts), or `course` when the trip has bent out for a detour.
export function ridePose(
  kind: Exclude<RideKind, JumpKind>,
  launch: Point,
  t: number,
  route?: Point[],
  trip = 0,
  course?: Course | null,
): RidePose {
  if (kind === 'ferry') return withHeading(t => ferryPose(route ?? [launch], t), t);
  if (kind === 'climb') return climbPose(launch, t);
  if (kind === 'scuba') return withHeading(t => tourPose(launch, t), t);
  const path = course ?? tripCourse(kind, launch, trip);
  if (kind === 'parasail') return parasailPose(launch, t, path);
  const at = (t: number) => {
    const p = courseAt(kind, path, launch, t);
    // Jet skis hop a wave every few seconds once they're out on the water.
    const phase = t % 5.5,
      hop = kind === 'jetski' && p.k > 0.95 && phase > 4.6 ? Math.sin(((phase - 4.6) / 0.9) * Math.PI) * 0.55 : 0;
    return { x: p.x, y: hop, z: p.z, done: p.done };
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

// The tow boat runs its oval; the rider rises behind it on a long line, then lands back on the deck.
function parasailPose(launch: Point, t: number, course: Course): RidePose {
  const boat = withHeading(t => {
      const p = courseAt('parasail', course, launch, t);
      return { x: p.x, y: 0, z: p.z, done: p.done };
    }, t),
    duration = courseSeconds('parasail', course),
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

// The dive: a guided tour of the reef and the wreck (dive.ts).
export { DIVE_DEPTH };
export { GENTLE_SECONDS };
export const DIVE_SECONDS = tourSeconds(seats.find(s => s.ride?.kind === 'scuba')!.ride!.launch);

// How the rider sits in each ride (in the avatar's own frame, like seatPose). Jumps also take the
// phase of the jump and the bank of the wingsuit.
export function riderPose(kind: RideKind, t: number, depth = 0, phase?: JumpPhase, roll = 0) {
  switch (kind) {
    case 'wingsuit':
    case 'parachute':
      // Flat out in the wingsuit, tipped forward in free fall, hanging under the canopy, swimming.
      if (phase === 'fly') return { y: 0.2, pitch: Math.PI / 2 - 0.12, z: 0, roll };
      if (phase === 'fall') return { y: 0.3, pitch: 1.1, z: 0, roll: 0 };
      if (phase === 'swim') return { y: -0.3, pitch: 1.25, z: 0, roll: Math.sin(t * 3) * 0.08 };
      return { y: 0, pitch: 0, z: 0, roll: 0 };
    case 'kayak':
      return { y: -0.58, pitch: 0, z: 0, roll: 0 };
    case 'jetski':
      return { y: -0.42, pitch: 0.12, z: -0.1, roll: 0 };
    case 'sailboat':
      return { y: -0.55, pitch: 0, z: 0, roll: 0 };
    case 'ferry':
      return { y: -0.35, pitch: 0, z: 0, roll: 0 };
    case 'parasail':
      return { y: -0.55, pitch: 0, z: 0, roll: 0 };
    case 'climb':
      return { y: 0, pitch: 0.12, z: 0, roll: 0 };
    case 'scuba':
      // Lie flat and kick once under the surface.
      return { y: 0, pitch: (Math.PI / 2) * clamp01(depth / 1.2), z: 0, roll: Math.sin(t * 2.4) * 0.06 };
  }
}

// Someone on a ride right now (you or a coworker). Vehicles follow their rider; for parasailing
// the tow boat follows `boat`.
export type RideView = {
  kind: RideKind;
  t: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  roll: number;
  boat: { x: number; z: number; heading: number } | null;
  // Boats: which of the boat's trips this is, and its course if it has bent out to pass a whale or
  // dolphins (`detour` says which).
  trip: number;
  course?: Course | null;
  detour?: Sight['kind'];
  // Diving only: you've taken over from the guided tour, or you're on your way back up.
  mode?: 'free' | 'return';
  // Jumps only (`trip` is the route drawn): how far through it you are, whether it's the gentle-motion
  // version, and where you cut away.
  phase?: JumpPhase;
  gentle?: boolean;
  cut?: CutAway;
};
const isBoat = (kind: RideKind): kind is BoatKind => kind in TRIPS;
// Getting on. A boat picks one of its trips, and bends it if there's a whale or dolphins within
// reach (`sights`). A second sailor joins the boat's trip already under way, so both ride together.
// A jump draws a fresh route; `gentle` (reduced motion) floats you down at the ledge instead of flying.
export function startRide(
  seat: Seat,
  riders: Record<string, RideView>,
  sights: Sight[] = [],
  pick = Math.random(),
  gentle = false,
): RideView {
  const { kind, launch } = seat.ride!;
  const crew = Object.entries(riders).find(([id]) => id !== seat.id && id.split('-')[0] === seat.id.split('-')[0]);
  const view: RideView = {
    kind,
    t: 0,
    x: launch[0],
    y: 0,
    z: launch[1],
    heading: seat.angle,
    roll: 0,
    boat: null,
    trip: 0,
  };
  if (isJump(kind)) {
    view.y = gentlePose(kind, 0).y;
    view.trip = drawRoute(seat.id, seat.ride!.routes!.length, pick);
    view.phase = kind === 'wingsuit' ? 'fly' : 'fall';
    if (gentle) Object.assign(view, { gentle, phase: 'canopy' });
    return view;
  }
  if (kind === 'sailboat' && crew) {
    const { t, trip, course, detour } = crew[1];
    return { ...view, t, trip, course, detour };
  }
  if (isBoat(kind)) {
    view.trip = Math.min(TRIPS[kind].length - 1, Math.floor(pick * TRIPS[kind].length));
    const plan = planDetour(kind, tripCourse(kind, launch, view.trip), sights);
    if (plan) Object.assign(view, { course: plan.course, detour: plan.sight });
  }
  return view;
}
// Move a rider along; returns true when the ride is over.
export function stepRide(seat: Seat, view: RideView, dt: number) {
  view.t += dt;
  const p: RidePose = isJump(view.kind)
    ? stepJump(seat, view.kind, view)
    : ridePose(view.kind, seat.ride!.launch, view.t, seat.ride!.route, view.trip, view.course);
  if (!Number.isNaN(p.heading))
    view.heading = turnToward(view.heading, p.heading, dt, view.kind === 'climb' || isJump(view.kind) ? 6 : 3);
  Object.assign(view, { x: p.x, y: p.y, z: p.z, roll: p.roll, boat: p.boat ?? null });
  return p.done;
}
function stepJump(seat: Seat, kind: JumpKind, view: RideView) {
  const p = view.cut
    ? cutPose(view.cut, view.heading, view.t)
    : view.gentle
      ? gentlePose(kind, view.t)
      : jumpPose(kind, seat.ride!.routes![view.trip], view.t);
  view.phase = p.phase;
  return p;
}
export const jumpRoute = (seat: Seat, view?: RideView) => (view && seat.ride?.routes?.[view.trip]) || undefined;
// Where you get off: where you cut away, the jump's landing spot, the far side of the water taxi's
// crossing; nowhere special for the other rides (you're back at their step-in spot).
export function rideExit(seat: Seat, view?: RideView): Point | undefined {
  if (view?.cut) return [view.cut.x, view.cut.z];
  const route = jumpRoute(seat, view);
  return route ? route.exit : seat.ride?.exit;
}
// Cutting away from a jump (a movement key): only over land you could stand on. Out over the lake or
// the sea the jump carries on, so it never leaves you in the water.
export const canCutAway = (x: number, z: number) => walkable(x, z);
export function cutAway(view: RideView) {
  if (!isJump(view.kind) || view.cut || view.phase === 'landed' || !canCutAway(view.x, view.z)) return false;
  view.cut = { x: view.x, y: view.y, z: view.z, t: view.t };
  return true;
}
// Where the rider sits: a second seat further along the boat.
export function riderSpot(seat: Seat, view: RideView): Point {
  const deck = seat.ride?.deck ?? 0;
  return [view.x + Math.sin(view.heading) * deck, view.z + Math.cos(view.heading) * deck];
}
// Roughly how long each ride takes (the climb: up, then a while at the lookout).
// How long to allow for each ride: the boat's longest trip with room for a detour, the climb's way
// up plus a while at the lookout.
const launchOf = (kind: RideKind) => seats.find(s => s.ride?.kind === kind)!.ride!.launch;
export const RIDE_SECONDS: Record<RideKind, number> = {
  kayak: longestTrip('kayak', launchOf('kayak')),
  jetski: longestTrip('jetski', launchOf('jetski')),
  sailboat: longestTrip('sailboat', launchOf('sailboat')),
  parasail: longestTrip('parasail', launchOf('parasail')),
  climb: CLIMB_SECONDS + 20,
  scuba: DIVE_SECONDS,
  ferry: 60,
  wingsuit: Math.max(GENTLE_SECONDS, ...JUMP_ROUTES.wingsuit.map(jumpSeconds)) + 1,
  parachute: Math.max(GENTLE_SECONDS, ...JUMP_ROUTES.parachute.map(jumpSeconds)) + 1,
};

// The water taxi: along its route at a steady speed, easing away from one jetty and into the other.
const FERRY_SPEED = 4.2;
export const routeLength = (route: Point[]) =>
  route.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - route[i][0], p[1] - route[i][1]), 0);
export const ferrySeconds = (route: Point[]) => routeLength(route) / FERRY_SPEED + 3;
function ferryPose(route: Point[], t: number) {
  const total = routeLength(route),
    duration = ferrySeconds(route),
    // Constant speed, with 1.5 s of easing at each end.
    u = clamp01(t / duration),
    eased = u < 0.05 ? (u * u) / 0.1 : u > 0.95 ? 1 - ((1 - u) * (1 - u)) / 0.1 : (u - 0.025) / 0.95,
    goal = Math.min(total, Math.max(0, eased * total));
  let along = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (along + d >= goal || i === route.length - 1) {
      const f = d ? clamp01((goal - along) / d) : 1;
      return { x: a[0] + (b[0] - a[0]) * f, y: 0, z: a[1] + (b[1] - a[1]) * f, done: t >= duration };
    }
    along += d;
  }
  return { x: route[0][0], y: 0, z: route[0][1], done: true };
}
