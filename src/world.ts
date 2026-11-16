import { shoreDistance, shorePoint, WALK_INSET } from './shoreline.ts';
export type Point = [
    number,
    number
];
// ---- Campus layout (world units: x east, z south; the arrival pier is on the south shore) ----
// Building pads: floors now, walls and roofs later. `glass` pads become see-through pavilions.
export type Pad = { id: string; name: string; x: number; z: number; w: number; d: number; style: 'building' | 'glass' | 'plot' };
export const pads: Pad[] = [
    { id: 'lobby', name: 'Lobby', x: 0, z: 2.5, w: 8, d: 4.5, style: 'glass' },
    { id: 'hq', name: 'Main workspace', x: 0, z: -25, w: 20, d: 9, style: 'building' },
    { id: 'pav-s', name: 'Pavilion S', x: 12, z: -6, w: 4, d: 4, style: 'glass' },
    { id: 'pav-m', name: 'Pavilion M', x: 19, z: -14, w: 6.5, d: 5.5, style: 'glass' },
    { id: 'pav-l', name: 'Pavilion L', x: 17, z: -25.5, w: 8.5, d: 6.5, style: 'glass' },
    { id: 'library', name: 'Focus library', x: -17, z: -15, w: 10, d: 7, style: 'building' },
    { id: 'cafe', name: 'Café', x: 11, z: 0, w: 6.5, d: 4.5, style: 'building' },
    { id: 'future', name: 'Future plot', x: 7.5, z: -34.2, w: 7, d: 4.2, style: 'plot' },
];
export const plaza = { x: 0, z: -9, radius: 6, fountain: 1.6 };
export const amphitheater = { x: -12, z: -2, stage: 1.5, tiers: [2.8, 4.3, 5.8], from: 150 * Math.PI / 180, to: 300 * Math.PI / 180 };
export const garden = { x: -10, z: -33, loopX: 5.8, loopZ: 3.4 };
export const ponds = [{ x: garden.x, z: garden.z, rx: 2.6, rz: 1.5 }];
export const boardwalk = { from: [24.8, -22] as Point, bend: [29.2, -12] as Point, to: [24.8, -2.5] as Point };
export const newsScreen = { x: 0, z: -13.8, w: 3.6 };
export const WHITEBOARD: Point = [16.05, -14];
export const WHITEBOARD_FACING: Point = [17.05, -14];
export const WHITEBOARD_SPOT: Point = [16.75, -14];
// Furniture that blocks walking: half-extents already include room for the avatar.
type Block = { x: number; z: number; hx: number; hz: number } | { x: number; z: number; r: number };
export const tables = {
    pavS: { x: 12, z: -6, r: 0.3 },
    pavM: { x: 19.4, z: -14, w: 2.8, d: 1.3 },
    pavL: { x: 17, z: -25.5, w: 5.2, d: 1.7 },
    counter: { x: 11, z: -1.2, w: 4.2, d: 0.8 },
    reception: { x: -2.2, z: 2.0, w: 2.6, d: 0.9 },
    terrace: [[9.6, 3.4], [12.4, 3.4]] as Point[],
    atrium: { x: 0, z: -25, w: 2.6, d: 2.6 },
};
// 14 desks: Design (west half) and Engineering (east half) of the main workspace.
export const desks = [-1, 1].flatMap((side, team) => Array.from({ length: 7 }, (_, i) => {
    const col = i % 4, row = Math.floor(i / 4), x = side < 0 ? -8.9 + col * 2.2 : 2.3 + col * 2.2;
    return { id: `desk-${team * 7 + i}`, x, z: row ? -22.4 : -27.6, team: team ? 'Engineering' : 'Design' };
}));
export const booths = Array.from({ length: 6 }, (_, i) => ({ id: `booth-${i}`, x: -20.4 + (i % 3) * 3.4, z: i < 3 ? -16.9 : -13.3 }));
export type Seat = { id: string; name: string; point: Point; angle: number; kind?: 'chair' | 'bench' | 'stool' | 'lounger' | 'armchair' };
const facing = (from: Point, to: Point) => Math.atan2(to[0] - from[0], to[1] - from[1]);
const ring = (cx: number, cz: number, r: number, angles: number[], name: string, id: string, kind: Seat['kind'], rz = r): Seat[] => angles.map((a, i) => {
    const point: Point = [cx + Math.cos(a) * r, cz + Math.sin(a) * rz];
    return { id: `${id}-${i}`, name, point, angle: facing(point, [cx, cz]), kind };
});
export const seats: Seat[] = [
    ...desks.map((d, i) => ({ id: d.id, name: `${d.team} desk ${i % 7 + 1}`, point: [d.x, d.z + 0.95] as Point, angle: Math.PI })),
    ...[18.5, 19.4, 20.3].flatMap((x, i) => [
        { id: `pm-${i}`, name: 'Pavilion M seat', point: [x, -15.3] as Point, angle: 0 },
        { id: `pm-${i + 3}`, name: 'Pavilion M seat', point: [x, -12.7] as Point, angle: Math.PI },
    ]),
    ...[15, 16, 17, 18, 19].flatMap((x, i) => [
        { id: `pl-${i}`, name: 'Pavilion L seat', point: [x, -27] as Point, angle: 0 },
        { id: `pl-${i + 5}`, name: 'Pavilion L seat', point: [x, -24] as Point, angle: Math.PI },
    ]),
    { id: 'pl-10', name: 'Pavilion L seat', point: [13.6, -25.5], angle: Math.PI / 2 },
    { id: 'pl-11', name: 'Pavilion L seat', point: [20.4, -25.5], angle: -Math.PI / 2 },
    { id: 'ps-0', name: 'Pavilion S armchair', point: [11.2, -6], angle: Math.PI / 2, kind: 'armchair' },
    { id: 'ps-1', name: 'Pavilion S armchair', point: [12.8, -6], angle: -Math.PI / 2, kind: 'armchair' },
    ...booths.map(b => ({ id: b.id, name: 'Library focus booth', point: [b.x, b.z + 0.5] as Point, angle: Math.PI })),
    ...[9.6, 11, 12.4].map((x, i) => ({ id: `cs-${i}`, name: 'Café counter stool', point: [x, -0.15] as Point, angle: Math.PI, kind: 'stool' as const })),
    ...tables.terrace.flatMap(([x, z], t) => [
        { id: `ts-${t * 3}`, name: 'Terrace seat', point: [x - 0.9, z] as Point, angle: Math.PI / 2 },
        { id: `ts-${t * 3 + 1}`, name: 'Terrace seat', point: [x + 0.9, z] as Point, angle: -Math.PI / 2 },
        { id: `ts-${t * 3 + 2}`, name: 'Terrace seat', point: [x, z + 0.9] as Point, angle: Math.PI },
    ]),
    ...[1.6, 2.6, 3.6].map((x, i) => ({ id: `lb-${i}`, name: 'Lobby armchair', point: [x, 1.3] as Point, angle: 0, kind: 'armchair' as const })),
    ...ring(plaza.x, plaza.z, 4.4, [1, 3, 5, 7].map(n => n * Math.PI / 4), 'Plaza bench', 'pz', 'bench'),
    ...amphitheater.tiers.flatMap((r, tier) => {
        const count = [5, 6, 5][tier];
        return ring(amphitheater.x, amphitheater.z, r, Array.from({ length: count }, (_, i) => amphitheater.from + (i + 0.5) / count * (amphitheater.to - amphitheater.from)), 'Town hall seat', `am${tier}`, 'bench');
    }),
    ...ring(garden.x, garden.z, garden.loopX, [160, 20, 270].map(d => d * Math.PI / 180), 'Garden bench', 'gb', 'bench', garden.loopZ),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `bw-${i}`, name: 'Boardwalk lounger', point: [27.4 - Math.abs(i - 2) * 0.55, -18.5 + i * 3.2] as Point, angle: Math.PI / 2, kind: 'lounger' as const })),
];
// Places in the sidebar and on the map.
export const locations = [
    { id: 'arrival', name: 'Arrival pier', detail: 'Land here and say hello', point: [0, 7] as Point, color: '#c9a87e' },
    { id: 'plaza', name: 'Central plaza', detail: 'Where every walkway meets', point: [0, -2.6] as Point, color: '#d9c9a2' },
    { id: 'office', name: 'Main workspace', detail: 'Desks for Design and Engineering', point: [0, -19.6] as Point, color: '#c7a57c' },
    { id: 'meeting', name: 'Meeting pavilions', detail: 'Rooms for 2, 6 and 12', point: [15.4, -9.6] as Point, color: '#8fb7b3' },
    { id: 'cafe', name: 'Café & terrace', detail: 'Coffee with a sea view', point: [11, 1.9] as Point, color: '#e8a27f' },
    { id: 'library', name: 'Focus library', detail: 'Quiet booths for deep work', point: [-17, -10.8] as Point, color: '#9c8cb8' },
    { id: 'townhall', name: 'Town hall', detail: 'All-hands, demos and celebrations', point: [-9.2, -0.4] as Point, color: '#d2b68d' },
    { id: 'wellness', name: 'Wellness garden', detail: 'A walking loop around the pond', point: [garden.x, garden.z + garden.loopZ] as Point, color: '#8fb07e' },
    { id: 'boardwalk', name: 'Boardwalk', detail: 'Loungers by the east beach', point: [25.6, -12] as Point, color: '#d8c08f' },
];
export const districts = locations;
// Walkways: spokes from the plaza to every zone.
export const walkways: Point[][] = [
    [[0, 7], [0, 4.75]], [[0, 0.25], [0, -3]], [[0, -15], [0, -20.5]], [[4.5, -7], [10, -6]], [[14, -6], [16, -11.3]], [[5, -12], [12.8, -22.3]],
    [[-5.2, -11], [-12, -14]], [[4.3, -5], [8, -2.3]], [[-4.6, -6], [-8.8, -4]], [[-6, -29.5], [-8.6, -29.9]], [[14.3, -0.5], [24.8, -3.5]], [[22.3, -14], [26, -13.5]], [[10.5, -28.8], [8.5, -32.1]],
];
const blocks: Block[] = [
    { x: plaza.x, z: plaza.z, r: plaza.fountain + 0.3 },
    { x: newsScreen.x, z: newsScreen.z, hx: newsScreen.w / 2 + 0.25, hz: 0.35 },
    ...[tables.pavM, tables.pavL, tables.counter, tables.reception, tables.atrium].map(t => ({ x: t.x, z: t.z, hx: t.w / 2 + 0.3, hz: t.d / 2 + 0.25 })),
    { x: tables.pavS.x, z: tables.pavS.z, r: tables.pavS.r + 0.25 },
    ...tables.terrace.map(([x, z]) => ({ x, z, r: 0.7 })),
    { x: WHITEBOARD[0], z: WHITEBOARD[1], hx: 0.45, hz: 0.95 },
    ...booths.flatMap(b => [{ x: b.x, z: b.z - 0.45, hx: 0.8, hz: 0.45 }, { x: b.x - 1.1, z: b.z - 0.2, hx: 0.25, hz: 0.8 }, { x: b.x + 1.1, z: b.z - 0.2, hx: 0.25, hz: 0.8 }]),
];
export function segmentDistance(point: Point, a: Point, b: Point) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dz);
}
// Palms ring the coast, plus a few shade trees on the lawns, kept clear of everything people use.
function clearForTree(point: Point) {
    return shoreDistance(...point) < -WALK_INSET - 1
        && locations.every(l => Math.hypot(l.point[0] - point[0], l.point[1] - point[1]) > 2.5)
        && seats.every(s => Math.hypot(s.point[0] - point[0], s.point[1] - point[1]) > 1.5)
        && pads.every(p => Math.abs(point[0] - p.x) > p.w / 2 + 1.2 || Math.abs(point[1] - p.z) > p.d / 2 + 1.2)
        && Math.hypot(point[0] - plaza.x, point[1] - plaza.z) > plaza.radius + 1.5
        && Math.hypot(point[0] - amphitheater.x, point[1] - amphitheater.z) > 7.2
        && ((point[0] - garden.x) / (garden.loopX + 1.4)) ** 2 + ((point[1] - garden.z) / (garden.loopZ + 1.4)) ** 2 > 1
        && segmentDistance(point, boardwalk.from, boardwalk.bend) > 2.5 && segmentDistance(point, boardwalk.bend, boardwalk.to) > 2.5
        && walkways.every(path => path.slice(1).every((p, i) => segmentDistance(point, path[i], p) > 1.6));
}
export const trees: Point[] = [];
for (let i = 0; i < 36; i++) {
    const point = shorePoint(i / 36 * Math.PI * 2, -WALK_INSET - 1.3);
    if (clearForTree(point)) trees.push(point);
}
for (const point of [[-7, -17], [7, -16.5], [-22, -24], [22, -32], [-5, 3.5], [20, -5.5], [-24, -8], [-3, -36]] as Point[])
    if (clearForTree(point)) trees.push(point);
export function walkable(x: number, z: number) {
    if (shoreDistance(x, z) > -WALK_INSET)
        return false;
    if (desks.some(d => Math.abs(x - d.x) < 0.73 && Math.abs(z - d.z) < 0.57))
        return false;
    if (trees.some(t => Math.hypot(x - t[0], z - t[1]) < 0.65))
        return false;
    if (blocks.some(b => 'r' in b ? Math.hypot(x - b.x, z - b.z) < b.r : Math.abs(x - b.x) < b.hx && Math.abs(z - b.z) < b.hz))
        return false;
    if (ponds.some(p => ((x - p.x) / (p.rx + 0.25)) ** 2 + ((z - p.z) / (p.rz + 0.25)) ** 2 < 1))
        return false;
    return true;
}
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const octile = (a: Point, b: Point) => { const dx = Math.abs(a[0] - b[0]), dz = Math.abs(a[1] - b[1]); return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); };
// A straight segment is clear when the centre line and a little either side stay walkable.
export function clearLine(a: Point, b: Point, margin = 0.15) {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    if (!length)
        return true;
    const nx = -dz / length * margin, nz = dx / length * margin;
    for (let i = 1, steps = Math.ceil(length / 0.1); i <= steps; i++) {
        const x = a[0] + dx * i / steps, z = a[1] + dz * i / steps;
        if (!walkable(x, z) || (i < steps && (!walkable(x + nx, z + nz) || !walkable(x - nx, z - nz))))
            return false;
    }
    return true;
}
// String pulling: from each corner, jump to the furthest waypoint still in a clear straight line.
export function smoothPath(start: Point, route: Point[]): Point[] {
    const out: Point[] = [];
    let from = start, i = 0;
    while (i < route.length) {
        let j = route.length - 1;
        while (j > i && !clearLine(from, route[j]))
            j--;
        out.push(route[j]);
        from = route[j];
        i = j + 1;
    }
    return out;
}
// A* visits the useful part of the larger map; static cell checks are shared across routes.
const gridCache = new Map<string, boolean>();
function gridWalkable(x: number, z: number) {
    const key = `${x},${z}`;
    if (!gridCache.has(key)) gridCache.set(key, walkable(x / 2, z / 2));
    return gridCache.get(key)!;
}
// Grid A* (8 directions, no corner cutting), then straightened so routes run in clean lines.
export function findPath(start: Point, end: Point): Point[] {
    const route = gridPath(start, end);
    return route.length ? smoothPath(start, route) : route;
}
function gridPath(start: Point, end: Point): Point[] {
    if (!walkable(...end)) return [];
    const s = start.map(v => Math.round(v * 2)) as Point, e = end.map(v => Math.round(v * 2)) as Point;
    const key = (p: Point) => p.join(',');
    const heap: { point: Point; score: number; cost: number }[] = [];
    const push = (entry: typeof heap[number]) => { heap.push(entry); let i = heap.length - 1; while (i > 0) { const parent = (i - 1) >> 1; if (heap[parent].score <= entry.score) break; heap[i] = heap[parent]; i = parent; } heap[i] = entry; };
    const pop = () => { const first = heap[0], last = heap.pop()!; if (heap.length) { let i = 0; while (i * 2 + 1 < heap.length) { let child = i * 2 + 1; if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child++; if (heap[child].score >= last.score) break; heap[i] = heap[child]; i = child; } heap[i] = last; } return first; };
    const prev = new Map<string, Point | null>([[key(s), null]]), costs = new Map<string, number>([[key(s), 0]]);
    push({ point: s, score: 0, cost: 0 });
    while (heap.length) {
        const { point: p, cost } = pop();
        if (cost !== costs.get(key(p))) continue;
        if (key(p) === key(e)) { const route: Point[] = [end]; let current: Point | null = p; while (current && key(current) !== key(s)) { route.unshift([current[0] / 2, current[1] / 2]); current = prev.get(key(current)) ?? null; } return route; }
        for (const [dx, dz] of STEPS) {
            // Diagonals only when both side cells are open, so routes never clip an obstacle's corner.
            if (dx && dz && !(gridWalkable(p[0] + dx, p[1]) && gridWalkable(p[0], p[1] + dz))) continue;
            const n: Point = [p[0] + dx, p[1] + dz], nextCost = cost + (dx && dz ? Math.SQRT2 : 1);
            if (gridWalkable(...n) && nextCost < (costs.get(key(n)) ?? Infinity)) { costs.set(key(n), nextCost); prev.set(key(n), p); push({ point: n, cost: nextCost, score: nextCost + octile(n, e) }); }
        }
    }
    return [];
}
