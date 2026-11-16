import { garden, locations, seats, WHITEBOARD, WHITEBOARD_SPOT, type Point, type Seat } from './world.ts';
import type { Period } from './daylight.ts';
import { RIDE_SECONDS, type RideKind } from './rides.ts';
import { trailById, type Trail } from './highlands.ts';

// One shape for everyone on the island. Today two demo coworkers are driven locally by a small
// activity planner; later the same records will arrive from the shared presence server.
export type PresenceStatus = 'Available' | 'Focused' | 'In a meeting' | 'Away';
export type Pose = 'desk' | 'talk' | 'sip' | 'look';
export type Activity = {
  place: string;
  status: Exclude<PresenceStatus, 'Away'>;
  activity: string;
  icon: string;
  pose: Pose;
  // How long to stay once arrived, in seconds [min, max].
  dwell: [number, number];
  // Relative chance of picking this errand (home activities ignore it).
  weight?: number;
  // Preferred seats in order; the first free one is used.
  seats?: string[];
  // Or stand at a point, facing `face`.
  point?: Point;
  face?: Point;
  // Time spent here moves their current task forward.
  work?: boolean;
  // Or hike a trail on the Highlands, ending at its far end.
  trail?: Trail['id'];
};
export type Task = { title: string; icon: string; seconds: number };
export type WorkState = { task: number; progress: number };
// Each part of the day has a "home" activity and short errands the coworker pops out for.
export type Block = { home: Activity; errands: Activity[] };
export type DemoCoworker = {
  id: string;
  name: string;
  role: string;
  color: string;
  hair: string;
  greetings: string[];
  focusReply: string;
  // What their screen shows while working, and the demo backlog they cycle through.
  craft: 'design' | 'code';
  tasks: Task[];
  schedule: Record<Period, Block | null>;
};
// `point` is where they end up (the seat itself when sitting); `approach` is where they walk to first.
export type Target = {
  point: Point;
  approach: Point;
  angle: number;
  seatId: string | null;
  // How they sit there, and how high the seat is (the rooftop).
  seatKind?: Seat['kind'];
  elevation: number;
  activity: Activity;
  dwell: number;
  // For hikes: the trail they follow after reaching `approach`.
  route?: Point[];
};

export const ARRIVAL_DOCK: Point = locations[0].point;
export { WHITEBOARD, WHITEBOARD_FACING, WHITEBOARD_SPOT } from './world.ts';
const GARDEN_LOOP: Point = [garden.x, garden.z + garden.loopZ];

const coffee = (seatIds: string[], weight = 3): Activity => ({
  place: 'Café & terrace',
  status: 'Available',
  activity: 'Grabbing a coffee',
  icon: '☕',
  pose: 'sip',
  dwell: [12, 22],
  weight,
  seats: seatIds,
});

// Rides last as long as the ride (they wait at the launch for a moment after) and leave them Available.
// Hikes: the walk there and the trail itself are counted separately, so the dwell is a rest at the end.
const hike = (trail: Trail['id'], activity: string, icon: string, rest: [number, number], weight = 1): Activity => ({
  place: trailById(trail).name,
  status: 'Available',
  activity,
  icon,
  pose: 'look',
  dwell: rest,
  weight,
  trail,
});
const ride = (
  kind: RideKind,
  place: string,
  activity: string,
  icon: string,
  seatIds: string[],
  weight = 1,
): Activity => ({
  place,
  status: 'Available',
  activity,
  icon,
  pose: 'look',
  dwell: [RIDE_SECONDS[kind] + 4, RIDE_SECONDS[kind] + 12],
  weight,
  seats: seatIds,
});

export const demoCoworkers: DemoCoworker[] = [
  {
    id: 'maya',
    name: 'Maya',
    role: 'Product designer',
    color: '#7193b5',
    hair: '#2f2a28',
    greetings: [
      'Morning! Have you seen the new plaza?',
      'Hey! Grab me later if you want feedback on anything.',
      'Hi! The light in the studio today is lovely.',
    ],
    focusReply: 'Deep in focus right now. Catch you after?',
    craft: 'design',
    tasks: [
      { title: 'Onboarding flow redesign', icon: '🎨', seconds: 70 },
      { title: 'Settings page icons', icon: '🖼️', seconds: 55 },
      { title: 'Campus map polish', icon: '🗺️', seconds: 65 },
    ],
    schedule: {
      dawn: null,
      morning: {
        home: {
          place: 'Main workspace',
          status: 'Focused',
          activity: 'Sketching wireframes',
          icon: '✏️',
          pose: 'desk',
          dwell: [25, 50],
          seats: ['desk-1', 'desk-2'],
          work: true,
        },
        errands: [
          coffee(['cs-0', 'cs-1']),
          {
            place: 'Wellness garden',
            status: 'Available',
            activity: 'Stretching her legs',
            icon: '🌿',
            pose: 'look',
            dwell: [12, 28],
            weight: 1,
            seats: ['gb-0', 'gb-1'],
          },
          {
            place: 'Music corner',
            status: 'Available',
            activity: 'Playing the piano',
            icon: '🎹',
            pose: 'desk',
            dwell: [12, 28],
            weight: 1,
            seats: ['pn-0'],
          },
          hike('lake', 'A morning lap of the lake', '🥾', [10, 20]),
        ],
      },
      midday: {
        home: {
          place: 'Pavilion M',
          status: 'In a meeting',
          activity: 'Design review',
          icon: '💬',
          pose: 'talk',
          dwell: [25, 50],
          seats: ['pm-0', 'pm-1'],
        },
        errands: [
          ride('sailboat', 'Water sports', 'Sailing at lunch', '⛵', ['sb-0', 'sb-1']),
          {
            place: 'Pavilion M',
            status: 'In a meeting',
            activity: 'Pacing while she thinks',
            icon: '🤔',
            pose: 'look',
            dwell: [8, 16],
            weight: 3,
            point: [22.8, -10.83],
            face: [22.8, -14.23],
          },
          {
            place: 'Main workspace',
            status: 'In a meeting',
            activity: 'Fetching her sketches',
            icon: '📄',
            pose: 'desk',
            dwell: [10, 18],
            weight: 1,
            seats: ['desk-1', 'desk-2'],
          },
        ],
      },
      golden: {
        home: {
          place: 'Focus library',
          status: 'Focused',
          activity: 'Heads-down focus time',
          icon: '🎧',
          pose: 'look',
          dwell: [25, 50],
          seats: ['booth-1', 'booth-4'],
          work: true,
        },
        errands: [
          hike('summit', 'Hiking up to the summit', '⛰️', [20, 30]),
          ride('parasail', 'Water sports', 'Parasailing', '🪂', ['pa-0']),
          ride('climb', 'Climbing bluff', 'Climbing the bluff', '🧗', ['cl-0']),
          {
            place: 'Wellness garden',
            status: 'Available',
            activity: 'A lap of the garden',
            icon: '🦆',
            pose: 'look',
            dwell: [12, 28],
            weight: 2,
            point: GARDEN_LOOP,
            face: [garden.x, garden.z],
          },
          coffee(['cs-0', 'cs-1'], 2),
          {
            place: 'Firepit & hammocks',
            status: 'Available',
            activity: 'Swinging in a hammock',
            icon: '🌴',
            pose: 'look',
            dwell: [15, 30],
            weight: 2,
            seats: ['hm-0', 'hm-1'],
          },
          {
            place: 'Rooftop terrace',
            status: 'Available',
            activity: 'Sunset on the roof',
            icon: '☀️',
            pose: 'look',
            dwell: [15, 30],
            weight: 1,
            seats: ['rt-1', 'rt-2'],
          },
        ],
      },
      dusk: {
        home: {
          place: 'Town hall',
          status: 'Available',
          activity: 'Movie night',
          icon: '🎬',
          pose: 'look',
          dwell: [25, 50],
          seats: ['am1-2', 'am1-3'],
        },
        errands: [
          ride('sailboat', 'Water sports', 'A sunset sail', '⛵', ['sb-0', 'sb-1']),
          {
            place: 'Firepit & hammocks',
            status: 'Available',
            activity: 'Toasting marshmallows',
            icon: '🔥',
            pose: 'sip',
            dwell: [12, 28],
            weight: 1,
            seats: ['fp-0', 'fp-2'],
          },
        ],
      },
      night: null,
    },
  },
  {
    id: 'theo',
    name: 'Theo',
    role: 'Engineer',
    color: '#a88bb9',
    hair: '#7a5236',
    greetings: [
      'Hey! Coffee at the café later?',
      'Hi there! How is your day going?',
      'Yo! Just pushed a fix, feeling good.',
    ],
    focusReply: 'Head down on a bug — ping me in a bit!',
    craft: 'code',
    tasks: [
      { title: 'Fix login timeout', icon: '🐛', seconds: 55 },
      { title: 'Speed up the build', icon: '⚡', seconds: 70 },
      { title: 'Presence server spike', icon: '🛰️', seconds: 80 },
    ],
    schedule: {
      dawn: null,
      morning: {
        home: {
          place: 'Main workspace',
          status: 'Available',
          activity: 'Coding',
          icon: '💻',
          pose: 'desk',
          dwell: [25, 50],
          seats: ['desk-8', 'desk-9'],
          work: true,
        },
        errands: [
          ride('scuba', 'Fishing jetty', 'Diving on the reef', '🤿', ['dv-0']),
          { ...coffee(['cs-2', 'cs-1'], 2), activity: 'Morning coffee' },
          {
            place: 'Boardwalk',
            status: 'Available',
            activity: 'Watching the waves',
            icon: '🌊',
            pose: 'look',
            dwell: [12, 28],
            weight: 1,
            seats: ['bw-1', 'bw-3'],
          },
          {
            place: 'Fishing jetty',
            status: 'Available',
            activity: 'Fishing off the jetty',
            icon: '🎣',
            pose: 'look',
            dwell: [15, 30],
            weight: 1,
            seats: ['fs-0', 'fs-1'],
          },
        ],
      },
      midday: {
        home: {
          place: 'Pavilion M',
          status: 'In a meeting',
          activity: 'Design review',
          icon: '💬',
          pose: 'talk',
          dwell: [25, 50],
          seats: ['pm-4', 'pm-3'],
        },
        errands: [
          hike('falls', 'A walk up to the waterfall', '💧', [15, 25]),
          ride('jetski', 'Water sports', 'Out on a jet ski', '🚤', ['js-0', 'js-1']),
          {
            place: 'Pavilion M',
            status: 'In a meeting',
            activity: 'Sketching on the whiteboard',
            icon: '🖊️',
            pose: 'talk',
            dwell: [8, 16],
            weight: 3,
            point: WHITEBOARD_SPOT,
            face: WHITEBOARD,
            work: true,
          },
          {
            place: 'Café & terrace',
            status: 'In a meeting',
            activity: 'Grabbing snacks',
            icon: '🍪',
            pose: 'sip',
            dwell: [12, 28],
            weight: 1,
            seats: ['cs-2', 'cs-1'],
          },
          {
            place: 'Games lawn',
            status: 'Available',
            activity: 'Ping-pong at lunch',
            icon: '🏓',
            pose: 'look',
            dwell: [12, 24],
            weight: 1,
            seats: ['pp-1', 'pp-0'],
          },
        ],
      },
      golden: {
        home: {
          place: 'Main workspace',
          status: 'Available',
          activity: 'Shipping a fix',
          icon: '💻',
          pose: 'desk',
          dwell: [25, 50],
          seats: ['desk-8', 'desk-9'],
          work: true,
        },
        errands: [
          hike('summit', 'Racing up Summit Ridge', '⛰️', [15, 25]),
          ride('kayak', 'Fishing jetty', 'Kayaking round the island', '🛶', ['ky-0', 'ky-1']),
          ride('climb', 'Climbing bluff', 'Climbing the bluff', '🧗', ['cl-0']),
          { ...coffee(['ts-0', 'ts-1'], 2), activity: 'Coffee on the terrace' },
          {
            place: 'Pavilion S',
            status: 'In a meeting',
            activity: 'A quick 1:1',
            icon: '🗣️',
            pose: 'talk',
            dwell: [12, 28],
            weight: 1,
            seats: ['ps-0', 'ps-1'],
          },
          {
            place: 'Games lawn',
            status: 'Available',
            activity: 'Ping-pong break',
            icon: '🏓',
            pose: 'look',
            dwell: [12, 24],
            weight: 2,
            seats: ['pp-0', 'pp-1'],
          },
          {
            place: 'Games lawn',
            status: 'Available',
            activity: 'A round of cornhole',
            icon: '🎯',
            pose: 'look',
            dwell: [10, 20],
            weight: 1,
            seats: ['ch-0'],
          },
        ],
      },
      dusk: {
        home: {
          place: 'Firepit & hammocks',
          status: 'Available',
          activity: 'Toasting marshmallows',
          icon: '🔥',
          pose: 'sip',
          dwell: [25, 50],
          seats: ['fp-1', 'fp-3'],
        },
        errands: [
          ride('sailboat', 'Water sports', 'A sunset sail', '⛵', ['sb-1', 'sb-0']),
          {
            place: 'Town hall',
            status: 'Available',
            activity: 'Movie night',
            icon: '🎬',
            pose: 'look',
            dwell: [12, 28],
            weight: 2,
            seats: ['am1-4', 'am1-3'],
          },
          {
            place: 'Boardwalk',
            status: 'Available',
            activity: 'Watching the sunset',
            icon: '🌅',
            pose: 'look',
            dwell: [12, 28],
            weight: 1,
            seats: ['bw-2', 'bw-1'],
          },

          {
            place: 'Café & terrace',
            status: 'Available',
            activity: 'Sunset on the terrace',
            icon: '🍹',
            pose: 'sip',
            dwell: [12, 28],
            weight: 1,
            seats: ['ts-2', 'ts-5'],
          },
        ],
      },
      night: null,
    },
  },
];

// Home → weighted errand → home → … Coworkers always return home between errands.
export function nextActivity(block: Block, current: Activity | null, random = Math.random): Activity {
  if (!current || current !== block.home || !block.errands.length) return block.home;
  const total = block.errands.reduce((sum, e) => sum + (e.weight ?? 1), 0);
  let roll = random() * total;
  for (const errand of block.errands) {
    roll -= errand.weight ?? 1;
    if (roll < 0) return errand;
  }
  return block.errands[block.errands.length - 1];
}

// Working time moves the current task forward; finishing starts the next task in the backlog.
export function advanceWork(
  person: DemoCoworker,
  state: WorkState,
  seconds: number,
): { state: WorkState; finished: Task | null } {
  const task = person.tasks[state.task % person.tasks.length];
  const progress = state.progress + seconds / task.seconds;
  if (progress < 1) return { state: { task: state.task, progress }, finished: null };
  return { state: { task: (state.task + 1) % person.tasks.length, progress: 0 }, finished: task };
}
export const currentTask = (person: DemoCoworker, state: WorkState) => person.tasks[state.task % person.tasks.length];

// `taken` holds seats already in use (by you or another coworker).
export function resolveTarget(
  activity: Activity | null,
  taken: ReadonlySet<string> = new Set(),
  random = Math.random,
): Target | null {
  if (!activity) return null;
  const dwell = activity.dwell[0] + (activity.dwell[1] - activity.dwell[0]) * random();
  if (activity.trail) {
    const points = trailById(activity.trail).points,
      [a, b] = points.slice(-2);
    return {
      point: points[points.length - 1],
      approach: points[0],
      angle: Math.atan2(b[0] - a[0], b[1] - a[1]),
      seatId: null,
      elevation: 0,
      activity,
      dwell,
      route: points,
    };
  }
  if (activity.seats) {
    const id = activity.seats.find(s => !taken.has(s)) ?? activity.seats[0];
    const seat = seats.find(s => s.id === id);
    if (!seat) throw new Error(`Unknown seat ${id}`);
    return {
      point: seat.point,
      approach: seat.approach,
      angle: seat.angle,
      seatId: seat.id,
      seatKind: seat.kind,
      elevation: seat.y ?? 0,
      activity,
      dwell,
    };
  }
  const point = activity.point!,
    face = activity.face ?? point;
  return {
    point,
    approach: point,
    angle: Math.atan2(face[0] - point[0], face[1] - point[1]),
    seatId: null,
    elevation: 0,
    activity,
    dwell,
  };
}

// Positions are written every frame by the scene and read by the map / proximity checks.
export const peopleView: Record<string, { x: number; z: number; present: boolean }> = {};
