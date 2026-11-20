import { shoreDistance, shorePoint } from './shoreline.ts';
import { highlandsDistance, highlandsPoint } from './highlands.ts';
import { periodAtHour, type Period } from './daylight.ts';
import { whalePose, WHALES } from './open-sea.ts';
import { clear, coastAngle, DOCKS } from './boat-trips.ts';
import { cruisePier, pierPoint, type Point } from './world.ts';

// The Island Queen: a big passenger boat that sails from the cruise pier on a timetable. Everything
// here is a pure function of the wall clock, so every browser sees the same sailing at the same moment:
// boarding at the berth, the bell, the trip, and back to the berth for the next one.
// While you're aboard, where you stand is a point (u, v) on the deck, in the boat's own frame:
// u across (positive towards the pier side), v along (positive towards the bow).

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// ---- The timetable ----
// A minute at the berth to board (the bell rings 15 s before she casts off), then the trip. Every trip
// takes the same time; the boat's speed is set by the route.
export const BOARD_SECONDS = 60,
  BELL_SECONDS = 15,
  TRIP_SECONDS = 210,
  CYCLE_SECONDS = BOARD_SECONDS + TRIP_SECONDS;
// The gangway takes a few seconds to come down and go up; she leaves and comes in slowly.
const GANGWAY_SECONDS = 3,
  DEPART_SECONDS = 10,
  ARRIVE_SECONDS = 12,
  RAMP_SECONDS = 14;
export type CruisePhase = 'boarding' | 'departing' | 'sailing' | 'arriving';
export type CruiseTrip = 'loop' | 'highlands' | 'sunset' | 'whales';
export const TRIP_NAMES: Record<CruiseTrip, string> = {
  loop: 'Island loop',
  highlands: 'Highlands cruise',
  sunset: 'Sunset cruise',
  whales: 'Whale run',
};
export const BOAT_NAME = 'Island Queen';

// The trip is chosen by the time of day at the company (New York), not the viewer's own clock or
// mood setting, so every browser agrees. Sunset cruises take the island loop's turn in the evening.
const COMPANY_CLOCK = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});
export function companyHour(ms: number) {
  const parts = Object.fromEntries(COMPANY_CLOCK.formatToParts(new Date(ms)).map(p => [p.type, p.value]));
  return (Number(parts.hour) % 24) + Number(parts.minute) / 60 + Number(parts.second) / 3600;
}
export const companyPeriod = (ms: number): Period => periodAtHour(companyHour(ms));
const ROTATION: CruiseTrip[] = ['loop', 'highlands', 'whales'];
// When sailing `n` casts off (ms since the epoch); its boarding starts a minute before.
export const departsAt = (sailing: number) => (sailing * CYCLE_SECONDS + BOARD_SECONDS) * 1000;
export function tripFor(sailing: number): CruiseTrip {
  const trip = ROTATION[((sailing % ROTATION.length) + ROTATION.length) % ROTATION.length],
    period = companyPeriod(departsAt(sailing));
  return trip === 'loop' && (period === 'golden' || period === 'dusk') ? 'sunset' : trip;
}

export type Sailing = {
  // Which sailing this is (the boat is boarding for it, or out on it).
  sailing: number;
  trip: CruiseTrip;
  phase: CruisePhase;
  // Seconds into the phase's part of the cycle: into boarding, or into the trip.
  t: number;
  // Seconds until the next departure (this sailing's while boarding) and until the boat is back.
  departsIn: number;
  backIn: number;
};
export function sailingAt(now: number): Sailing {
  const s = now / 1000,
    sailing = Math.floor(s / CYCLE_SECONDS),
    into = s - sailing * CYCLE_SECONDS,
    trip = tripFor(sailing);
  if (into < BOARD_SECONDS)
    return {
      sailing,
      trip,
      phase: 'boarding',
      t: into,
      departsIn: BOARD_SECONDS - into,
      backIn: BOARD_SECONDS - into + TRIP_SECONDS,
    };
  const t = into - BOARD_SECONDS;
  return {
    sailing,
    trip,
    phase: t < DEPART_SECONDS ? 'departing' : t >= TRIP_SECONDS - ARRIVE_SECONDS ? 'arriving' : 'sailing',
    t,
    departsIn: CYCLE_SECONDS - into + BOARD_SECONDS,
    backIn: TRIP_SECONDS - t,
  };
}
// The gangway is down (0–1): lowering as boarding starts, raised as she casts off.
export function gangwayDown(now: number) {
  const s = sailingAt(now);
  if (s.phase === 'boarding') return smooth(s.t / GANGWAY_SECONDS);
  return s.t < GANGWAY_SECONDS ? 1 - smooth(s.t / GANGWAY_SECONDS) : 0;
}
// You can walk on or off only while the gangway is all the way down.
export const gangwayOpen = (now: number) => {
  const s = sailingAt(now);
  return s.phase === 'boarding' && s.t >= GANGWAY_SECONDS;
};
// The bell rings (0–1 through the ring) 15 s before departure.
export function bellRing(now: number) {
  const s = sailingAt(now),
    since = s.phase === 'boarding' ? s.t - (BOARD_SECONDS - BELL_SECONDS) : -1;
  return since >= 0 && since < 3 ? since / 3 : -1;
}
export const clockText = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// ---- The berth and the routes ----
// The boat lies alongside the T-head, bow to the north-east, its pier side (+u) to the pier.
export const HULL_HALF_WIDTH = 2.2,
  HULL_HALF_LENGTH = 5.5;
const forward: Point = [cruisePier.dz, -cruisePier.dx],
  seaward: Point = [cruisePier.dx, cruisePier.dz];
const [berthX, berthZ] = pierPoint(cruisePier.length + 0.5 + HULL_HALF_WIDTH, 0);
export type BoatPose = { x: number; z: number; heading: number; roll: number; pitch: number; heave: number };
export const BERTH: BoatPose = {
  x: berthX,
  z: berthZ,
  heading: Math.atan2(forward[0], forward[1]),
  roll: 0,
  pitch: 0,
  heave: 0,
};
// A point `ahead` along the boat's berth line and `out` to sea from it.
const off = (ahead: number, out = 0): Point => [
  berthX + forward[0] * ahead + seaward[0] * out,
  berthZ + forward[1] * ahead + seaward[1] * out,
];

export type Route = { points: Point[]; lengths: number[]; total: number; whale: number | null };
const measure = (points: Point[], whale: number | null = null): Route => {
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return { points, lengths, total: lengths[lengths.length - 1], whale };
};
export function routePoint(route: Route, distance: number): Point {
  const { points, lengths } = route,
    goal = Math.max(0, Math.min(route.total, distance));
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
const catmull = (a: number, b: number, c: number, d: number, t: number) =>
  0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
// Leaving the berth straight ahead, and coming back in from astern on the same line.
const OUT: Point[] = [off(0), off(5), off(11)],
  IN: Point[] = [off(-16, 1.5), off(-10), off(-5), off(0)];
// The route's ends (the berth lanes) stay exactly on the line; everything else is kept off the land and
// the docks, and smoothed so she turns gently.
const LAND = 8,
  DOCK = 6,
  FIXED_START = 9,
  FIXED_END = 9;
function build(middle: Point[], whale: number | null = null): Route {
  // Long legs are split up first, so the curve keeps to them instead of swinging wide at the next corner.
  const control = [...OUT, ...middle, ...IN].flatMap((p, i, all): Point[] => {
      if (!i) return [p];
      const q = all[i - 1],
        parts = Math.ceil(Math.hypot(p[0] - q[0], p[1] - q[1]) / 4);
      return Array.from(
        { length: parts },
        (_, k): Point => [q[0] + ((p[0] - q[0]) * (k + 1)) / parts, q[1] + ((p[1] - q[1]) * (k + 1)) / parts],
      );
    }),
    n = control.length,
    at = (i: number): Point =>
      i < 0
        ? [2 * control[0][0] - control[1][0], 2 * control[0][1] - control[1][1]]
        : i >= n
          ? [2 * control[n - 1][0] - control[n - 2][0], 2 * control[n - 1][1] - control[n - 2][1]]
          : control[i],
    dense: Point[] = [];
  for (let i = 0; i < n - 1; i++)
    for (let step = 0; step < 8; step++) {
      const t = step / 8,
        [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      dense.push([catmull(a[0], b[0], c[0], d[0], t), catmull(a[1], b[1], c[1], d[1], t)]);
    }
  dense.push(control[n - 1]);
  const rough = measure(dense),
    count = Math.max(60, Math.round(rough.total / 1)),
    even = Array.from({ length: count + 1 }, (_, i) => routePoint(rough, (i / count) * rough.total)),
    free = (i: number) => (i / count) * rough.total > FIXED_START && ((count - i) / count) * rough.total > FIXED_END;
  let points = even.map((p, i) => (free(i) ? clear(p, LAND, DOCK) : p));
  for (let pass = 0; pass < 24; pass++)
    points = points.map((p, i): Point => {
      if (!free(i)) return p;
      const a = points[i - 1],
        b = points[i + 1];
      return clear([(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4], LAND, DOCK);
    });
  return measure(points, whale);
}
const range = (from: number, to: number, step: number): number[] => {
  const count = Math.max(2, Math.ceil(Math.abs(to - from) / step) + 1);
  return Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));
};
const landDistance = (x: number, z: number) => Math.min(shoreDistance(x, z), highlandsDistance(x, z));
function openWater(a: Point, b: Point, margin: number) {
  const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5);
  for (let i = 0; i <= steps; i++)
    if (landDistance(a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps) < margin) return false;
  return true;
}
// Round the office island the long way: up the east coast, past the bluff and through the strait under
// the rope bridge, down the west coast and home along the south shore.
const loop = () => {
  const from = coastAngle(off(16)),
    to = coastAngle(off(-40, 4)) - Math.PI * 2;
  return range(from, to, 0.12).map(a => shorePoint(a, 11));
};
// Coming home from out at sea: past the berth, round in a wide turn, and in along the berth line.
const HOOK: Point[] = [off(-14, 14), off(-26, 14), off(-32, 8), off(-27, 2.5)];
// Up the east coast to the Highlands' south-east shore, and back down further out.
const highlands = (): Point[] => [
  ...range(coastAngle(off(16)), -0.8, 0.14).map(a => shorePoint(a, 10)),
  ...range(1, 0.5, 0.25).map(a => highlandsPoint(a, 11)),
  [64, -68],
  [68, -52],
  ...range(-0.3, 0.35, 0.2).map(a => shorePoint(a, 21)),
  off(8, 16),
  ...HOOK,
];
// A slow, wide loop out to sea and back, for watching the sun go down.
const sunset = (): Point[] => [off(18, 6), off(16, 22), off(4, 34), off(-12, 32), off(-22, 18), off(-22, 6)];
// Out to where a whale will be halfway through the trip, round it at a respectful distance, and home.
const GATE = off(18, 8),
  HOME = off(-14, 14),
  STANDOFF = 9,
  REACH = 140;
const SEA = { minX: -94, maxX: 99, minZ: -139, maxZ: 66 };
export const whaleClock = (ms: number) => (ms / 1000) % 86400;
export function whaleMeet(sailing: number) {
  const t = whaleClock(departsAt(sailing) + (TRIP_SECONDS * 1000) / 2);
  let best: { whale: number; at: Point } | null = null,
    nearest = Infinity;
  for (let whale = 0; whale < WHALES; whale++) {
    const p = whalePose(whale, t),
      at: Point = [p.x, p.z],
      d = Math.hypot(at[0] - GATE[0], at[1] - GATE[1]);
    if (p.presence < 0.5 || d > REACH || d < 25 || d >= nearest) continue;
    if (at[0] < SEA.minX + STANDOFF || at[0] > SEA.maxX - STANDOFF) continue;
    if (at[1] < SEA.minZ + STANDOFF || at[1] > SEA.maxZ - STANDOFF) continue;
    if (landDistance(...at) < LAND + STANDOFF || !openWater(GATE, at, LAND + 2) || !openWater(at, HOME, LAND + 2))
      continue;
    best = { whale, at };
    nearest = d;
  }
  return best;
}
// No whale within reach this time: out to the south-east shoals, where they often pass.
const SHOALS: Point = [64, 46];
function whales(sailing: number): { middle: Point[]; whale: number | null } {
  const meet = whaleMeet(sailing),
    [cx, cz] = meet?.at ?? SHOALS,
    // A whale astern (south or south-west of the berth): swing round out to sea first, and come home
    // straight into the berth line from that side.
    astern = (cx - berthX) * forward[0] + (cz - berthZ) * forward[1] < 10,
    lead: Point[] = astern ? [off(18, 6), off(14, 18)] : [off(18, 5)],
    tail: Point[] = astern ? [off(-34, 12), off(-27, 2.5)] : HOOK,
    from = lead[lead.length - 1],
    // Joining the circle and leaving it on a tangent: heading in from `from`, out towards home.
    travelIn = Math.atan2(cz - from[1], cx - from[0]),
    travelOut = Math.atan2(tail[0][1] - cz, tail[0][0] - cx),
    turn = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
    // Round it at least halfway, whichever way is shorter.
    [way, start, sweep] = [1, -1]
      .map(way => {
        const start = travelIn - (way * Math.PI) / 2,
          left = turn(way * (travelOut - (way * Math.PI) / 2 - start));
        return [way, start, left < Math.PI ? left + Math.PI * 2 : left];
      })
      .reduce((a, b) => (a[2] <= b[2] ? a : b));
  const ring = range(0, sweep, 0.3).map(
    (da): Point => [cx + Math.cos(start + way * da) * STANDOFF, cz + Math.sin(start + way * da) * STANDOFF],
  );
  return { middle: [...lead, ...ring, ...tail], whale: meet?.whale ?? null };
}

const routes = new Map<number, Route>();
const fixed = new Map<CruiseTrip, Route>();
// The route sailing `n` takes (the whale run is worked out for that sailing's whales).
export function cruiseRoute(sailing: number): Route {
  const trip = tripFor(sailing);
  if (trip !== 'whales') {
    let route = fixed.get(trip);
    if (!route)
      fixed.set(trip, (route = build(trip === 'loop' ? loop() : trip === 'highlands' ? highlands() : sunset())));
    return route;
  }
  let route = routes.get(sailing);
  if (!route) {
    const plan = whales(sailing);
    if (routes.size > 50) routes.clear();
    routes.set(sailing, (route = build(plan.middle, plan.whale)));
  }
  return route;
}

// How far along the route she is, 0–1, `t` seconds into the trip: still while the gangway goes up,
// easing up to speed, steady, and easing into the berth.
const MOVING = TRIP_SECONDS - 2 * GANGWAY_SECONDS;
export function tripProgress(t: number) {
  const u = clamp01((t - GANGWAY_SECONDS) / MOVING),
    a = RAMP_SECONDS / MOVING;
  if (u < a) return (u * u) / (2 * a * (1 - a));
  if (u > 1 - a) return 1 - ((1 - u) * (1 - u)) / (2 * a * (1 - a));
  return (u - a / 2) / (1 - a);
}
// Her top speed on a route (units a second).
export const routeSpeed = (route: Route) => route.total / (MOVING * (1 - RAMP_SECONDS / MOVING));
const headingAt = (route: Route, d: number) => {
  const a = routePoint(route, d - 1.5),
    b = routePoint(route, d + 1.5);
  return Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6 ? BERTH.heading : Math.atan2(b[0] - a[0], b[1] - a[1]);
};
// Where the boat is at `now` (ms since the epoch). Gentle roll and pitch on the swell, and a lean into
// turns, unless `motion` is off.
export function boatPose(now: number, motion = true): BoatPose {
  const s = sailingAt(now),
    time = now / 1000,
    swell = motion
      ? {
          roll: Math.sin(time * 0.7) * 0.012,
          pitch: Math.sin(time * 0.53 + 1) * 0.01,
          heave: Math.sin(time * 1.1) * 0.04,
        }
      : { roll: 0, pitch: 0, heave: 0 };
  if (s.phase === 'boarding') return { ...BERTH, ...swell };
  const route = cruiseRoute(s.sailing),
    f = tripProgress(s.t),
    d = f * route.total,
    [x, z] = routePoint(route, d),
    heading = headingAt(route, d),
    speed = (tripProgress(s.t + 0.5) - tripProgress(s.t - 0.5)) * route.total,
    turn = wrap(headingAt(route, d + 1.5) - headingAt(route, d - 1.5)) / 3;
  return {
    x,
    z,
    heading,
    roll: motion ? swell.roll + Math.max(-0.07, Math.min(0.07, -turn * speed * 0.5)) : 0,
    pitch: swell.pitch,
    heave: swell.heave,
  };
}

// ---- The deck ----
// Deck height above the water line (where people stand), in world units.
export const DECK_Y = 0.42;
const toWorldOn = (pose: { x: number; z: number; heading: number }, u: number, v: number): Point => {
  const c = Math.cos(pose.heading),
    s = Math.sin(pose.heading);
  return [pose.x + u * c + v * s, pose.z - u * s + v * c];
};
export const toWorld = toWorldOn;
export function toDeck(pose: { x: number; z: number; heading: number }, x: number, z: number): Point {
  const c = Math.cos(pose.heading),
    s = Math.sin(pose.heading),
    dx = x - pose.x,
    dz = z - pose.z;
  return [dx * c - dz * s, dx * s + dz * c];
}
// A world direction turned into the deck's frame.
export const deckDirection = (heading: number, dx: number, dz: number): Point =>
  toDeck({ x: 0, z: 0, heading }, dx, dz);
// Where you can walk: inside the rail, round the wheelhouse.
export const HULL: Point[] = [
  [-1.9, -5.2],
  [1.9, -5.2],
  [1.9, 2.6],
  [1.25, 4.2],
  [0, 5.1],
  [-1.25, 4.2],
  [-1.9, 2.6],
];
export const WHEELHOUSE = { u: 0.95, v0: 0.4, v1: 2.6 };
// The gangway runs from the deck edge on the pier side out over the T-head; past LEAVE_U you're on the pier.
export const GANGWAY = { v: -0.4, half: 0.5, deck: 1.9, foot: 3.4 };
export const LEAVE_U = 2.95;
// The far end, standing on the pier, and the top, standing on the deck.
export const GANGWAY_FOOT: Point = [3.3, GANGWAY.v],
  GANGWAY_TOP: Point = [1.55, GANGWAY.v];
function inPolygon(u: number, v: number, poly: Point[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ui, vi] = poly[i],
      [uj, vj] = poly[j];
    if (vi > v !== vj > v && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) inside = !inside;
  }
  return inside;
}
const inWheelhouse = (u: number, v: number) => Math.abs(u) < WHEELHOUSE.u && v > WHEELHOUSE.v0 && v < WHEELHOUSE.v1;
export const onGangway = (u: number, v: number) =>
  u >= GANGWAY.deck - 0.05 && u <= GANGWAY.foot && Math.abs(v - GANGWAY.v) <= GANGWAY.half - 0.1;
export const onDeck = (u: number, v: number, open: boolean) =>
  (inPolygon(u, v, HULL) && !inWheelhouse(u, v)) || (open && onGangway(u, v));
// The nearest point on deck to (u, v), for when the gangway goes up under you.
function settle(u: number, v: number): Point {
  let p: Point = [Math.max(-1.85, Math.min(1.85, u)), Math.max(-5.15, Math.min(4, v))];
  if (inWheelhouse(...p)) {
    const sides: Point[] = [
      [WHEELHOUSE.u + 0.05, p[1]],
      [-WHEELHOUSE.u - 0.05, p[1]],
      [p[0], WHEELHOUSE.v0 - 0.05],
    ];
    p = sides.reduce((a, b) => (Math.hypot(a[0] - u, a[1] - v) <= Math.hypot(b[0] - u, b[1] - v) ? a : b));
  }
  return p;
}
// One step on deck: slide along the rail and the wheelhouse rather than through them.
export function deckStep(from: Point, to: Point, open: boolean): Point {
  if (onDeck(to[0], to[1], open)) return to;
  if (onDeck(to[0], from[1], open)) return [to[0], from[1]];
  if (onDeck(from[0], to[1], open)) return [from[0], to[1]];
  return onDeck(from[0], from[1], open) ? from : settle(...from);
}
// Walking off: out along the gangway onto the pier while it's down.
export const leavesDeck = ([u, v]: Point, open: boolean) => open && onGangway(u, v) && u >= LEAVE_U;
// Walking on: a step from the pier onto the gangway while it's down gives your place on deck.
export function boardAt(x: number, z: number, now: number): Point | null {
  if (!gangwayOpen(now)) return null;
  const [u, v] = toDeck(BERTH, x, z);
  return onGangway(u, v) && u < LEAVE_U - 0.05 ? [u, v] : null;
}
// Height of the floor under you: the deck, sloping down the gangway to the pier.
export const deckFloor = (u: number) => DECK_Y * (1 - clamp01((u - GANGWAY.deck) / (2.75 - GANGWAY.deck)));
// A walk between two points on deck: straight across the open deck, or up a side of the wheelhouse.
export function deckRoute(from: Point, to: Point): Point[] {
  const fore = (p: Point) => p[1] > WHEELHOUSE.v0 - 0.2;
  if (fore(from) === fore(to)) return [to];
  const ahead = fore(from) ? from : to,
    side = ahead[0] < 0 ? -1 : 1,
    lane = side * 1.42,
    route: Point[] = [
      [lane, WHEELHOUSE.v0 - 0.3],
      [lane, WHEELHOUSE.v1 + 0.3],
    ];
  return [...(fore(from) ? route.reverse() : route), to];
}

// Deck spots: benches along the rails, loungers on the sun deck aft, and places to lean on the rail.
// `angle` is the way you face, relative to the bow; `step` is where you stand to get in and out.
export type DeckSpot = {
  id: string;
  name: string;
  u: number;
  v: number;
  angle: number;
  kind: 'bench' | 'lounger' | 'stand';
  step: Point;
};
const spot = (i: number, name: string, u: number, v: number, angle: number, kind: DeckSpot['kind'], step: Point) => ({
  id: `iq-${i}`,
  name,
  u,
  v,
  angle,
  kind,
  step,
});
const R = Math.PI / 2;
export const DECK_SPOTS: DeckSpot[] = [
  spot(0, 'Rail bench', 1.25, -2.6, R, 'bench', [0.55, -2.6]),
  spot(1, 'Rail bench', 1.25, -1.4, R, 'bench', [0.55, -1.4]),
  spot(2, 'Rail bench', -1.25, -2.6, -R, 'bench', [-0.55, -2.6]),
  spot(3, 'Rail bench', -1.25, -1.4, -R, 'bench', [-0.55, -1.4]),
  spot(4, 'Sun lounger', 0.72, -4.2, Math.PI, 'lounger', [0, -3.7]),
  spot(5, 'Sun lounger', -0.72, -4.2, Math.PI, 'lounger', [0, -3.7]),
  spot(6, 'At the rail', -1.6, -0.3, -R, 'stand', [-1.2, -0.3]),
  spot(7, 'At the rail', 1.6, 0.9, R, 'stand', [1.3, 0.9]),
  spot(8, 'At the bow', -0.55, 3.6, 0, 'stand', [-0.5, 3.3]),
  spot(9, 'At the bow', 0.55, 3.6, 0, 'stand', [0.5, 3.3]),
  spot(10, 'Right at the bow', 0, 4.5, 0, 'stand', [0, 4.15]),
  spot(11, 'At the rail', -1.6, 1.6, -R, 'stand', [-1.25, 1.6]),
];
export const DECK_SPOT_IDS = DECK_SPOTS.map(s => s.id);
export const deckSpot = (id: string | null | undefined) => DECK_SPOTS.find(s => s.id === id);
export const isDeckSpot = (id: string | null | undefined) => !!deckSpot(id);
// The first free spot, in order of preference.
export const freeDeckSpot = (taken: ReadonlySet<string>, preferred: string[] = DECK_SPOT_IDS) =>
  preferred.find(id => isDeckSpot(id) && !taken.has(id)) ?? null;
// The captain stands at the wheel (scenery, not a seat).
export const CAPTAIN: Point = [0, 1.75];
// Where people wait on the T-head for the boat to come in: a place each, either side of the gangway.
const WAITS: Point[] = [-1.6, 0.8, -2.4, 1.6, -3.2, 2.4, -1.2, 1.2, -2.0, 2.0, -2.8, 2.8].map((across, i) =>
  pierPoint(cruisePier.length - (i < 6 ? 0.9 : 1.8), across),
);
export const pierWait = (id: string) => WAITS[Math.max(0, DECK_SPOT_IDS.indexOf(id))];

// ---- Passengers ----
// What someone does in their deck spot, changing every little while: lean on the rail, wave, take a
// photo, doze off, or just look out. Pure in time so a passenger's mood carries on smoothly.
export type DeckIdle = 'lean' | 'wave' | 'photo' | 'doze' | 'look';
export const DECK_IDLE_ICONS: Record<DeckIdle, string> = {
  lean: '🌊',
  wave: '👋',
  photo: '📸',
  doze: '💤',
  look: '🛳️',
};
export function deckIdle(seed: number, seconds: number, kind: DeckSpot['kind']): DeckIdle {
  const block = Math.floor(seconds / 9 + seed * 3.7),
    roll = Math.abs(Math.sin(block * 12.9898 + seed * 78.233) * 43758.5453) % 1;
  if (kind === 'lounger') return roll < 0.55 ? 'doze' : roll < 0.8 ? 'look' : 'photo';
  if (kind === 'stand') return roll < 0.4 ? 'lean' : roll < 0.65 ? 'photo' : roll < 0.85 ? 'wave' : 'look';
  return roll < 0.35 ? 'look' : roll < 0.6 ? 'wave' : roll < 0.8 ? 'photo' : 'doze';
}

// A passenger's trip, in stages: waiting on the pier, walking aboard, aboard for one sailing, walking
// off, and done (back on the pier). `step` moves them on; `sailing` is the one they boarded for.
export type Voyage = { stage: 'pier' | 'boarding' | 'aboard' | 'leaving' | 'done'; sailing: number };
// Boarding needs a few seconds in hand to reach a deck spot before the gangway goes up.
const BOARD_IN_HAND = 8;
export function voyageStep(voyage: Voyage, now: number, walking: boolean): Voyage {
  const s = sailingAt(now),
    open = gangwayOpen(now);
  switch (voyage.stage) {
    case 'pier':
      return !walking && open && s.departsIn > BOARD_IN_HAND ? { stage: 'boarding', sailing: s.sailing } : voyage;
    case 'boarding':
      // Aboard once there, or (just in case) when she casts off.
      return !walking || s.sailing !== voyage.sailing || s.phase !== 'boarding'
        ? { ...voyage, stage: 'aboard' }
        : voyage;
    case 'aboard':
      // Back at the berth after the sailing they boarded for, with the gangway down.
      return open && s.sailing > voyage.sailing ? { ...voyage, stage: 'leaving' } : voyage;
    case 'leaving':
      return walking ? voyage : { ...voyage, stage: 'done' };
    default:
      return voyage;
  }
}
// The walk aboard from the pier to a deck spot, and the walk back off (in world points; the boat is
// at her berth whenever anyone walks on or off).
export function boardingWalk(spot: DeckSpot): Point[] {
  return [GANGWAY_FOOT, GANGWAY_TOP, ...deckRoute(GANGWAY_TOP, spot.step), [spot.u, spot.v]].map(([u, v]) =>
    toWorld(BERTH, u, v),
  );
}
export function leavingWalk(spot: DeckSpot, wait = pierWait(spot.id)): Point[] {
  return [spot.step, ...deckRoute(spot.step, GANGWAY_TOP), GANGWAY_FOOT]
    .map(([u, v]) => toWorld(BERTH, u, v))
    .concat([wait]);
}
// Height of the floor at a world point near the berth: the deck, the gangway, or the pier.
export function berthFloor(x: number, z: number) {
  const [u, v] = toDeck(BERTH, x, z);
  if (onGangway(u, v)) return deckFloor(u);
  return inPolygon(u, v, HULL) ? DECK_Y : 0;
}

// The routes keep off land and the other docks; the tests check this along every sailing.
export const CRUISE_DOCKS = DOCKS;
