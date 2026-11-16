// Small shared state between the player controller and the fun props, updated every frame
// without re-rendering React (like camera-view.ts).
export const kayakRide = { index: -1, x: 0, z: 0, heading: 0 };
export const playerState = { elevated: false };

export type Emote = 'wave' | 'dance' | 'highfive' | 'cheer';
export const EMOTE_ICONS: Record<Emote, string> = { wave: '👋', dance: '💃', highfive: '🙌', cheer: '🎉' };
