import { RADIO_SPOT, seatSpot, TELESCOPE_SPOT, type Spot } from './interact.ts';
import { districts, seats } from './world.ts';

// What there is to do at each place. Walk up to a place and its name shows these as buttons;
// from a little further off, just their icons. Each activity gathers every spot of its kind there
// (all the desks, both kayaks), so the list stays short.
export type Activity = { key: string; icon: string; label: string; spots: Spot[] };

// Spots are grouped by the start of their id: which place they belong to and what they're for.
const GROUPS: Record<string, { place: string; icon: string; label: string }> = {
  desk: { place: 'office', icon: '💻', label: 'Desk' },
  rt: { place: 'office', icon: '☀️', label: 'Rooftop' },
  pm: { place: 'meeting', icon: '🗓️', label: 'Pavilion M' },
  pl: { place: 'meeting', icon: '👥', label: 'Pavilion L' },
  ps: { place: 'meeting', icon: '🛋️', label: 'Pavilion S' },
  booth: { place: 'library', icon: '🎧', label: 'Focus booth' },
  cs: { place: 'cafe', icon: '☕', label: 'Counter' },
  ts: { place: 'cafe', icon: '🪑', label: 'Terrace' },
  pn: { place: 'cafe', icon: '🎹', label: 'Piano' },
  radio: { place: 'cafe', icon: '📻', label: 'Radio' },
  lb: { place: 'plaza', icon: '🛋️', label: 'Lobby' },
  pz: { place: 'plaza', icon: '🪑', label: 'Bench' },
  am: { place: 'townhall', icon: '🎬', label: 'Take a seat' },
  gb: { place: 'wellness', icon: '🪑', label: 'Bench' },
  telescope: { place: 'wellness', icon: '🔭', label: 'Telescope' },
  bw: { place: 'boardwalk', icon: '🏖️', label: 'Lounger' },
  pp: { place: 'games', icon: '🏓', label: 'Ping-pong' },
  ch: { place: 'games', icon: '🎯', label: 'Cornhole' },
  fp: { place: 'firepit', icon: '🔥', label: 'Firepit' },
  hm: { place: 'firepit', icon: '🌴', label: 'Hammock' },
  fs: { place: 'jetty', icon: '🎣', label: 'Fish' },
  ky: { place: 'jetty', icon: '🛶', label: 'Kayak' },
  dv: { place: 'jetty', icon: '🤿', label: 'Dive' },
  js: { place: 'marina', icon: '🚤', label: 'Jet ski' },
  sb: { place: 'marina', icon: '⛵', label: 'Sail' },
  pa: { place: 'marina', icon: '🪂', label: 'Parasail' },
  cl: { place: 'bluff', icon: '🧗', label: 'Climb' },
  cf: { place: 'campsite', icon: '🔥', label: 'Campfire' },
  lj: { place: 'lake', icon: '🪑', label: 'Jetty bench' },
  wf: { place: 'falls', icon: '🪑', label: 'Bench' },
  rv: { place: 'summit', icon: '🌄', label: 'Ridge view' },
  sm: { place: 'summit', icon: '🪑', label: 'Summit bench' },
  ws: { place: 'summit', icon: '🦅', label: 'Wingsuit' },
  pc: { place: 'summit', icon: '🪂', label: 'Parachute' },
};
// The water taxi has a stop at each end: the dock on the office island, the jetty by the campsite.
const TAXI = { icon: '⛴️', label: 'Water taxi' };
const groupOf = (id: string) => id.replace(/-?\d+$/, '').replace(/^am\d$/, 'am');

export const PLACE_ACTIVITIES: Record<string, Activity[]> = (() => {
  const places: Record<string, Activity[]> = Object.fromEntries(districts.map(d => [d.id, []]));
  const add = (place: string, key: string, icon: string, label: string, spot: Spot) => {
    const list = (places[place] ??= []);
    let activity = list.find(a => a.key === key);
    if (!activity) list.push((activity = { key, icon, label, spots: [] }));
    activity.spots.push(spot);
  };
  for (const spot of [...seats.map(seatSpot), RADIO_SPOT, TELESCOPE_SPOT]) {
    const key = groupOf(spot.id),
      group = GROUPS[key];
    if (key === 'fy') add(spot.id === 'fy-0' ? 'marina' : 'campsite', key, TAXI.icon, TAXI.label, spot);
    else if (group) add(group.place, key, group.icon, group.label, spot);
  }
  return places;
})();

// How far you are from a place: from its name, or from the nearest thing to do there.
export function placeDistance(place: string, x: number, z: number) {
  const district = districts.find(d => d.id === place);
  let nearest = district ? Math.hypot(district.point[0] - x, district.point[1] - z) : Infinity;
  for (const activity of PLACE_ACTIVITIES[place] ?? [])
    for (const spot of activity.spots) nearest = Math.min(nearest, Math.hypot(spot.x - x, spot.z - z));
  return nearest;
}

// Which place you're at (its activities open up) and which are close enough to hint at with
// icons. Only one place opens at a time. `before` is the last answer: a place stays open until
// you're clearly somewhere else, so nothing flickers when you stand between two.
export const NEAR = 6.5,
  PREVIEW = 20,
  SLACK = 2;
export type Nearby = { open: string | null; hinted: string[] };
export function nearbyPlaces(x: number, z: number, before: Nearby = { open: null, hinted: [] }): Nearby {
  let open: string | null = null,
    best = Infinity;
  const hinted: string[] = [];
  for (const place of Object.keys(PLACE_ACTIVITIES)) {
    if (!PLACE_ACTIVITIES[place].length) continue;
    const d = placeDistance(place, x, z);
    if (d < (before.hinted.includes(place) || before.open === place ? PREVIEW + SLACK : PREVIEW)) hinted.push(place);
    // The place that's already open gets a head start over its neighbours.
    const score = place === before.open ? d - SLACK : d;
    if (score < NEAR && score < best) {
      best = score;
      open = place;
    }
  }
  return { open, hinted: hinted.filter(place => place !== open) };
}

// The spot a button takes you to: the nearest one of its kind that nobody is using.
export function freeSpot(activity: Activity, x: number, z: number, occupied: ReadonlySet<string>) {
  let found: Spot | null = null,
    nearest = Infinity;
  for (const spot of activity.spots) {
    const d = Math.hypot(spot.x - x, spot.z - z);
    if (!occupied.has(spot.id) && d < nearest) {
      found = spot;
      nearest = d;
    }
  }
  return found;
}
