// Small shared state between the player controller and the fun props, updated every frame
// without re-rendering React (like camera-view.ts).
import type { RideView } from './rides';

// Everyone on a ride right now (you or a coworker), by seat id. The vehicles follow these.
export const riders: Record<string, RideView> = {};
export const playerState = { elevated: false };

export type Emote = 'wave' | 'dance' | 'highfive' | 'cheer';
export const EMOTE_ICONS: Record<Emote, string> = { wave: '👋', dance: '💃', highfive: '🙌', cheer: '🎉' };
