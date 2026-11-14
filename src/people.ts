import { locations, meetingTables, seats, type Point } from './world.ts';
import type { Period } from './daylight.ts';

// One shape for everyone on the island. Today two demo coworkers are driven locally from a
// daily routine; later the same records will arrive from the shared presence server.
export type PresenceStatus = 'Available' | 'Focused' | 'In a meeting' | 'Away';
export type Slot = {
    place: string;
    status: Exclude<PresenceStatus, 'Away'>;
    activity: string;
    // Preferred seats in order; the first one the player isn't sitting in is used.
    seats?: string[];
    // Or stand at a point, facing `face`.
    point?: Point;
    face?: Point;
};
export type DemoCoworker = {
    id: string;
    name: string;
    role: string;
    color: string;
    hair: string;
    greetings: string[];
    focusReply: string;
    schedule: Record<Period, Slot | null>;
};
export type Target = { point: Point; angle: number; seatId: string | null; slot: Slot };

export const ARRIVAL_DOCK: Point = locations[0].point;
const [westTable] = meetingTables;

export const demoCoworkers: DemoCoworker[] = [
    {
        id: 'maya', name: 'Maya', role: 'Product designer', color: '#7193b5', hair: '#2f2a28',
        greetings: ['Morning! Have you seen the new garden paths?', 'Hey! Grab me later if you want feedback on anything.', 'Hi! The light here today is lovely.'],
        focusReply: 'Deep in focus right now. Catch you after?',
        schedule: {
            dawn: null,
            morning: { place: 'The studio', status: 'Focused', activity: 'Sketching wireframes', seats: ['desk-2', 'desk-3'] },
            midday: { place: 'Meeting grove', status: 'In a meeting', activity: 'Design review', point: [westTable[0] - 1.6, westTable[1]], face: westTable },
            golden: { place: 'Quiet forest', status: 'Focused', activity: 'Heads-down focus time', seats: ['forest-bench', 'pond-bench'] },
            dusk: null,
            night: null,
        },
    },
    {
        id: 'theo', name: 'Theo', role: 'Engineer', color: '#a88bb9', hair: '#7a5236',
        greetings: ['Hey! Coffee by the fire later?', 'Hi there! How is your day going?', 'Yo! Just pushed a fix, feeling good.'],
        focusReply: 'Head down on a bug — ping me in a bit!',
        schedule: {
            dawn: null,
            morning: { place: 'Campfire', status: 'Available', activity: 'Morning coffee', seats: ['log-1', 'log-2'] },
            midday: { place: 'Meeting grove', status: 'In a meeting', activity: 'Design review', point: [westTable[0] + 0.8, westTable[1] + 1.4], face: westTable },
            golden: { place: 'The studio', status: 'Available', activity: 'Shipping a fix', seats: ['desk-6', 'desk-8'] },
            dusk: { place: 'Social beach', status: 'Available', activity: 'Winding down by the sea', seats: ['beach-seat-2', 'beach-seat-3'] },
            night: null,
        },
    },
];

export function resolveTarget(slot: Slot | null, playerSeat: string | null): Target | null {
    if (!slot)
        return null;
    if (slot.seats) {
        const id = slot.seats.find(s => s !== playerSeat) ?? slot.seats[0];
        const seat = seats.find(s => s.id === id);
        if (!seat)
            throw new Error(`Unknown seat ${id}`);
        return { point: seat.point, angle: seat.angle, seatId: seat.id, slot };
    }
    const point = slot.point!, face = slot.face ?? point;
    return { point, angle: Math.atan2(face[0] - point[0], face[1] - point[1]), seatId: null, slot };
}

// Positions are written every frame by the scene and read by the map / proximity checks.
export const peopleView: Record<string, { x: number; z: number; present: boolean }> = {};
