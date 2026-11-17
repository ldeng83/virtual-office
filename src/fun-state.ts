// Small shared state between the player controller and the fun props, updated every frame
// without re-rendering React (like camera-view.ts).
import { inSight, type SpeciesId } from './dive';
import type { RideView } from './rides';

// Everyone on a ride right now (you or a coworker), by seat id. The vehicles follow these.
export const riders: Record<string, RideView> = {};
// Where you are, which way you face and the route you're walking (the maps read these every frame).
export const playerState = { elevated: false, x: 0, z: 0, heading: 0, route: [] as [number, number][] };

export type Emote = 'wave' | 'dance' | 'highfive' | 'cheer';
export const EMOTE_ICONS: Record<Emote, string> = { wave: '👋', dance: '💃', highfive: '🙌', cheer: '🎉' };

// Taking back control from autopilot stops you where you are (the scene fills this in).
export const playerControl = { halt: () => {} };

// Life out at sea (open-sea.tsx writes these every frame). The telescope and the activity feed read them.
// `ahead` says where it will be in a while, so a boat setting off can aim to meet it.
export type SeaSight = {
  kind: 'whale' | 'dolphins' | 'shark';
  x: number;
  z: number;
  present: boolean;
  ahead?: (seconds: number) => { x: number; z: number; present: boolean };
};
export type Sighting = { icon: string; who: string; text: string; where: () => [number, number] };
export const seaState = { sights: [] as SeaSight[], onSighting: (_sighting: Sighting) => {} };

// Your dive (the player controller writes these every frame). The underwater view, the air gauge
// and the logbook read them; `surface` asks the diver to swim back up.
export const diveState = {
  // Below the surface, with the underwater view on.
  under: false,
  x: 0,
  y: 0,
  z: 0,
  air: 1,
  free: false,
  returning: false,
  surface: false,
  // What this dive has met so far.
  seen: new Set<SpeciesId>(),
  onSpot: (_id: SpeciesId) => {},
  // The moment you go under or come back up (a wash of bubbles covers the change of view).
  onSplash: () => {},
};
// Sea life reports where it is; anything close to you while you're under goes in the logbook.
export function spot(id: SpeciesId, x: number, z: number) {
  if (!diveState.under || diveState.seen.has(id) || !inSight(id, x - diveState.x, z - diveState.z)) return;
  diveState.seen.add(id);
  diveState.onSpot(id);
}
