import test from 'node:test';
import assert from 'node:assert/strict';
import { shoreDistance, shorePoint, shoreRadius, shoreSlope, ISLAND_SCALE, WALK_INSET } from '../src/shoreline.ts';
import { findPath, walkable } from '../src/world.ts';

test('island has five times the previous land area while keeping the dock coast fixed', () => {
    let area = 0, previousArea = 0;
    for (let i = 0; i < 4096; i++) {
        const angle = i / 4096 * Math.PI * 2;
        const radius = shoreRadius(angle) - WALK_INSET;
        previousArea += (shoreRadius(angle) / ISLAND_SCALE - 1.25) ** 2 * 1.28 * Math.PI / 4096;
        area += radius * radius * 1.28 * Math.PI / 4096;
        const [x, z] = shorePoint(angle);
        assert.ok(Math.abs(shoreDistance(x, z)) < 1e-10);
        assert.ok(Math.abs(shoreDistance(...shorePoint(angle, 1.5)) - 1.5) < 1e-10);
        const numericalSlope = (shoreRadius(angle + 1e-6) - shoreRadius(angle - 1e-6)) / 2e-6;
        assert.ok(Math.abs(shoreSlope(angle) - numericalSlope) < 5e-6);
    }
    assert.ok(Math.abs(area / previousArea - 5) < 1e-9);
    assert.ok(Math.abs(shorePoint(Math.PI / 2)[1] - 10.4) < 1e-10);
});
test('new garden and grove ground is walkable and connected to arrival', () => {
    for (const point of [[0, -11], [13, -3], [-6, -9], [-4, -10]]) {
        assert.ok(walkable(...point));
        assert.ok(findPath([0, 7], point).length);
    }
});
