import type { Seat } from './world.ts';

// How an avatar sits in each kind of seat. Applied to an inner "pose" group inside the avatar
// (the avatar's own origin stays at the seat point, facing the seat's direction):
// y lifts the whole avatar, pitch tips it back (lying faces up), z shifts it along the seat,
// and roll rocks it around its own long axis (hammocks).
export type Pose = { y: number; pitch: number; z: number; roll: number };
export const UPRIGHT: Pose = { y: 0, pitch: 0, z: 0, roll: 0 };

// Hammocks rock gently; the hammock mesh uses the same motion so the person rocks with it.
export const hammockSway = (time: number) => Math.sin(time * 1.1) * 0.08;

export function seatPose(kind: Seat['kind'], elevation = 0, time = 0): Pose {
  switch (kind) {
    case 'stand':
      return { ...UPRIGHT, y: elevation };
    case 'lounger':
      return { y: elevation + 0.22, pitch: -1.05, z: 0.4, roll: 0 };
    case 'hammock':
      return { y: elevation + 0.72, pitch: -Math.PI / 2, z: 0.72, roll: hammockSway(time) };
    case 'crate':
      return { ...UPRIGHT, y: elevation - 0.26 };
    case 'log':
      return { ...UPRIGHT, y: elevation - 0.3 };
    default:
      return { ...UPRIGHT, y: elevation - 0.2 };
  }
}
