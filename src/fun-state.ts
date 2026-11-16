// Small shared state between the player controller and the fun props, updated every frame
// without re-rendering React (like camera-view.ts).
import type { RideKind } from './rides';

// The ride you're on: the vehicle follows this (x, y, z, heading, roll), and for parasailing
// the tow boat follows `boat`.
export const ride = {
  seat: null as string | null,
  kind: null as RideKind | null,
  x: 0,
  y: 0,
  z: 0,
  heading: 0,
  roll: 0,
  t: 0,
  boat: null as { x: number; z: number; heading: number } | null,
};
export const playerState = { elevated: false };

export type Emote = 'wave' | 'dance' | 'highfive' | 'cheer';
export const EMOTE_ICONS: Record<Emote, string> = { wave: '👋', dance: '💃', highfive: '🙌', cheer: '🎉' };
