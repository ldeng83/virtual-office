import type { Point } from './world';

export type ViewMode = 'follow' | 'overview' | 'free';

// Shared, mutable camera state so the mini-map and the 3D scene can talk every frame
// without re-rendering React. The scene writes `focus`/`corners`; the map writes `look`.
export const cameraView = {
    focus: [0, 7] as Point,
    corners: [] as Point[],
    look: null as Point | null,
};

// Keep free-look focus over the island and its surrounding water.
export const PAN_BOUNDS = { minX: -38, maxX: 42, minZ: -46, maxZ: 14 };
export function clampFocus(x: number, z: number): Point {
    return [Math.min(PAN_BOUNDS.maxX, Math.max(PAN_BOUNDS.minX, x)), Math.min(PAN_BOUNDS.maxZ, Math.max(PAN_BOUNDS.minZ, z))];
}
