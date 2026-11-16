import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRIDGE_FOOT,
  CAMPSITE,
  CAVE,
  checkpoints,
  DECKS,
  deckAt,
  deckHeight,
  FOREST,
  groundHeight,
  highlandsDistance,
  LANDING,
  nearTrail,
  SUMMIT,
  TRAILS,
} from '../src/highlands.ts';
import { shoreDistance } from '../src/shoreline.ts';
import { findPath, locations, walkable } from '../src/world.ts';
import { demoCoworkers, resolveTarget } from '../src/people.ts';

const ARRIVAL = locations[0].point;
// Points every `step` units along a polyline.
function along(points, step = 0.5) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step);
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

test('the Highlands sit across a strait north of the office, reached by the rope bridge', () => {
  assert.ok(shoreDistance(...LANDING) > 10, 'the landing is well off the office island');
  assert.ok(highlandsDistance(...LANDING) < 0, 'the landing is on the Highlands');
  const strait = DECKS.find(d => d.id === 'strait');
  // Walkable end to end, at the deck's height.
  for (const p of along([strait.a, strait.b], 0.25)) {
    assert.ok(walkable(...p), `bridge walkable at ${p}`);
    assert.ok(Math.abs(groundHeight(...p) - deckAt(...p).height) < 1e-9);
  }
  // Stairs at both ends meet the ground; the deck never jumps.
  assert.ok(
    Math.abs(deckHeight(strait, 0) - 0) < 0.05 && Math.abs(deckHeight(strait, 1) - groundHeight(...LANDING)) < 0.25,
  );
  for (let t = 0; t < 1; t += 0.005) assert.ok(Math.abs(deckHeight(strait, t + 0.005) - deckHeight(strait, t)) < 0.2);
  assert.ok(walkable(...BRIDGE_FOOT) && findPath(ARRIVAL, LANDING).length, 'reachable from the pier');
});

test('trails are walkable from end to end, with gentle grades and reachable trailheads', () => {
  for (const trail of TRAILS) {
    const points = along(trail.points, 0.25);
    for (const p of points) assert.ok(walkable(...p), `${trail.name} blocked at ${p.map(v => v.toFixed(1))}`);
    // Over every 2 units the path rises at most 0.75 per unit.
    const span = 8;
    for (let i = 0; i + span < points.length; i++)
      assert.ok(
        Math.abs(groundHeight(...points[i + span]) - groundHeight(...points[i])) / 2 < 0.75,
        `${trail.name} too steep at ${points[i]}`,
      );
    assert.ok(findPath(ARRIVAL, trail.points[0]).length, `${trail.name} trailhead reachable`);
    assert.ok(checkpoints(trail).length >= 3, `${trail.name} has checkpoints`);
  }
  // The summit trail climbs high; the summit, cave and campsite can all be reached.
  assert.ok(groundHeight(...SUMMIT) > 14);
  for (const p of [
    SUMMIT,
    [CAVE.x + Math.sin(CAVE.facing) * 1.6, CAVE.z + Math.cos(CAVE.facing) * 1.6],
    [CAMPSITE.x + 2.6, CAMPSITE.z + 2.4],
  ])
    assert.ok(findPath(LANDING, p).length, `reachable: ${p}`);
});

test('off the trails the mountain is too steep to walk straight up', () => {
  // Straight up the south face, between the switchbacks.
  const face = along([
    [16.7, -88.5],
    [16.9, -95.5],
  ]);
  assert.ok(face.some(p => !walkable(...p)));
});

test('the forest stays off trails, bridges and water, and trees block walking', () => {
  assert.ok(FOREST.length > 120, 'a real forest');
  for (const t of FOREST) {
    assert.ok(!nearTrail(t.x, t.z, 1.6), 'no tree on a trail');
    assert.ok(highlandsDistance(t.x, t.z) < -2.8, 'trees grow inland');
    assert.ok(!walkable(t.x, t.z), 'trees are solid');
  }
  assert.ok(new Set(FOREST.map(t => t.kind)).size === 3, 'pines, birches and palms');
});

test('Maya and Theo hike the trails', () => {
  const hikes = demoCoworkers.flatMap(p =>
    Object.values(p.schedule)
      .flatMap(b => (b ? [b.home, ...b.errands] : []))
      .filter(a => a.trail),
  );
  assert.deepEqual([...new Set(hikes.map(a => a.trail))].sort(), ['falls', 'lake', 'summit']);
  for (const a of hikes) {
    const target = resolveTarget(a, new Set(), () => 0);
    assert.deepEqual(target.route, TRAILS.find(t => t.id === a.trail).points);
    assert.ok(findPath(ARRIVAL, target.approach).length);
  }
});
