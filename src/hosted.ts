import type { HostLook, IslandHost } from './host.ts';
import type { Profile } from './profile.ts';

// Small pure pieces of running inside a host app (see IslandOffice).

// The same defaults the avatar body uses when a field is missing, so a partial host look
// still reads as a finished person instead of a shirt floating over a blank head.
export const DEFAULT_LOOK = {
  color: '#d9815f',
  hair: '#5b5147',
  hairStyle: 'short' as const,
  skin: '#e8bc98',
  bottoms: '#495b60',
};
export type AvatarLook = {
  color: string;
  hair: string;
  hairStyle: 'short' | 'long';
  skin: string;
  bottoms: string;
};
const paint = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

// Shirt, hair, hairstyle, skin and bottoms, with a fallback for anything the host left out.
export function avatarLook(look?: Partial<HostLook> | null): AvatarLook {
  return {
    color: paint(look?.shirt, DEFAULT_LOOK.color),
    hair: paint(look?.hair, DEFAULT_LOOK.hair),
    hairStyle: look?.hairStyle === 'long' || look?.hairStyle === 'short' ? look.hairStyle : DEFAULT_LOOK.hairStyle,
    skin: paint(look?.skin, DEFAULT_LOOK.skin),
    bottoms: paint(look?.bottoms, DEFAULT_LOOK.bottoms),
  };
}

// Who you are comes from the host; your island status stays your own.
export const hostedProfile = (me: IslandHost['me'], stored: Profile): Profile => {
  const look = avatarLook(me.look);
  return {
    name: (me.name ?? '').trim() || 'You',
    color: look.color,
    hair: look.hair,
    hairStyle: look.hairStyle,
    skin: look.skin,
    bottoms: look.bottoms,
    status: stored.status,
    checked: !!me.checkedIn,
  };
};

// A host that sends weather owns the sky. A manual shower only runs when it doesn't.
export function islandWeather(hostWeather: string | undefined, localRain: boolean) {
  if (hostWeather === undefined) return { raining: localRain, manual: true };
  return { raining: hostWeather === 'rain', manual: false };
}

// The check-in button. A host app writes the record, so the label asks for that instead of toggling locally.
export function checkInLabel(hosted: boolean, checked: boolean) {
  if (hosted) return checked ? 'Edit today’s update' : 'Check in';
  return checked ? 'Check out' : 'Check in to the island';
}

type KeyTarget = { tagName?: string; isContentEditable?: boolean };
// Whether a key press is meant for the island: pressed with nothing focused, or with focus inside
// the island, and never while typing. A host page has its own buttons and forms around the island.
export function keysAllowed(
  target: unknown,
  root: { contains: (node: never) => boolean } | null,
  body: unknown = typeof document === 'undefined' ? null : document.body,
  // On a host page the body belongs to the page: arrow keys there scroll it.
  hosted = false,
): boolean {
  const el = target as KeyTarget | null;
  if (!el || !root) return false;
  if (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName ?? '')) return false;
  return (el === body && !hosted) || root.contains(el as never);
}
// The same check for a key event, against the island on this page.
export function islandKey(event: KeyboardEvent) {
  const root = document.querySelector<HTMLElement>('.island-root');
  return keysAllowed(event.target, root, document.body, root?.dataset.hosted === 'true');
}
// The wheel over the island always zooms it, hosted or not: the island fills the host's window, and
// the host page scrolls from anywhere outside it.
export const wheelZooms = (_event: { ctrlKey: boolean; metaKey: boolean }, _hosted: boolean) => true;

// When a hosted island has loaded it takes the keyboard, so the arrow keys move you straight away;
// but never away from something the visitor has already focused on the host page.
export const takesFocus = (active: unknown, body: unknown) => !active || active === body;

// "12:30 PM" from an hour of the day such as 12.5.
export function hourLabel(hour: number) {
  const minutes = Math.min(1439, Math.max(0, Math.floor(hour * 60))),
    h = Math.floor(minutes / 60),
    m = minutes % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
