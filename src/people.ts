import { garden, locations, seats, WHITEBOARD, WHITEBOARD_SPOT, type Point } from './world.ts';
import type { Period } from './daylight.ts';

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
  activity: Activity;
  dwell: number;
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
          {
            place: 'Pavilion M',
            status: 'In a meeting',
            activity: 'Pacing while she thinks',
            icon: '🤔',
            pose: 'look',
            dwell: [8, 16],
            weight: 3,
            point: [19, -10.6],
            face: [19, -14],
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
        ],
      },
      dusk: null,
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
        ],
      },
      dusk: {
        home: {
          place: 'Boardwalk',
          status: 'Available',
          activity: 'Winding down by the sea',
          icon: '🌅',
          pose: 'look',
          dwell: [25, 50],
          seats: ['bw-2', 'bw-1'],
        },
        errands: [
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
  if (activity.seats) {
    const id = activity.seats.find(s => !taken.has(s)) ?? activity.seats[0];
    const seat = seats.find(s => s.id === id);
    if (!seat) throw new Error(`Unknown seat ${id}`);
    return { point: seat.point, approach: seat.approach, angle: seat.angle, seatId: seat.id, activity, dwell };
  }
  const point = activity.point!,
    face = activity.face ?? point;
  return {
    point,
    approach: point,
    angle: Math.atan2(face[0] - point[0], face[1] - point[1]),
    seatId: null,
    activity,
    dwell,
  };
}

// Positions are written every frame by the scene and read by the map / proximity checks.
export const peopleView: Record<string, { x: number; z: number; present: boolean }> = {};
