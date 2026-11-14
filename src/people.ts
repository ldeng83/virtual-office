import { locations, meetingTables, ponds, seats, type Point } from './world.ts';
import type { Period } from './daylight.ts';

// One shape for everyone on the island. Today two demo coworkers are driven locally by a small
// activity planner; later the same records will arrive from the shared presence server.
export type PresenceStatus = 'Available' | 'Focused' | 'In a meeting' | 'Away';
export type Pose = 'desk' | 'talk' | 'sip' | 'look';
export type Activity = {
    place: string;
    status: Exclude<PresenceStatus, 'Away'>;
    activity: string;
    icon: string;
    pose: Pose;
    // How long to stay once arrived, in seconds [min, max].
    dwell: [number, number];
    // Relative chance of picking this errand (home activities ignore it).
    weight?: number;
    // Preferred seats in order; the first free one is used.
    seats?: string[];
    // Or stand at a point, facing `face`.
    point?: Point;
    face?: Point;
    // Time spent here moves their current task forward.
    work?: boolean;
};
export type Task = { title: string; icon: string; seconds: number };
export type WorkState = { task: number; progress: number };
// Each part of the day has a "home" activity and short errands the coworker pops out for.
export type Block = { home: Activity; errands: Activity[] };
export type DemoCoworker = {
    id: string;
    name: string;
    role: string;
    color: string;
    hair: string;
    greetings: string[];
    focusReply: string;
    // What their screen shows while working, and the demo backlog they cycle through.
    craft: 'design' | 'code';
    tasks: Task[];
    schedule: Record<Period, Block | null>;
};
export type Target = { point: Point; angle: number; seatId: string | null; activity: Activity; dwell: number };

export const ARRIVAL_DOCK: Point = locations[0].point;
const [westTable] = meetingTables;
const [pond] = ponds;
// The meeting grove whiteboard stands beside the table, clear of the canopy and trees, turned
// toward the default camera so its drawings are readable; Theo's sketching spot is just in front.
export const WHITEBOARD: Point = [westTable[0] - 2.9, westTable[1] + 1.1];
export const WHITEBOARD_FACING: Point = [WHITEBOARD[0] + Math.sin(0.53), WHITEBOARD[1] + Math.cos(0.53)];
export const WHITEBOARD_SPOT: Point = [WHITEBOARD[0] + Math.sin(0.53) * 0.75, WHITEBOARD[1] + Math.cos(0.53) * 0.75];

const coffee = (seatIds: string[]): Activity => ({ place: 'Campfire', status: 'Available', activity: 'Grabbing a coffee', icon: '☕', pose: 'sip', dwell: [12, 22], weight: 3, seats: seatIds });

export const demoCoworkers: DemoCoworker[] = [
    {
        id: 'maya', name: 'Maya', role: 'Product designer', color: '#7193b5', hair: '#2f2a28',
        greetings: ['Morning! Have you seen the new garden paths?', 'Hey! Grab me later if you want feedback on anything.', 'Hi! The light here today is lovely.'],
        focusReply: 'Deep in focus right now. Catch you after?',
        craft: 'design',
        tasks: [
            { title: 'Onboarding flow redesign', icon: '🎨', seconds: 70 },
            { title: 'Settings page icons', icon: '🖼️', seconds: 55 },
            { title: 'Island map polish', icon: '🗺️', seconds: 65 },
        ],
        schedule: {
            dawn: null,
            morning: {
                home: { place: 'The studio', status: 'Focused', activity: 'Sketching wireframes', icon: '✏️', pose: 'desk', dwell: [25, 50], seats: ['desk-2', 'desk-3'], work: true },
                errands: [
                    coffee(['log-3', 'log-0']),
                    { place: 'Quiet garden', status: 'Available', activity: 'Stretching her legs', icon: '🌿', pose: 'look', dwell: [12, 28], weight: 1, seats: ['garden-bench', 'bench'] },
                ],
            },
            midday: {
                home: { place: 'Meeting grove', status: 'In a meeting', activity: 'Design review', icon: '💬', pose: 'talk', dwell: [25, 50], point: [westTable[0] - 1.6, westTable[1]], face: westTable },
                errands: [
                    { place: 'Meeting grove', status: 'In a meeting', activity: 'Pacing while she thinks', icon: '🤔', pose: 'look', dwell: [8, 16], weight: 3, point: [westTable[0] - 0.8, westTable[1] - 1.4], face: westTable },
                    { place: 'The studio', status: 'In a meeting', activity: 'Fetching her sketches', icon: '📄', pose: 'desk', dwell: [12, 28], weight: 1, seats: ['desk-2', 'desk-3'] },
                ],
            },
            golden: {
                home: { place: 'Quiet forest', status: 'Focused', activity: 'Heads-down focus time', icon: '🎧', pose: 'look', dwell: [25, 50], seats: ['forest-bench', 'pond-bench'], work: true },
                errands: [
                    { place: 'Quiet forest', status: 'Available', activity: 'A slow lap of the pond', icon: '🦆', pose: 'look', dwell: [12, 28], weight: 2, point: [pond.x, pond.z + 3.2], face: [pond.x, pond.z] },
                    coffee(['log-3', 'log-0']),
                ],
            },
            dusk: null,
            night: null,
        },
    },
    {
        id: 'theo', name: 'Theo', role: 'Engineer', color: '#a88bb9', hair: '#7a5236',
        greetings: ['Hey! Coffee by the fire later?', 'Hi there! How is your day going?', 'Yo! Just pushed a fix, feeling good.'],
        focusReply: 'Head down on a bug — ping me in a bit!',
        craft: 'code',
        tasks: [
            { title: 'Fix login timeout', icon: '🐛', seconds: 55 },
            { title: 'Speed up the build', icon: '⚡', seconds: 70 },
            { title: 'Presence server spike', icon: '🛰️', seconds: 80 },
        ],
        schedule: {
            dawn: null,
            morning: {
                home: { place: 'The studio', status: 'Available', activity: 'Coding', icon: '💻', pose: 'desk', dwell: [25, 50], seats: ['desk-6', 'desk-8'], work: true },
                errands: [
                    { place: 'Campfire', status: 'Available', activity: 'Morning coffee', icon: '☕', pose: 'sip', dwell: [12, 28], weight: 2, seats: ['log-1', 'log-2'] },
                    { place: 'Social beach', status: 'Available', activity: 'Watching the waves', icon: '🌊', pose: 'look', dwell: [12, 28], weight: 1, seats: ['beach-seat-4', 'beach-seat-5'] },
                ],
            },
            midday: {
                home: { place: 'Meeting grove', status: 'In a meeting', activity: 'Design review', icon: '💬', pose: 'talk', dwell: [25, 50], point: [westTable[0] + 0.8, westTable[1] + 1.4], face: westTable },
                errands: [
                    { place: 'Meeting grove', status: 'In a meeting', activity: 'Sketching on the whiteboard', icon: '🖊️', pose: 'talk', dwell: [8, 16], weight: 3, point: WHITEBOARD_SPOT, face: WHITEBOARD },
                    { place: 'Campfire', status: 'In a meeting', activity: 'Grabbing snacks', icon: '🍪', pose: 'sip', dwell: [12, 28], weight: 1, seats: ['log-1', 'log-2'] },
                ],
            },
            golden: {
                home: { place: 'The studio', status: 'Available', activity: 'Shipping a fix', icon: '💻', pose: 'desk', dwell: [25, 50], seats: ['desk-6', 'desk-8'], work: true },
                errands: [
                    coffee(['log-1', 'log-2']),
                    { place: 'Social beach', status: 'Available', activity: 'Beach walk', icon: '🌊', pose: 'look', dwell: [12, 28], weight: 1, seats: ['beach-seat-4', 'beach-seat-5'] },
                ],
            },
            dusk: {
                home: { place: 'Social beach', status: 'Available', activity: 'Winding down by the sea', icon: '🌅', pose: 'look', dwell: [25, 50], seats: ['beach-seat-2', 'beach-seat-3'] },
                errands: [
                    { place: 'Campfire', status: 'Available', activity: 'Campfire chat', icon: '🔥', pose: 'talk', dwell: [12, 28], weight: 1, seats: ['log-1', 'log-2'] },
                ],
            },
            night: null,
        },
    },
];

// Home → weighted errand → home → … Coworkers always return home between errands.
export function nextActivity(block: Block, current: Activity | null, random = Math.random): Activity {
    if (!current || current !== block.home || !block.errands.length)
        return block.home;
    const total = block.errands.reduce((sum, e) => sum + (e.weight ?? 1), 0);
    let roll = random() * total;
    for (const errand of block.errands) {
        roll -= errand.weight ?? 1;
        if (roll < 0)
            return errand;
    }
    return block.errands[block.errands.length - 1];
}

// Working time moves the current task forward; finishing starts the next task in the backlog.
export function advanceWork(person: DemoCoworker, state: WorkState, seconds: number): { state: WorkState; finished: Task | null } {
    const task = person.tasks[state.task % person.tasks.length];
    const progress = state.progress + seconds / task.seconds;
    if (progress < 1)
        return { state: { task: state.task, progress }, finished: null };
    return { state: { task: (state.task + 1) % person.tasks.length, progress: 0 }, finished: task };
}
export const currentTask = (person: DemoCoworker, state: WorkState) => person.tasks[state.task % person.tasks.length];

// `taken` holds seats already in use (by you or another coworker).
export function resolveTarget(activity: Activity | null, taken: ReadonlySet<string> = new Set(), random = Math.random): Target | null {
    if (!activity)
        return null;
    const dwell = activity.dwell[0] + (activity.dwell[1] - activity.dwell[0]) * random();
    if (activity.seats) {
        const id = activity.seats.find(s => !taken.has(s)) ?? activity.seats[0];
        const seat = seats.find(s => s.id === id);
        if (!seat)
            throw new Error(`Unknown seat ${id}`);
        return { point: seat.point, angle: seat.angle, seatId: seat.id, activity, dwell };
    }
    const point = activity.point!, face = activity.face ?? point;
    return { point, angle: Math.atan2(face[0] - point[0], face[1] - point[1]), seatId: null, activity, dwell };
}

// Positions are written every frame by the scene and read by the map / proximity checks.
export const peopleView: Record<string, { x: number; z: number; present: boolean }> = {};
