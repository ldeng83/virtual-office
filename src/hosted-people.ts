import { coffee, hike, ride, spot, type Activity, type Block, type DemoCoworker } from './people.ts';
import { plaza, seats, type Point } from './world.ts';
import { periods, type Period } from './daylight.ts';
import type { HostPerson } from './host.ts';

// Real teammates, supplied by a host app, as island coworkers: a home seat to work at and a day of
// short errands. Everything is derived from the person's id, so every viewer sees the same seat.
const WORK_PREFIXES = ['desk-', 'pm-', 'pl-', 'ps-', 'booth-', 'ts-'];
export const WORK_SEATS: string[] = WORK_PREFIXES.flatMap(prefix =>
  seats.filter(s => s.id.startsWith(prefix)).map(s => s.id),
);
const placeOf = (seatId: string) =>
  seatId.startsWith('desk-')
    ? 'Main workspace'
    : seatId.startsWith('booth-')
      ? 'Focus library'
      : seatId.startsWith('ts-')
        ? 'Café & terrace'
        : `Pavilion ${seatId[1].toUpperCase()}`;

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Errands never use a work seat, so nobody comes back to find their own seat taken.
const BREAKS: Activity[] = [
  spot('Wellness garden', 'Available', 'Sitting by the pond', '🌿', 'look', ['gb-0', 'gb-1', 'gb-2']),
  spot('Boardwalk', 'Available', 'Watching the waves', '🌊', 'look', ['bw-0', 'bw-1', 'bw-2', 'bw-3', 'bw-4']),
  spot('Central plaza', 'Available', 'A break on a plaza bench', '🥪', 'sip', ['pz-0', 'pz-1', 'pz-2', 'pz-3']),
  spot('Firepit & hammocks', 'Available', 'Swinging in a hammock', '🌴', 'look', ['hm-0', 'hm-1']),
  spot('Lobby', 'Available', 'Reading in the lobby', '📖', 'look', ['lb-0', 'lb-1', 'lb-2']),
  spot('Games lawn', 'Available', 'A game of ping-pong', '🏓', 'look', ['pp-0', 'pp-1'], 1, [12, 24]),
];
const OUTINGS: Activity[] = [
  ride('kayak', 'Fishing jetty', 'Out in a kayak', '🛶', ['ky-0', 'ky-1'], 0.5),
  ride('jetski', 'Water sports', 'Out on a jet ski', '🚤', ['js-0', 'js-1'], 0.5),
  ride('sailboat', 'Water sports', 'Out for a sail', '⛵', ['sb-0', 'sb-1'], 0.5),
  ride('parasail', 'Water sports', 'Parasailing', '🪂', ['pa-0'], 0.5),
  ride('scuba', 'Fishing jetty', 'Diving on the reef', '🤿', ['dv-0'], 0.5),
  ride('climb', 'Climbing bluff', 'Climbing the bluff', '🧗', ['cl-0'], 0.5),
  hike('lake', 'A walk round the lake', '🥾', [10, 20], 0.5),
  hike('falls', 'Up to the waterfall', '💧', [15, 25], 0.5),
  spot('Fishing jetty', 'Available', 'Fishing off the jetty', '🎣', 'look', ['fs-0', 'fs-1'], 0.5, [15, 30]),
];
const FIRESIDE = spot('Firepit & hammocks', 'Available', 'By the firepit', '🔥', 'sip', [
  'fp-0',
  'fp-1',
  'fp-2',
  'fp-3',
]);

function homeAt(seatId: string | null, standing: number): Activity {
  if (seatId)
    return {
      place: placeOf(seatId),
      status: 'Focused',
      activity: 'Working',
      icon: '💻',
      pose: 'desk',
      dwell: [40, 80],
      seats: [seatId],
      work: true,
    };
  // No work seat left: they work standing on the plaza, spread round the fountain.
  const angle = standing * 2.4,
    point: Point = [plaza.x + Math.cos(angle) * 3.4, plaza.z + Math.sin(angle) * 3.4];
  return {
    place: 'Central plaza',
    status: 'Available',
    activity: 'Catching up on the plaza',
    icon: '💬',
    pose: 'talk',
    dwell: [40, 80],
    point,
    face: [plaza.x, plaza.z],
    work: true,
  };
}

export function hostedCoworkers(people: HostPerson[]): DemoCoworker[] {
  const claimed = new Set<string>();
  let standing = 0;
  return people
    .filter(p => p.present)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(person => {
      const seed = hash(person.id);
      let seatId: string | null = null;
      for (let i = 0; i < WORK_SEATS.length && !seatId; i++) {
        const candidate = WORK_SEATS[(seed + i) % WORK_SEATS.length];
        if (!claimed.has(candidate)) seatId = candidate;
      }
      if (seatId) claimed.add(seatId);
      const home = homeAt(seatId, seatId ? 0 : standing++),
        first = person.name.split(/\s+/)[0] || person.name,
        block = (shift: number, late = false): Block => ({
          home,
          errands: late
            ? [FIRESIDE]
            : [
                coffee(['cs-0', 'cs-1', 'cs-2'], 2),
                BREAKS[(seed + shift) % BREAKS.length],
                OUTINGS[((seed >>> 4) + shift) % OUTINGS.length],
              ],
        }),
        schedule = Object.fromEntries(
          (Object.keys(periods) as Period[]).map((period, i) => [period, block(i, period === 'night')]),
        ) as Record<Period, Block | null>;
      return {
        id: person.id,
        name: person.name,
        role: person.role,
        color: person.look.shirt,
        hair: person.look.hair,
        hairStyle: person.look.hairStyle,
        skin: person.look.skin,
        bottoms: person.look.bottoms,
        greetings: [
          `Hi, ${first} here. Good to see you!`,
          'Hey! How’s your day going?',
          'Hello! Lovely out here today.',
        ],
        focusReply: 'Heads down right now. Catch you in a bit?',
        craft: seed % 2 ? 'code' : 'design',
        tasks: (person.tasks.length ? person.tasks : ['Heads-down work']).map(title => ({
          title,
          icon: '📌',
          seconds: 55,
        })),
        schedule,
      };
    });
}
