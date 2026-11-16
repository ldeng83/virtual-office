import test from 'node:test';
import assert from 'node:assert/strict';
import { findPath, clearLine, walkable, locations, seats } from '../src/world.ts';

const length = (start, route) =>
  route.reduce(
    (sum, p, i) => sum + Math.hypot(p[0] - (i ? route[i - 1] : start)[0], p[1] - (i ? route[i - 1] : start)[1]),
    0,
  );
const segmentsClear = (start, route) =>
  route.every((p, i) => {
    const a = i ? route[i - 1] : start,
      steps = Math.ceil(Math.hypot(p[0] - a[0], p[1] - a[1]) / 0.05);
    for (let k = 1; k <= steps; k++)
      if (!walkable(a[0] + ((p[0] - a[0]) * k) / steps, a[1] + ((p[1] - a[1]) * k) / steps)) return false;
    return true;
  });

test('every route between places walks only on open ground, including between waypoints', () => {
  for (const a of locations)
    for (const b of locations) {
      const route = findPath(a.point, b.point);
      assert.ok(route.length, `${a.name} → ${b.name}`);
      assert.ok(segmentsClear(a.point, route), `${a.name} → ${b.name} crosses an obstacle`);
    }
  for (const seat of seats)
    assert.ok(segmentsClear(locations[0].point, findPath(locations[0].point, seat.point)), seat.name);
});

test('open ground is crossed in a straight line, not a staircase', () => {
  const start = locations[0].point,
    end = [start[0] + 3, start[1] - 1.5];
  assert.ok(clearLine(start, end));
  assert.deepEqual(findPath(start, end), [end]);
});

test('smoothed routes are short: close to the straight-line distance when open, few corners overall', () => {
  for (const a of locations)
    for (const b of locations) {
      if (a === b) continue;
      const route = findPath(a.point, b.point),
        direct = Math.hypot(a.point[0] - b.point[0], a.point[1] - b.point[1]);
      // Up the mountain, routes follow the switchbacks rather than the straight line; between two
      // Highlands spots the way round can be much longer than the crow flies (via the trailhead).
      const highlands = Math.min(a.point[1], b.point[1]) < -56;
      if (Math.max(a.point[1], b.point[1]) >= -56)
        assert.ok(
          length(a.point, route) < direct * (highlands ? 3 : 1.6) + (highlands ? 10 : 2),
          `${a.name} → ${b.name} is a long detour`,
        );
      // Mountain routes follow the switchbacks, so they turn more often.
      const limit = Math.min(a.point[1], b.point[1]) < -56 ? 28 : 14;
      assert.ok(route.length <= limit, `${a.name} → ${b.name} has ${route.length} waypoints`);
    }
});
