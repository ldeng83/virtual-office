export type Profile = {
  name: string;
  color: string;
  status: string;
  checked: boolean;
  // Present when a host supplies a full avatar. Standalone play keeps the defaults.
  hair?: string;
  hairStyle?: 'short' | 'long';
  skin?: string;
  bottoms?: string;
};
export const DEFAULT_NAME = 'Le Deng';
// Two-letter initials for avatar badges (Bin Yang → BY, so the two Bins differ).
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
export function readProfile(): Profile {
  try {
    const saved = JSON.parse(localStorage.getItem('atoll-profile') || '{}');
    // Profiles saved before names were set default to the old placeholder.
    if (saved.name === 'You') delete saved.name;
    return {
      ...{ name: DEFAULT_NAME, color: '#d9815f', status: 'Available', checked: false },
      ...saved,
    };
  } catch {
    return { name: DEFAULT_NAME, color: '#d9815f', status: 'Available', checked: false };
  }
}
export const colors = ['#d9815f', '#7b9c79', '#7193b5', '#a88bb9', '#d4ae55'];
