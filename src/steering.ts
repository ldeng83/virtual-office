import type { Point } from './world.ts';

export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
// Ease the facing direction instead of snapping to each new heading.
export const turnToward = (current: number, target: number, dt: number, rate = 10) => current + wrapAngle(target - current) * (1 - Math.exp(-dt * rate));

export type Mover = { speed: number };
// Moves along `path` (mutating it): speeds up from rest, slows for the final stretch, and
// rounds corners by heading for the next waypoint a little before reaching the current one.
// Returns the movement this frame, or null when there is nowhere left to go.
export function stepAlongPath(at: { x: number; z: number }, path: Point[], mover: Mover, dt: number, maxSpeed: number, corner = 0.3): { dx: number; dz: number } | null {
    while (path.length > 1 && Math.hypot(path[0][0] - at.x, path[0][1] - at.z) < corner)
        path.shift();
    if (!path.length) {
        mover.speed = 0;
        return null;
    }
    const [tx, tz] = path[0], dx = tx - at.x, dz = tz - at.z, d = Math.hypot(dx, dz);
    let remaining = d;
    for (let i = 1; i < path.length; i++)
        remaining += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    mover.speed = Math.min(maxSpeed, mover.speed + maxSpeed * 4 * dt, Math.max(0.6, remaining * 2.5));
    const step = mover.speed * dt;
    if (d <= step || d < 1e-4) {
        path.shift();
        if (!path.length)
            mover.speed = 0;
        return { dx, dz };
    }
    return { dx: dx / d * step, dz: dz / d * step };
}
