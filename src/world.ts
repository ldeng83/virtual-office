export type Point = [
    number,
    number
];
export const locations = [
    { id: 'arrival', name: 'Arrival dock', detail: 'A fresh start', point: [0, 7] as Point },
    { id: 'office', name: 'The studio', detail: 'Make yourself at home', point: [-5, 0] as Point },
    { id: 'meeting', name: 'Meeting grove', detail: 'Room for a good idea', point: [6, -3] as Point },
    { id: 'social', name: 'Campfire', detail: 'Take a little breather', point: [3.5, 5.5] as Point },
    { id: 'garden', name: 'Quiet garden', detail: 'Find your flow', point: [-6, -6] as Point },
];
export const desks = Array.from({ length: 10 }, (_, i) => ({ id: `desk-${i}`, x: -8 + (i % 5) * 1.9, z: -2.8 + Math.floor(i / 5) * 3.8 }));
export const seats = [...desks.map((d, i) => ({ id: d.id, name: `Desk ${i + 1}`, point: [d.x, d.z + 0.95] as Point, angle: Math.PI })),
    { id: 'bench', name: 'Garden bench', point: [-6, -7] as Point, angle: 0 },
    ...[0, 1, 2, 3].map((i) => ({ id: `log-${i}`, name: 'Campfire seat', point: [5 + Math.cos(i * Math.PI / 2) * 1.6, 4 + Math.sin(i * Math.PI / 2) * 1.6] as Point, angle: -i * Math.PI / 2 - Math.PI / 2 }))];
export const trees: Point[] = [[-10, 3], [-10, -3], [-9, -6], [-8, -8], [-4, -8], [-1, -8], [2, -8], [8, -6], [10, -3], [10, 0], [9, 5], [7, 7], [-7, 6], [-4, 7], [-11, 0]];
export function walkable(x: number, z: number) {
    if ((x / 11.7) ** 2 + (z / 9) ** 2 > 1)
        return false;
    if (desks.some(d => Math.abs(x - d.x) < 0.73 && Math.abs(z - d.z) < 0.57))
        return false;
    if (trees.some(t => Math.hypot(x - t[0], z - t[1]) < 0.65))
        return false;
    if (Math.hypot(x - 5, z - 4) < 0.85)
        return false;
    if ([[5, -5], [8, -2]].some(p => Math.hypot(x - p[0], z - p[1]) < 0.9))
        return false;
    return true;
}
// A small navigation grid keeps click-to-move routes around furniture.
export function findPath(start: Point, end: Point): Point[] {
    const cell = (p: Point) => p.map(v => Math.round(v * 2)) as Point;
    const s = cell(start), e = cell(end), key = (p: Point) => p.join(',');
    if (!walkable(end[0], end[1]))
        return [];
    const queue: Point[] = [s], prev = new Map<string, Point | null>([[key(s), null]]);
    for (let i = 0; i < queue.length; i++) {
        const p = queue[i];
        if (key(p) === key(e)) {
            const route: Point[] = [end];
            let c: Point | null = p;
            while (c && key(c) !== key(s)) {
                route.unshift([c[0] / 2, c[1] / 2]);
                c = prev.get(key(c)) ?? null;
            }
            return route;
        }
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const n: Point = [p[0] + dx, p[1] + dz];
            if (!prev.has(key(n)) && walkable(n[0] / 2, n[1] / 2)) {
                prev.set(key(n), p);
                queue.push(n);
            }
        }
    }
    return [];
}
