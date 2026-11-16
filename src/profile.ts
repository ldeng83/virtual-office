export type Profile = {
  name: string;
  color: string;
  status: string;
  checked: boolean;
};
export function readProfile(): Profile {
  try {
    return {
      ...{ name: 'You', color: '#d9815f', status: 'Available', checked: false },
      ...JSON.parse(localStorage.getItem('atoll-profile') || '{}'),
    };
  } catch {
    return { name: 'You', color: '#d9815f', status: 'Available', checked: false };
  }
}
export const colors = ['#d9815f', '#7b9c79', '#7193b5', '#a88bb9', '#d4ae55'];
