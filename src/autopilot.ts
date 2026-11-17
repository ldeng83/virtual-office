import type { Period } from './daylight.ts';
import { seats } from './world.ts';
import { RIDE_SECONDS, type RideKind } from './rides.ts';
import { trailById, type Trail } from './highlands.ts';
import type { Activity, Block, Pose } from './people.ts';

// When you stop touching the controls for a while, your avatar carries on with a day of its own,
// planned like a coworker's: a home spot for each part of the day plus short errands.
export type AutopilotSettings = { enabled: boolean; delay: number; paused: boolean; version: number };
export const DEFAULT_AUTOPILOT: AutopilotSettings = { enabled: true, delay: 90_000, paused: false, version: 2 };
export const AUTOPILOT_DELAYS = [10_000, 30_000, 60_000, 90_000, 300_000];
// The countdown shows for the last few seconds before autopilot takes over.
export const COUNTDOWN_MS = 3_000;
// Give up on reaching a spot after this long (a blocked path, a long hike) and plan again.
export const ARRIVE_TIMEOUT_MS = 150_000;

export function readAutopilot(): AutopilotSettings {
  try {
    return restoreAutopilot(JSON.parse(localStorage.getItem('atoll-autopilot') || '{}'));
  } catch {
    return DEFAULT_AUTOPILOT;
  }
}

// Settings saved before the default went from 10 to 90 seconds held the old default, not a choice:
// those move to the new default. A delay picked since then is kept.
export function restoreAutopilot(saved: Partial<AutopilotSettings>): AutopilotSettings {
  const { delay, ...rest } = saved,
    stale = !saved.version && delay === 10_000;
  return { ...DEFAULT_AUTOPILOT, ...rest, ...(delay && !stale ? { delay } : {}), version: DEFAULT_AUTOPILOT.version };
}

// Looking around isn't taking control: zooming, panning (left-drag) and orbiting (right-drag) leave
// autopilot running. `where` is what the input landed on: the 3D view, the camera buttons (zoom, Follow me, Island overview), elsewhere in
// the island panel, or anything else. A left press on the 3D view is only a click (walk, sit) if it
// comes back up without having moved, so it waits for the release.
export const CLICK_SLOP = 6;
export function inputIntent(
  type: string,
  button: number,
  where: 'view' | 'zoom' | 'panel' | 'other',
): 'look' | 'press' | 'control' {
  if (where === 'zoom') return 'look';
  if (type === 'wheel') return where === 'other' ? 'control' : 'look';
  if (where !== 'view') return 'control';
  if (type === 'touchstart') return 'look';
  if (type === 'pointerdown') return button === 0 ? 'press' : 'look';
  return 'control';
}

// Before autopilot starts: nothing, a countdown (whole seconds left), or start now.
export function idlePhase(idleMs: number, delay: number): { start: boolean; countdown: number | null } {
  if (idleMs >= delay) return { start: true, countdown: null };
  const left = delay - idleMs;
  return { start: false, countdown: left <= COUNTDOWN_MS ? Math.ceil(left / 1000) : null };
}

const spot = (
  place: string,
  status: Activity['status'],
  activity: string,
  icon: string,
  pose: Pose,
  seatIds: string[],
  weight = 1,
  dwell: [number, number] = [12, 28],
  work = false,
): Activity => ({ place, status, activity, icon, pose, dwell, weight, seats: seatIds, ...(work && { work }) });
const home = (
  place: string,
  status: Activity['status'],
  activity: string,
  icon: string,
  pose: Pose,
  seatIds: string[],
  work = false,
) => spot(place, status, activity, icon, pose, seatIds, 1, [25, 50], work);
const ride = (kind: RideKind, place: string, activity: string, icon: string, seatIds: string[], weight = 1) =>
  spot(place, 'Available', activity, icon, 'look', seatIds, weight, [RIDE_SECONDS[kind] + 4, RIDE_SECONDS[kind] + 12]);
const hike = (trail: Trail['id'], activity: string, icon: string): Activity => ({
  place: trailById(trail).name,
  status: 'Available',
  activity,
  icon,
  pose: 'look',
  dwell: [10, 20],
  weight: 1,
  trail,
});
const coffee = (seatIds: string[], weight = 2) =>
  spot('Café & terrace', 'Available', 'Grabbing a coffee', '☕', 'sip', seatIds, weight);

export const PLAYER_SCHEDULE: Record<Period, Block> = {
  dawn: {
    home: home('Boardwalk', 'Available', 'Watching the sunrise', '🌅', 'look', ['bw-2', 'bw-0', 'bw-1']),
    errands: [spot('Fishing jetty', 'Available', 'Early fishing', '🎣', 'look', ['fs-0', 'fs-1'], 1, [15, 30])],
  },
  morning: {
    home: home('Main workspace', 'Focused', 'Working at your desk', '💻', 'desk', ['desk-6', 'desk-5', 'desk-0'], true),
    errands: [
      coffee(['cs-0', 'cs-1', 'cs-2'], 3),
      spot('Music corner', 'Available', 'Playing the piano', '🎹', 'desk', ['pn-0']),
      ride('kayak', 'Fishing jetty', 'A morning paddle', '🛶', ['ky-0', 'ky-1']),
      hike('lake', 'A lap of the lake', '🥾'),
    ],
  },
  midday: {
    home: home('Pavilion M', 'In a meeting', 'In a meeting', '💬', 'talk', ['pm-2', 'pm-5', 'pm-3']),
    errands: [
      spot('Café & terrace', 'Available', 'Lunch on the terrace', '🥗', 'sip', ['ts-3', 'ts-4', 'ts-5'], 2),
      spot('Games lawn', 'Available', 'Ping-pong at lunch', '🏓', 'look', ['pp-0', 'pp-1'], 1, [12, 24]),
      ride('jetski', 'Water sports', 'Out on a jet ski', '🚤', ['js-0', 'js-1']),
      hike('falls', 'A walk up to the waterfall', '💧'),
    ],
  },
  golden: {
    home: home(
      'Focus library',
      'Focused',
      'Heads-down focus time',
      '🎧',
      'look',
      ['booth-5', 'booth-4', 'booth-2'],
      true,
    ),
    errands: [
      ride('parasail', 'Water sports', 'Parasailing', '🪂', ['pa-0']),
      ride('climb', 'Climbing bluff', 'Climbing the bluff', '🧗', ['cl-0']),
      ride('scuba', 'Fishing jetty', 'Diving on the reef', '🤿', ['dv-0']),
      hike('summit', 'Hiking up to the summit', '⛰️'),
      spot('Rooftop terrace', 'Available', 'Sunset on the roof', '☀️', 'look', ['rt-1', 'rt-2', 'rt-0']),
      coffee(['cs-1', 'cs-2', 'cs-0']),
    ],
  },
  dusk: {
    home: home('Town hall', 'Available', 'Movie night', '🎬', 'look', ['am2-1', 'am2-2', 'am2-0']),
    errands: [
      ride('sailboat', 'Water sports', 'A sunset sail', '⛵', ['sb-0', 'sb-1']),
      spot('Firepit & hammocks', 'Available', 'Toasting marshmallows', '🔥', 'sip', ['fp-0', 'fp-1', 'fp-2', 'fp-3']),
      spot('Firepit & hammocks', 'Available', 'Swinging in a hammock', '🌴', 'look', ['hm-0', 'hm-1']),
    ],
  },
  night: {
    home: home('Firepit & hammocks', 'Available', 'By the fire', '🔥', 'sip', ['fp-1', 'fp-3', 'fp-0', 'fp-2']),
    errands: [spot('Boardwalk', 'Available', 'Stargazing on the boardwalk', '✨', 'look', ['bw-3', 'bw-4'])],
  },
};

// Somewhere to stay while Focused or In a meeting when you weren't already seated somewhere fitting.
const FOCUS_HOME = home(
  'Focus library',
  'Focused',
  'Heads-down focus time',
  '🎧',
  'look',
  ['booth-5', 'booth-4', 'booth-2', 'booth-1'],
  true,
);
const MEETING_HOME = home('Pavilion M', 'In a meeting', 'In a meeting', '💬', 'talk', [
  'pm-2',
  'pm-5',
  'pm-3',
  'pl-3',
  'pl-9',
]);

// Sitting down when you go idle makes that seat "home": autopilot pops out for errands and comes back.
// Out on a ride you're busy, however still your hands are: the idle clock waits until it's over.
export const onRide = (seatId: string | null) => !!seats.find(s => s.id === seatId)?.ride;
export function seatHome(seatId: string | null): Activity | null {
  const seat = seatId ? seats.find(s => s.id === seatId) : undefined;
  if (!seat || seat.ride) return null;
  const work = seat.id.startsWith('desk-') || seat.id.startsWith('booth-');
  const meeting = /^(pm|pl|ps)-/.test(seat.id);
  return {
    place: seat.name,
    status: work ? 'Focused' : meeting ? 'In a meeting' : 'Available',
    activity: work ? 'Working' : meeting ? 'In a meeting' : `Relaxing on the ${seat.name.toLowerCase()}`,
    icon: work ? '💻' : meeting ? '💬' : '🪑',
    pose: seat.id.startsWith('desk-') ? 'desk' : meeting ? 'talk' : 'look',
    dwell: [25, 50],
    seats: [seat.id],
    ...(work && { work }),
  };
}

// Your status shapes the day: Focused stays at a desk or the library and In a meeting stays in a
// pavilion (no errands); Available and Away get the whole schedule.
export function autopilotBlock(period: Period, status: string, seated: Activity | null): Block {
  const block = PLAYER_SCHEDULE[period];
  if (status === 'Focused') return { home: seated?.status === 'Focused' ? seated : FOCUS_HOME, errands: [] };
  if (status === 'In a meeting')
    return { home: seated?.status === 'In a meeting' ? seated : MEETING_HOME, errands: [] };
  return { home: seated ?? block.home, errands: block.errands };
}

// What the feed says when autopilot heads somewhere.
export const autopilotFeedText = (a: Activity) => `→ ${a.activity[0].toLowerCase()}${a.activity.slice(1)} 🤖`;
