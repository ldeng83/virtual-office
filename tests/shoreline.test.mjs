import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shoreDistance,
  shorePoint,
  shoreRadius,
  shoreSlope,
  GROWTH,
  ISLAND_CENTER_Z,
  ISLAND_SCALE,
} from '../src/shoreline.ts';
import { findPath, locations, walkable } from '../src/world.ts';

const ARRIVAL = locations[0].point;

test('island is 5 × GROWTH² the original area, grown around the same centre', () => {
  let area = 0,
    previousArea = 0;
  for (let i = 0; i < 4096; i++) {
    const angle = (i / 4096) * Math.PI * 2;
    // The original island had the same outline at 1/(√5·GROWTH) the size.
    previousArea += ((shoreRadius(angle) / ISLAND_SCALE) ** 2 * 1.28 * Math.PI) / 4096;
    area += (shoreRadius(angle) ** 2 * 1.28 * Math.PI) / 4096;
    const [x, z] = shorePoint(angle);
    assert.ok(Math.abs(shoreDistance(x, z)) < 1e-10);
    assert.ok(Math.abs(shoreDistance(...shorePoint(angle, 1.5)) - 1.5) < 1e-10);
    const numericalSlope = (shoreRadius(angle + 1e-6) - shoreRadius(angle - 1e-6)) / 2e-6;
    assert.ok(Math.abs(shoreSlope(angle) - numericalSlope) < 5e-6);
  }
  assert.ok(Math.abs(area / previousArea - 5 * GROWTH ** 2) < 1e-9);
  assert.ok(Math.abs(shorePoint(Math.PI / 2)[1] - (ISLAND_CENTER_Z + 10.4 * ISLAND_SCALE)) < 1e-10);
  // The arrival pier sits on the south coast, inside the walkable land.
  assert.ok(walkable(...ARRIVAL));
  assert.equal(walkable(ARRIVAL[0], shorePoint(Math.PI / 2)[1] + 0.5), false);
});
test('open lawn across the campus is walkable and connected to arrival', () => {
  for (const point of [
    [-7.2, -17.83],
    [16.8, -1.03],
    [-7.2, -8.23],
    [26.4, -21.43],
  ]) {
    assert.ok(walkable(...point));
    assert.ok(findPath(ARRIVAL, point).length);
  }
});
