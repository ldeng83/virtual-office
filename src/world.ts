import { shoreDistance, shorePoint, WALK_INSET } from './shoreline.ts';
export type Point = [
    number,
    number
];
export const beach = { x: 20, z: -4, radius: 5 };
export const garden = { x: -6, z: -8.9 };
export const meetingTables: Point[] = [[6.5, -6.5], [10, -2.5]];
export const gardenPaths: Point[][] = [[[-3.5, -4.4], [-3.5, -7], [-6, -8.7]], [[1, -1.2], [4.5, -2.2], [8, -4.8]]];
export const districts = [
    { id: 'village', name: 'Office village', detail: 'Your familiar working home', point: [-5, 0] as Point, color: '#d2b28a' },
    { id: 'forest', name: 'Quiet forest', detail: 'Pond trails & secluded focus spots', point: [-15, -17] as Point, color: '#65876b' },
    { id: 'beach', name: 'Social beach', detail: 'Gather by the bigger campfire', point: [19, -1] as Point, color: '#dbb280' },
    { id: 'peninsula', name: 'Garden peninsula', detail: 'Flowers & a coastal lookout', point: [7, -30] as Point, color: '#93a67e' },
    { id: 'coast', name: 'Wild coast', detail: 'Rock pools & open ocean', point: [-22, -5] as Point, color: '#829fa8' },
];
export const ponds = [{ x: -18, z: -22, rx: 3.2, rz: 2.5 }];
export const coastRocks = [[-25, -7, 0.9], [-26, -4, 1.1], [-23, -2, 0.75], [-24.5, -10, 1]];
export const districtTrails: Point[][] = [
    [[-3.5, -7], [-5.5, -7], [-6, -9.5], [-9, -11], [-15, -17], [-13, -22], [-5, -25], [4, -23], [7, -30], [10, -35]],
    [[8, -4.8], [13, -7], [18, -5], [19, -1], [22, -1]],
    [[-15, -17], [-21, -12], [-22, -5], [-15, -1], [-13, 3], [-10, 5], [-6, 5], [0, 5]],
    [[7, -30], [2, -34], [-3, -30], [-5, -25]],
];
export function segmentDistance(point: Point, a: Point, b: Point) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dz);
}
export const locations = [
    { id: 'arrival', name: 'Arrival dock', detail: 'A fresh start', point: [0, 7] as Point },
    { id: 'office', name: 'The studio', detail: 'Make yourself at home', point: [-5, 0] as Point },
    { id: 'meeting', name: 'Meeting grove', detail: 'Room for a good idea', point: [8, -4.8] as Point },
    { id: 'social', name: 'Campfire', detail: 'Take a little breather', point: [3.5, 5.5] as Point },
    { id: 'garden', name: 'Quiet garden', detail: 'Find your flow', point: [-6, -8.7] as Point },
    ...districts.slice(1),
];
export const desks = Array.from({ length: 10 }, (_, i) => ({ id: `desk-${i}`, x: -8 + (i % 5) * 1.9, z: -2.8 + Math.floor(i / 5) * 3.8 }));
export const seats = [...desks.map((d, i) => ({ id: d.id, name: `Desk ${i + 1}`, point: [d.x, d.z + 0.95] as Point, angle: Math.PI })),
    { id: 'bench', name: 'Garden bench', point: [-6, -10.3] as Point, angle: 0 },
    { id: 'garden-bench', name: 'Garden retreat bench', point: [-4, -10] as Point, angle: Math.PI / 3 },
    ...[0, 1, 2, 3].map((i) => ({ id: `log-${i}`, name: 'Campfire seat', point: [5 + Math.cos(i * Math.PI / 2) * 1.6, 4 + Math.sin(i * Math.PI / 2) * 1.6] as Point, angle: -i * Math.PI / 2 - Math.PI / 2 }))];
seats.push(
    { id: 'forest-bench', name: 'Forest focus bench', point: [-13, -18.5], angle: -Math.PI / 2 },
    { id: 'pond-bench', name: 'Pond-side bench', point: [-14, -22.5], angle: -Math.PI / 2 },
    { id: 'lookout-bench', name: 'Coastal lookout bench', point: [10, -35], angle: Math.PI },
    { id: 'flower-bench', name: 'Flower garden bench', point: [5, -31], angle: Math.PI / 3 },
    { id: 'coast-bench', name: 'Wild coast lookout', point: [-21, -6], angle: Math.PI / 2 },
    ...[0, 1, 2, 3, 4, 5].map(i => ({ id: `beach-seat-${i}`, name: 'Beach gathering seat', point: [beach.x + Math.cos(i * Math.PI / 3) * 2.4, beach.z + Math.sin(i * Math.PI / 3) * 2.4] as Point, angle: -i * Math.PI / 3 - Math.PI / 2 })),
);
export const trees: Point[] = [[-10, 3], [-10, -3], [-9, -6], [-8, -8], [-4, -8], [-1, -8], [2, -8], [8, -6], [10, -3], [10, 0], [9, 5], [7, 7], [-7, 6], [-4, 7], [-11, 0]];
function clearForTree(point: Point) {
    return shoreDistance(...point) < -WALK_INSET - 1
        && locations.every(l => Math.hypot(l.point[0] - point[0], l.point[1] - point[1]) > 2)
        && seats.every(s => Math.hypot(s.point[0] - point[0], s.point[1] - point[1]) > 1.5)
        && [...gardenPaths, ...districtTrails].every(path => path.slice(1).every((p, i) => segmentDistance(point, path[i], p) > 1.7))
        && ponds.every(p => ((point[0] - p.x) / (p.rx + 1)) ** 2 + ((point[1] - p.z) / (p.rz + 1)) ** 2 > 1);
}
for (let i = 0; i < 30; i++) {
    const point = shorePoint(i / 30 * Math.PI * 2, -WALK_INSET - 1.5);
    if (clearForTree(point)) trees.push(point);
}
export const forestTrees: Point[] = [];
for (let i = 0; i < 90; i++) {
    const point: Point = [-26 + ((i * 7.31) % 20), -32 + ((i * 5.73) % 24)];
    if (clearForTree(point) && trees.every(t => Math.hypot(t[0] - point[0], t[1] - point[1]) > 1.7) && forestTrees.every(t => Math.hypot(t[0] - point[0], t[1] - point[1]) > 2.1)) forestTrees.push(point);
}
export function walkable(x: number, z: number) {
    if (shoreDistance(x, z) > -WALK_INSET)
        return false;
    if (desks.some(d => Math.abs(x - d.x) < 0.73 && Math.abs(z - d.z) < 0.57))
        return false;
    if ([...trees, ...forestTrees].some(t => Math.hypot(x - t[0], z - t[1]) < 0.65))
        return false;
    if (Math.hypot(x - 5, z - 4) < 0.85)
        return false;
    if (meetingTables.some(p => Math.hypot(x - p[0], z - p[1]) < 0.9))
        return false;
    if (ponds.some(p => ((x - p.x) / (p.rx + 0.25)) ** 2 + ((z - p.z) / (p.rz + 0.25)) ** 2 < 1)) return false;
    if (coastRocks.some(([rx, rz, r]) => Math.hypot(x - rx, z - rz) < r + 0.2)) return false;
    if (Math.hypot(x - beach.x, z - beach.z) < 0.95) return false;
    return true;
}
// A* visits the useful part of the larger map; static cell checks are shared across routes.
const gridCache = new Map<string, boolean>();
function gridWalkable(x: number, z: number) {
    const key = `${x},${z}`;
    if (!gridCache.has(key)) gridCache.set(key, walkable(x / 2, z / 2));
    return gridCache.get(key)!;
}
export function findPath(start: Point, end: Point): Point[] {
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
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const n: Point = [p[0] + dx, p[1] + dz], nextCost = cost + 1;
            if (gridWalkable(...n) && nextCost < (costs.get(key(n)) ?? Infinity)) { costs.set(key(n), nextCost); prev.set(key(n), p); push({ point: n, cost: nextCost, score: nextCost + Math.abs(n[0] - e[0]) + Math.abs(n[1] - e[1]) }); }
        }
    }
    return [];
}
