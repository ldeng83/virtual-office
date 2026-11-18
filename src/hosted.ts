import type { IslandHost } from './host.ts';
import type { Profile } from './profile.ts';

// Small pure pieces of running inside a host app (see IslandOffice).

// Who you are comes from the host; your island status stays your own.
export const hostedProfile = (me: IslandHost['me'], stored: Profile): Profile => ({
  name: me.name.trim() || 'You',
  color: me.look.shirt,
  status: stored.status,
  checked: me.checkedIn,
});

type KeyTarget = { tagName?: string; isContentEditable?: boolean };
// Whether a key press is meant for the island: pressed with nothing focused, or with focus inside
// the island, and never while typing. A host page has its own buttons and forms around the island.
export function keysAllowed(
  target: unknown,
  root: { contains: (node: never) => boolean } | null,
  body: unknown = typeof document === 'undefined' ? null : document.body,
): boolean {
  const el = target as KeyTarget | null;
  if (!el || !root) return false;
  if (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName ?? '')) return false;
  return el === body || root.contains(el as never);
}
// The same check for a key event, against the island on this page.
export const islandKey = (event: KeyboardEvent) => keysAllowed(event.target, document.querySelector('.island-root'));

// "12:30 PM" from an hour of the day such as 12.5.
export function hourLabel(hour: number) {
  const minutes = Math.min(1439, Math.max(0, Math.floor(hour * 60))),
    h = Math.floor(minutes / 60),
    m = minutes % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
