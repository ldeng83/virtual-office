import { groundHeight } from './highlands.ts';
import { radio, seats, telescope, type Seat } from './world.ts';

// What you can use on the island, and what using it does. The scene shows the action when you
// point at something or walk up to it, so it's clear what can be clicked.
const RIDES = {
  kayak: 'Paddle the kayak',
  jetski: 'Ride the jet ski',
  sailboat: 'Go sailing',
  parasail: 'Go parasailing',
  climb: 'Climb the bluff',
  scuba: 'Go diving',
  ferry: 'Take the water taxi',
  wingsuit: 'Jump in a wingsuit',
  parachute: 'Jump with a parachute',
};
const BY_PREFIX: Record<string, string> = {
  desk: 'Work at this desk',
  hm: 'Lie in the hammock',
  pn: 'Play the piano',
  fs: 'Go fishing',
  pp: 'Play ping-pong',
  ch: 'Play cornhole',
  rt: 'Relax on the rooftop',
  fp: 'Sit by the fire',
  cf: 'Sit by the campfire',
  booth: 'Focus in this booth',
  cs: 'Sit at the counter',
};
export function seatAction(seat: Seat) {
  if (seat.ride) return RIDES[seat.ride.kind];
  return BY_PREFIX[seat.id.replace(/-?\d+$/, '')] ?? `Sit: ${seat.name.toLowerCase()}`;
}

// A usable spot: where it is, what it does, and how to do it.
export type Spot = { id: string; x: number; y: number; z: number; label: string };
export const seatSpot = (seat: Seat): Spot => ({
  id: seat.id,
  x: seat.point[0],
  y: (seat.y ?? 0) + groundHeight(...seat.point),
  z: seat.point[1],
  label: seatAction(seat),
});
export const RADIO_SPOT: Spot = { id: 'radio', x: radio[0], y: 1, z: radio[1], label: 'Lo-fi radio on / off' };
export const TELESCOPE_SPOT: Spot = {
  id: 'telescope',
  x: telescope[0],
  y: 0.2,
  z: telescope[1],
  label: 'Look through the telescope',
};
export const SPOTS: Spot[] = [...seats.map(seatSpot), RADIO_SPOT, TELESCOPE_SPOT];

// The spot you'd use by pressing E: the nearest one within reach on your own level.
export const REACH = 2.2;
export function nearestSpot(x: number, z: number, y = groundHeight(x, z), spots = SPOTS) {
  let best: Spot | null = null,
    distance = REACH;
  for (const spot of spots) {
    const d = Math.hypot(spot.x - x, spot.z - z);
    if (d < distance && Math.abs(spot.y - y) < 1.6) {
      best = spot;
      distance = d;
    }
  }
  return best;
}

// What the pointer is over right now (the scene's hover handlers write this; the hints read it).
export const pointer = { spot: null as Spot | null };
export function hoverSpot(spot: Spot | null) {
  pointer.spot = spot;
  document.body.style.cursor = spot ? 'pointer' : 'auto';
}

// The keys that use the nearest thing, like clicking it: E, and Space for hands already on the
// keyboard. Space on a focused button or link presses that instead, as it does everywhere.
export function isUseKey(event: { key: string; target: unknown }) {
  const key = event.key.toLowerCase();
  if (key === 'e') return true;
  if (key !== ' ' && key !== 'spacebar') return false;
  const tag = (event.target as { tagName?: string } | null)?.tagName;
  return !['BUTTON', 'A', 'SUMMARY'].includes(tag ?? '');
}
