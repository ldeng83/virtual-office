// Touch walking and pinch zoom. The stick writes `touchSteer` every move; the scene reads it
// in the same frame, so dragging never re-renders React.

export const touchSteer = { x: 0, y: 0, active: false };

// Stick offset in pixels. A short nudge stays centred; a full drag reaches 1 in that direction.
// y is screen space: negative is up (walk forward), positive is down.
export function stickVector(dx: number, dy: number, radius: number) {
  const len = Math.hypot(dx, dy);
  if (!(radius > 0) || len < 8) return { x: 0, y: 0 };
  const scale = Math.min(1, len / radius);
  return { x: (dx / len) * scale, y: (dy / len) * scale };
}

// Pinch: spreading fingers raises the zoom, within the same limits as the on-screen buttons.
export function pinchZoom(current: number, previousDistance: number, nextDistance: number, min: number, max: number) {
  if (!(previousDistance > 0) || !(nextDistance > 0)) return current;
  return Math.min(max, Math.max(min, current * (nextDistance / previousDistance)));
}

// Keyboard axes, plus the stick while a finger is down. Null when they cancel out.
export function movementAxes(
  keys: { has(key: string): boolean },
  stick: { active: boolean; x: number; y: number },
): { x: number; z: number } | null {
  let x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  let z = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  if (stick.active) {
    x += stick.x;
    z += stick.y;
  }
  return Math.hypot(x, z) >= 0.08 ? { x, z } : null;
}

// Camera-relative movement: x is strafe, z is forward/back (negative forward, matching W).
export function steerVector(x: number, z: number, azimuth: number): [number, number] {
  return [x * Math.cos(azimuth) + z * Math.sin(azimuth), -x * Math.sin(azimuth) + z * Math.cos(azimuth)];
}

// Phones and tablets, and a laptop once a finger has actually touched the screen.
export const wantsTouchNav = (coarse: boolean, seenTouch: boolean) => coarse || seenTouch;
