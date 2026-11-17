// Small shared state between the player controller and the fun props, updated every frame
// without re-rendering React (like camera-view.ts).
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
export type SeaSight = { kind: 'whale' | 'dolphins' | 'shark'; x: number; z: number; present: boolean };
export type Sighting = { icon: string; who: string; text: string; where: () => [number, number] };
export const seaState = { sights: [] as SeaSight[], onSighting: (_sighting: Sighting) => {} };
