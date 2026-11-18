// The seam between the island and an app that hosts it (see IslandOffice). A host supplies the real
// people and the viewer; without one the island runs on its own with the demo coworkers.
export type HostLook = { skin?: string; hair: string; hairStyle: 'short' | 'long'; shirt: string; bottoms?: string };
export type HostPerson = {
  id: string;
  name: string;
  role: string;
  look: HostLook;
  // Only people who are present are on the island.
  present: boolean;
  // What they're working on, shown on their screen and in the feed.
  tasks: string[];
};
export type IslandHost = {
  me: { id: string; name: string; look: HostLook; checkedIn: boolean };
  people: HostPerson[];
  // Hour of the host's office day, 0–24. Used while the atmosphere follows real time.
  hour?: number;
  weather?: 'clear' | 'rain';
  // The host runs its own check-in; the island only asks for it.
  onCheckIn?: () => void;
  onPerson?: (id: string) => void;
};
