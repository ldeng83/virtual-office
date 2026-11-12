export const ISLAND_X_SCALE = 1.28;
export const ISLAND_SCALE = Math.sqrt(5);
export const ISLAND_CENTER_Z = 10.4 * (1 - ISLAND_SCALE);
export const WALK_INSET = 1.25 * ISLAND_SCALE;
export const OVERVIEW_CENTER: [number, number, number] = [2.8, 0, ISLAND_CENTER_Z - 1.6 * ISLAND_SCALE];
const BASE_RADIUS = 10.4;
const GARDEN_EXPANSION = 3.2;
const GROVE_EXPANSION = 2;
export function shoreRadius(angle: number) {
    return (BASE_RADIUS + GARDEN_EXPANSION * Math.max(0, -Math.sin(angle)) ** 2 + GROVE_EXPANSION * Math.max(0, Math.cos(angle)) ** 4) * ISLAND_SCALE;
}
export function shoreSlope(angle: number) {
    return ISLAND_SCALE * (-2 * GARDEN_EXPANSION * Math.max(0, -Math.sin(angle)) * (Math.sin(angle) < 0 ? Math.cos(angle) : 0)
        - 4 * GROVE_EXPANSION * Math.max(0, Math.cos(angle)) ** 3 * Math.sin(angle));
}
export function shorePoint(angle: number, offset = 0): [number, number] {
    const radius = shoreRadius(angle) + offset;
    return [Math.cos(angle) * radius * ISLAND_X_SCALE, ISLAND_CENTER_Z + Math.sin(angle) * radius];
}
export function shoreDistance(x: number, z: number) {
    return Math.hypot(x / ISLAND_X_SCALE, z - ISLAND_CENTER_Z) - shoreRadius(Math.atan2(z - ISLAND_CENTER_Z, x / ISLAND_X_SCALE));
}
// The ocean shader uses the same contour as terrain, walking, and animal habitats.
export const shorelineGLSL = `
    float coastDistance(vec2 p) {
        vec2 q = vec2(p.x / ${ISLAND_X_SCALE.toFixed(2)}, p.y - ${ISLAND_CENTER_Z.toFixed(10)});
        float a = atan(q.y, q.x);
        float north = max(0.0, -sin(a));
        float east = max(0.0, cos(a));
        float radius = ${BASE_RADIUS.toFixed(1)} + ${GARDEN_EXPANSION.toFixed(1)} * north * north + ${GROVE_EXPANSION.toFixed(1)} * east * east * east * east;
        return length(q) - radius * ${ISLAND_SCALE.toFixed(10)};
    }
`;
