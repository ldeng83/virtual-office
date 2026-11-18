import { garden, locations, seats, WHITEBOARD, WHITEBOARD_SPOT, type Point, type Seat } from './world.ts';
import type { Period } from './daylight.ts';
import { RIDE_SECONDS, type RideKind } from './rides.ts';
import { trailById, type Trail } from './highlands.ts';

// One shape for everyone on the island. Today the team's demo coworkers are driven locally by a small
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
  // Long hair reaches past the shoulders.
  hairStyle?: 'short' | 'long';
  // Skin and trouser colours, when a host supplies them.
  skin?: string;
  bottoms?: string;
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

export const coffee = (seatIds: string[], weight = 3): Activity => ({
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
export const hike = (
  trail: Trail['id'],
  activity: string,
  icon: string,
  rest: [number, number],
  weight = 1,
): Activity => ({
  place: trailById(trail).name,
  status: 'Available',
  activity,
  icon,
  pose: 'look',
  dwell: rest,
  weight,
  trail,
});
export const ride = (
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

// Shorthand for the newer roster entries: `home` is a block's base activity, `spot` an errand.
const home = (
  place: string,
  status: Activity['status'],
  activity: string,
  icon: string,
  pose: Pose,
  seatIds: string[],
  work = false,
): Activity => ({ place, status, activity, icon, pose, dwell: [25, 50], seats: seatIds, ...(work && { work }) });
export const spot = (
  place: string,
  status: Activity['status'],
  activity: string,
  icon: string,
  pose: Pose,
  seatIds: string[],
  weight = 1,
  dwell: [number, number] = [12, 28],
): Activity => ({ place, status, activity, icon, pose, dwell, weight, seats: seatIds });

const aaron: DemoCoworker = {
  id: 'aaron-wang',
  name: 'Aaron Wang',
  role: 'Teammate',
  color: '#7b9c79',
  hair: '#1f1b19',
  greetings: [
    'Hey! Want to see what I’m sketching?',
    'Morning! The café has a new pastry, go try it.',
    'Hi! Sunset sail later? There’s room on the boat.',
  ],
  focusReply: 'Heads down on a layout right now. Back soon!',
  craft: 'design',
  tasks: [
    { title: 'Sign-in page refresh', icon: '🎨', seconds: 65 },
    { title: 'MFA setup screens', icon: '🔐', seconds: 60 },
    { title: 'Admin console icons', icon: '🖼️', seconds: 55 },
  ],
  schedule: {
    dawn: null,
    morning: {
      home: home('Main workspace', 'Focused', 'Designing screens', '✏️', 'desk', ['desk-3', 'desk-4'], true),
      errands: [
        coffee(['cs-1', 'cs-0']),
        ride('kayak', 'Fishing jetty', 'A morning paddle', '🛶', ['ky-1', 'ky-0']),
        spot('Wellness garden', 'Available', 'Sitting by the pond', '🌿', 'look', ['gb-2', 'gb-1']),
      ],
    },
    midday: {
      home: home('Pavilion M', 'In a meeting', 'Design review', '💬', 'talk', ['pm-1', 'pm-2']),
      errands: [
        ride('jetski', 'Water sports', 'Out on a jet ski', '🚤', ['js-1', 'js-0']),
        spot('Games lawn', 'Available', 'Ping-pong at lunch', '🏓', 'look', ['pp-0', 'pp-1'], 1, [12, 24]),
        spot('Café & terrace', 'Available', 'Lunch on the terrace', '🥗', 'sip', ['ts-4', 'ts-5'], 2),
      ],
    },
    golden: {
      home: home('Main workspace', 'Focused', 'Polishing mockups', '🎨', 'desk', ['desk-3', 'desk-4'], true),
      errands: [
        ride('climb', 'Climbing bluff', 'Climbing the bluff', '🧗', ['cl-0']),
        hike('lake', 'A walk round the lake', '🥾', [10, 20]),
        spot('Rooftop terrace', 'Available', 'Sunset on the roof', '☀️', 'look', ['rt-0', 'rt-3']),
      ],
    },
    dusk: {
      home: home('Town hall', 'Available', 'Movie night', '🎬', 'look', ['am1-0', 'am1-1']),
      errands: [
        ride('sailboat', 'Water sports', 'A sunset sail', '⛵', ['sb-0', 'sb-1']),
        spot('Firepit & hammocks', 'Available', 'Swinging in a hammock', '🌴', 'look', ['hm-1', 'hm-0']),
      ],
    },
    night: null,
  },
};

const wilson: DemoCoworker = {
  id: 'wilson-zhang',
  name: 'Wilson Zhang',
  role: 'Teammate',
  color: '#d4ae55',
  hair: '#2b2420',
  greetings: [
    'Hey! The summit view is worth the climb, trust me.',
    'Hi there! Just got the tests green.',
    'Yo! Campfire at the Highlands tonight?',
  ],
  focusReply: 'In the middle of something tricky. Ping me later!',
  craft: 'code',
  tasks: [
    { title: 'Token refresh endpoint', icon: '🔑', seconds: 70 },
    { title: 'SAML metadata import', icon: '📥', seconds: 75 },
    { title: 'Rate limiter tests', icon: '🧪', seconds: 55 },
  ],
  schedule: {
    dawn: null,
    morning: {
      home: home('Main workspace', 'Focused', 'Coding', '💻', 'desk', ['desk-10', 'desk-11'], true),
      errands: [
        hike('summit', 'An early climb up Summit Ridge', '⛰️', [15, 25]),
        ride('scuba', 'Fishing jetty', 'Diving on the reef', '🤿', ['dv-0']),
        coffee(['cs-2', 'cs-0'], 2),
      ],
    },
    midday: {
      home: home('Pavilion L', 'In a meeting', 'Sprint planning', '🗂️', 'talk', ['pl-1', 'pl-7']),
      errands: [
        ride('parasail', 'Water sports', 'Parasailing', '🪂', ['pa-0']),
        spot('Games lawn', 'Available', 'A round of cornhole', '🎯', 'look', ['ch-0'], 1, [10, 20]),
        spot('Café & terrace', 'In a meeting', 'Grabbing snacks', '🍪', 'sip', ['cs-0', 'cs-2'], 2),
      ],
    },
    golden: {
      home: home('Focus library', 'Focused', 'Deep work', '🎧', 'look', ['booth-3', 'booth-5'], true),
      errands: [
        ride('jetski', 'Water sports', 'A jet ski lap', '🚤', ['js-0', 'js-1']),
        hike('falls', 'Up to the waterfall', '💧', [15, 25]),
        spot('Boardwalk', 'Available', 'Watching the waves', '🌊', 'look', ['bw-3', 'bw-4']),
      ],
    },
    dusk: {
      home: home('Campsite', 'Available', 'By the campfire', '🏕️', 'sip', ['cf-0', 'cf-1']),
      errands: [
        spot('Ridge viewpoint', 'Available', 'Watching the sunset from the ridge', '🌄', 'look', ['rv-0'], 1),
        spot('Lakeside Loop', 'Available', 'Sitting on the lake jetty', '🛶', 'look', ['lj-0'], 1),
      ],
    },
    night: null,
  },
};

const houping: DemoCoworker = {
  id: 'houping-zhu',
  name: 'Houping Zhu',
  role: 'Teammate',
  color: '#5f8f9a',
  hair: '#3a3a3a',
  greetings: [
    'Hi! Good to see you on the island.',
    'Hey! Have you tried fishing off the jetty yet?',
    'Morning! Quiet in the library today, perfect for focus.',
  ],
  focusReply: 'Focusing on a review right now. Talk soon!',
  craft: 'code',
  tasks: [
    { title: 'Audit log export', icon: '📜', seconds: 70 },
    { title: 'Directory sync fixes', icon: '🔄', seconds: 65 },
    { title: 'Password policy rules', icon: '🛡️', seconds: 60 },
  ],
  schedule: {
    dawn: null,
    morning: {
      home: home('Focus library', 'Focused', 'Reviewing pull requests', '🔍', 'look', ['booth-0', 'booth-2'], true),
      errands: [
        spot('Fishing jetty', 'Available', 'Fishing off the jetty', '🎣', 'look', ['fs-1', 'fs-0'], 2, [15, 30]),
        ride('sailboat', 'Water sports', 'A morning sail', '⛵', ['sb-0', 'sb-1']),
        { ...coffee(['ts-1', 'ts-2'], 2), activity: 'Tea on the terrace', icon: '🍵' },
      ],
    },
    midday: {
      home: home('Pavilion L', 'In a meeting', 'Sprint planning', '🗂️', 'talk', ['pl-6', 'pl-0']),
      errands: [
        hike('falls', 'A lunchtime walk to the falls', '💧', [15, 25]),
        ride('kayak', 'Fishing jetty', 'Kayaking at lunch', '🛶', ['ky-0', 'ky-1']),
        spot('Central plaza', 'Available', 'Lunch on a plaza bench', '🥪', 'sip', ['pz-0', 'pz-1'], 2),
      ],
    },
    golden: {
      home: home('Main workspace', 'Focused', 'Coding', '💻', 'desk', ['desk-11', 'desk-12'], true),
      errands: [
        ride('scuba', 'Fishing jetty', 'A dive before sunset', '🤿', ['dv-0']),
        spot('Wellness garden', 'Available', 'Stretching his legs', '🌿', 'look', ['gb-0', 'gb-2']),
        coffee(['cs-1', 'cs-2'], 2),
      ],
    },
    dusk: {
      home: home('Town hall', 'Available', 'Movie night', '🎬', 'look', ['am1-5', 'am1-4']),
      errands: [spot('Boardwalk', 'Available', 'Watching the sunset', '🌅', 'look', ['bw-0', 'bw-1'])],
    },
    night: null,
  },
};

const binLin: DemoCoworker = {
  id: 'bin-lin',
  name: 'Bin Lin',
  role: 'Teammate',
  color: '#c47a6a',
  hair: '#26201c',
  greetings: [
    'Hey! The jet skis are great at lunch.',
    'Hi! Got a minute later to pair on something?',
    'Morning! The plaza fountain is extra sparkly today.',
  ],
  focusReply: 'Debugging right now. Catch me in a bit!',
  craft: 'code',
  tasks: [
    { title: 'OAuth consent screen API', icon: '🔐', seconds: 65 },
    { title: 'Session cleanup job', icon: '🧹', seconds: 55 },
    { title: 'Webhook retries', icon: '🔁', seconds: 70 },
  ],
  schedule: {
    dawn: null,
    morning: {
      home: home('Main workspace', 'Available', 'Coding', '💻', 'desk', ['desk-12', 'desk-13'], true),
      errands: [
        ride('jetski', 'Water sports', 'A morning jet ski run', '🚤', ['js-0', 'js-1']),
        spot('Games lawn', 'Available', 'Ping-pong break', '🏓', 'look', ['pp-1', 'pp-0'], 1, [12, 24]),
        coffee(['cs-0', 'cs-2'], 2),
      ],
    },
    midday: {
      home: home('Café & terrace', 'Available', 'Lunch with the team', '🍜', 'sip', ['ts-0', 'ts-3']),
      errands: [
        ride('climb', 'Climbing bluff', 'Climbing the bluff', '🧗', ['cl-0']),
        hike('lake', 'A lap of the lake', '🥾', [10, 20]),
        spot('Music corner', 'Available', 'Playing the piano', '🎹', 'desk', ['pn-0']),
      ],
    },
    golden: {
      home: home('Main workspace', 'Focused', 'Shipping a fix', '💻', 'desk', ['desk-13', 'desk-7'], true),
      errands: [
        ride('parasail', 'Water sports', 'Parasailing at golden hour', '🪂', ['pa-0']),
        spot('Pavilion S', 'In a meeting', 'A quick 1:1', '🗣️', 'talk', ['ps-1', 'ps-0']),
        spot('Games lawn', 'Available', 'Ping-pong break', '🏓', 'look', ['pp-1', 'pp-0'], 2, [12, 24]),
      ],
    },
    dusk: {
      home: home('Boardwalk', 'Available', 'Watching the sunset', '🌅', 'look', ['bw-4', 'bw-3']),
      errands: [
        ride('sailboat', 'Water sports', 'A sunset sail', '⛵', ['sb-1', 'sb-0']),
        spot('Firepit & hammocks', 'Available', 'Toasting marshmallows', '🔥', 'sip', ['fp-2', 'fp-0']),
      ],
    },
    night: null,
  },
};

const daniel: DemoCoworker = {
  id: 'daniel-zheng',
  name: 'Daniel Zheng',
  role: 'Teammate',
  color: '#8c7bb8',
  hair: '#4a3628',
  greetings: [
    'Hey! Welcome in. Big day today.',
    'Hi! Coffee and a walk round the garden?',
    'Morning! The reef is full of fish today.',
  ],
  focusReply: 'On a call in a minute. Catch up after?',
  craft: 'code',
  tasks: [
    { title: 'Customer onboarding plan', icon: '🗺️', seconds: 70 },
    { title: 'Release notes', icon: '📝', seconds: 55 },
    { title: 'Roadmap review', icon: '📊', seconds: 75 },
  ],
  schedule: {
    dawn: null,
    morning: {
      home: home('Pavilion L', 'In a meeting', 'Morning stand-up', '☀️', 'talk', ['pl-2', 'pl-8'], true),
      errands: [
        coffee(['cs-2', 'cs-1'], 2),
        hike('lake', 'A walk round the lake', '🥾', [10, 20]),
        ride('climb', 'Climbing bluff', 'Climbing the bluff', '🧗', ['cl-0']),
      ],
    },
    midday: {
      home: home('Pavilion S', 'In a meeting', 'Customer call', '📞', 'talk', ['ps-0', 'ps-1']),
      errands: [
        ride('sailboat', 'Water sports', 'Sailing at lunch', '⛵', ['sb-1', 'sb-0']),
        spot('Central plaza', 'Available', 'A break by the fountain', '⛲', 'look', ['pz-2', 'pz-3']),
        spot('Café & terrace', 'Available', 'Lunch on the terrace', '🥗', 'sip', ['ts-2', 'ts-1'], 2),
      ],
    },
    golden: {
      home: home('Lobby', 'Available', 'Catching up on email', '📧', 'look', ['lb-0', 'lb-1'], true),
      errands: [
        hike('summit', 'Hiking up to the summit', '⛰️', [20, 30]),
        ride('kayak', 'Fishing jetty', 'Kayaking round the island', '🛶', ['ky-1', 'ky-0']),
        spot('Rooftop terrace', 'Available', 'Sunset on the roof', '☀️', 'look', ['rt-3', 'rt-0']),
      ],
    },
    dusk: {
      home: home('Town hall', 'Available', 'Movie night', '🎬', 'look', ['am0-1', 'am0-2']),
      errands: [spot('Firepit & hammocks', 'Available', 'Toasting marshmallows', '🔥', 'sip', ['fp-3', 'fp-1'])],
    },
    night: null,
  },
};

// You are Le Deng; everyone else on the team walks the island on their own routine.
export const demoCoworkers: DemoCoworker[] = [
  {
    id: 'shuwan-yao',
    name: 'Shuwan Yao',
    role: 'Teammate',
    color: '#7193b5',
    hair: '#2f2a28',
    hairStyle: 'long',
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
    id: 'bin-yang',
    name: 'Bin Yang',
    role: 'Teammate',
    color: '#a88bb9',
    hair: '#1c1916',
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
  aaron,
  wilson,
  houping,
  binLin,
  daniel,
];

// Home → weighted errand → home → … Coworkers always return home between errands.
// Errands whose seats are all `taken` are skipped, so two people never share a one-seat ride.
export function nextActivity(
  block: Block,
  current: Activity | null,
  random = Math.random,
  taken: ReadonlySet<string> = new Set(),
): Activity {
  if (!current || current !== block.home || !block.errands.length) return block.home;
  const open = block.errands.filter(e => !e.seats || e.seats.some(id => !taken.has(id)));
  if (!open.length) return block.home;
  const total = open.reduce((sum, e) => sum + (e.weight ?? 1), 0);
  let roll = random() * total;
  for (const errand of open) {
    roll -= errand.weight ?? 1;
    if (roll < 0) return errand;
  }
  return open[open.length - 1];
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
