import test from 'node:test';
import assert from 'node:assert/strict';
import { shoreDistance, WALK_INSET } from '../src/shoreline.ts';
import {
  ROOF_Y,
  jetty,
  lampPosts,
  flowerBeds,
  lobbyPlanter,
  findPath,
  walkable,
  locations,
  desks,
  seats,
  trees,
  ponds,
  pads,
  plaza,
  tables,
  booths,
  walkways,
} from '../src/world.ts';

test('island boundary, trees, desks, furniture and the pond block movement', () => {
  assert.equal(walkable(60, 0), false);
  assert.equal(walkable(0, 17), false);
  for (const d of desks) assert.equal(walkable(d.x, d.z), false);
  for (const t of trees) assert.equal(walkable(...t), false);
  for (const p of ponds) assert.equal(walkable(p.x, p.z), false);
  assert.equal(walkable(plaza.x, plaza.z), false, 'fountain');
  for (const t of [tables.pavM, tables.pavL, tables.counter, tables.reception, tables.atrium])
    assert.equal(walkable(t.x, t.z), false);
  for (const b of booths) assert.equal(walkable(b.x, b.z - 0.45), false);
  assert.equal(walkable(...locations[0].point), true);
});
test('every place is connected by a collision-free route', () => {
  for (const start of locations)
    for (const end of locations) {
      const route = findPath(start.point, end.point);
      assert.ok(route.length, `${start.name} → ${end.name}`);
      for (const point of route) assert.ok(walkable(...point));
      assert.deepEqual(route.at(-1), end.point);
    }
});
test('seats are solid, and every seat has a free step-in spot reachable from the pier', () => {
  assert.ok(seats.length >= 70);
  assert.equal(new Set(seats.map(s => s.id)).size, seats.length, 'seat ids are unique');
  for (const seat of seats) {
    assert.ok(walkable(...seat.approach), `${seat.id} step-in spot is blocked`);
    assert.ok(findPath(locations[0].point, seat.approach).length, `${seat.id} unreachable`);
    if (seat.y) continue; // rooftop seats are reached by the stair, above walkable ground
    assert.equal(walkable(...seat.point), false, `${seat.id} can be walked through`);
    assert.ok(
      Math.hypot(seat.approach[0] - seat.point[0], seat.approach[1] - seat.point[1]) <=
        (seat.fixedApproach ? 1.8 : 1.3),
      `${seat.id} step-in spot is too far`,
    );
  }
});
test('fun spots: rooftop seats sit on the roof, the jetty is walkable over water, kayaks float', () => {
  for (const seat of seats.filter(s => s.id.startsWith('rt-'))) assert.equal(seat.y, ROOF_Y);
  assert.ok(walkable(jetty.x0 + 1, jetty.z), 'end of the jetty');
  assert.ok(findPath(locations[0].point, [jetty.x0 + 1.4, jetty.z]).length, 'jetty reachable');
  assert.equal(walkable(jetty.x0 + 1, jetty.z + 2), false, 'water beside the jetty');
  for (const seat of seats.filter(s => s.kind === 'kayak')) assert.equal(walkable(...seat.point), false);
});
test('lamp posts, flower beds and the lobby planter block walking', () => {
  for (const p of [...lampPosts, ...flowerBeds, lobbyPlanter]) assert.equal(walkable(...p), false, String(p));
});
test('invalid destinations return no path', () => {
  assert.deepEqual(findPath(locations[0].point, [100, 100]), []);
  assert.deepEqual(findPath(locations[0].point, [desks[0].x, desks[0].z]), []);
});
test('campus is sized for the team: 14 desks, 20 meeting seats, 6 focus booths', () => {
  assert.equal(desks.length, 14);
  assert.equal(seats.filter(s => /^(pm|pl|ps)-/.test(s.id)).length, 20);
  assert.equal(booths.length, 6);
});
test('walkways stay clear of obstacles', () => {
  for (const path of walkways)
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i],
        steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 4);
      for (let n = 0; n <= steps; n++) {
        const t = n / steps;
        assert.ok(walkable(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), `blocked walkway ${a} → ${b}`);
      }
    }
});
test('building pads sit on land and never overlap', () => {
  for (const p of pads)
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ])
      assert.ok(
        shoreDistance(p.x + (sx * p.w) / 2, p.z + (sz * p.d) / 2) < -WALK_INSET,
        `${p.name} corner is off the island`,
      );
  for (const a of pads)
    for (const b of pads)
      if (a !== b)
        assert.ok(
          Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2,
          `${a.name} overlaps ${b.name}`,
        );
});
