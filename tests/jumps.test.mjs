import test from 'node:test';
import assert from 'node:assert/strict';
import { shoreDistance, WALK_INSET } from '../src/shoreline.ts';
import { FOREST, groundHeight, inHighlands, inLake, LAKE, SUMMIT } from '../src/highlands.ts';
import { drawRoute, GENTLE_SECONDS, jumpPose, jumpSeconds, JUMP_ROUTES } from '../src/jumps.ts';
import { canCutAway, cutAway, rideExit, RIDE_SECONDS, startRide, stepRide } from '../src/rides.ts';
import { SEA } from '../src/open-sea.ts';
import { PLAYER_SCHEDULE } from '../src/autopilot.ts';
import { demoCoworkers } from '../src/people.ts';
import { hostedCoworkers } from '../src/hosted-people.ts';
import { findPath, locations, seats, walkable } from '../src/world.ts';

const ledges = seats.filter(s => s.ride && (s.ride.kind === 'wingsuit' || s.ride.kind === 'parachute'));
const ledge = kind => ledges.find(s => s.ride.kind === kind);
const each = fn => {
  for (const seat of ledges) seat.ride.routes.forEach((route, i) => fn(seat, route, i));
};
// Fly a jump to the end (or `limit` seconds), sampling as the scene would.
function fly(seat, trip, { gentle = false, dt = 0.05, limit = 60, at } = {}) {
  const view = startRide(seat, {}, [], 0, gentle);
  view.trip = trip;
  const samples = [];
  for (let t = 0; t < limit; t += dt) {
    if (at && at(view)) break;
    const done = stepRide(seat, view, dt);
    samples.push({ t: view.t, x: view.x, y: view.y, z: view.z, phase: view.phase });
    if (done) return { view, samples, done: true };
  }
  return { view, samples, done: false };
}
// What's in the way: the ground, plus treetops in the Highlands forest; on the office island, the
// palms along the beach and anything built.
function obstacleTop(x, z) {
  const ground = groundHeight(x, z);
  if (inHighlands(x, z)) {
    const tree = FOREST.filter(t => Math.hypot(t.x - x, t.z - z) < 1.6 * t.scale).reduce(
      (top, t) => Math.max(top, 4.6 * t.scale),
      0,
    );
    return ground + tree;
  }
  if (shoreDistance(x, z) > 0 || walkable(x, z)) return ground;
  return shoreDistance(x, z) > -WALK_INSET - 0.5 ? 3.4 : 8;
}

test('two ledges on the summit, one seat each, with three or more routes that land in different places', () => {
  assert.deepEqual(ledges.map(s => s.id).sort(), ['pc-0', 'ws-0']);
  for (const seat of ledges) {
    assert.ok(Math.hypot(seat.point[0] - SUMMIT[0], seat.point[1] - SUMMIT[1]) < 6, `${seat.id} is on the summit`);
    assert.equal(seat.ride.routes, JUMP_ROUTES[seat.ride.kind]);
    const routes = seat.ride.routes;
    assert.ok(routes.length >= 3, `${seat.id} has a choice of routes`);
    assert.equal(new Set(routes.map(r => r.name)).size, routes.length);
    assert.equal(new Set(routes.map(r => r.exit.join())).size, routes.length);
  }
});

test('a jump draws its route at random, never the same one twice in a row', () => {
  for (const seat of ledges) {
    const drawn = [];
    for (let i = 0; i < 300; i++) drawn.push(startRide(seat, {}).trip);
    for (let i = 1; i < drawn.length; i++) assert.notEqual(drawn[i], drawn[i - 1], `${seat.id} draw ${i}`);
    assert.equal(new Set(drawn).size, seat.ride.routes.length, `${seat.id} draws every route`);
    // The same pick twice still gives a different route; each ledge keeps its own memory.
    const a = startRide(seat, {}, [], 0).trip;
    assert.notEqual(startRide(seat, {}, [], 0).trip, a);
  }
  const first = drawRoute('test-ledge', 3, 0.99);
  assert.notEqual(drawRoute('test-ledge', 3, 0.99), first);
  assert.equal(drawRoute('another-ledge', 3, 0.99), first, 'ledges draw independently');
});

test('every route stays clear of the ground, the forest and the buildings all the way', () => {
  each((seat, route) => {
    const name = `${seat.ride.kind} "${route.name}"`,
      end = jumpSeconds(route);
    for (let t = 0; t <= end; t += 0.05) {
      const p = jumpPose(seat.ride.kind, route, t),
        ground = groundHeight(p.x, p.z),
        swimming = route.splash !== undefined && t >= route.splash;
      assert.ok(p.x > SEA.minX && p.x < SEA.maxX && p.z > SEA.minZ && p.z < SEA.maxZ, `${name} in the world`);
      // Into the lake, never through its bed; once in, swimming at the surface.
      if (inLake(p.x, p.z)) assert.ok(p.y >= LAKE.bed, `${name} above the lake bed at t=${t}`);
      else assert.ok(p.y >= ground - 0.02, `${name} above the ground at t=${t.toFixed(2)}`);
      if (swimming && inLake(p.x, p.z)) assert.ok(p.y <= LAKE.level, `${name} swims at t=${t}`);
      // Off the ledge and until the touchdown, well above anything in the way.
      const flying = t > 1.2 && t < end - 2.2 && !(route.splash !== undefined && t > route.splash - 1.2);
      if (flying)
        assert.ok(
          p.y - obstacleTop(p.x, p.z) >= 1.2,
          `${name} clears what's below at t=${t.toFixed(2)} (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`,
        );
      // Coming in to land: never through a tree, palm or roof, only the last second down to the ground.
      if (t >= end - 2.2 && t < end - 1) assert.ok(p.y >= obstacleTop(p.x, p.z), `${name} lands clear at t=${t}`);
    }
  });
});

test('each route ends standing at its exit, on walkable ground you can walk home from', () => {
  each((seat, route, i) => {
    const name = `${seat.ride.kind} "${route.name}"`,
      { view, samples, done } = fly(seat, i);
    assert.ok(done, `${name} finishes`);
    assert.ok(view.t <= RIDE_SECONDS[seat.ride.kind], `${name} fits the time allowed`);
    const [ex, ez] = route.exit;
    assert.ok(Math.hypot(view.x - ex, view.z - ez) < 0.05, `${name} ends at its exit`);
    assert.ok(Math.abs(view.y - groundHeight(ex, ez)) < 0.05, `${name} ends on the ground`);
    assert.deepEqual(rideExit(seat, view), route.exit);
    assert.ok(walkable(ex, ez), `${name} lands on walkable ground`);
    assert.ok(findPath(locations[0].point, route.exit).length, `${name} lands somewhere you can walk home from`);
    // The wingsuit flies, then pops its chute; the parachute falls, then opens; the lake route swims.
    const phases = [...new Set(samples.map(s => s.phase))];
    assert.deepEqual(
      phases,
      [seat.ride.kind === 'wingsuit' ? 'fly' : 'fall', 'canopy', ...(route.splash ? ['swim'] : []), 'landed'],
      name,
    );
  });
});

test('a movement key cuts away over land and floats you straight down; over water it is refused', () => {
  const wingsuit = ledge('wingsuit'),
    gorge = wingsuit.ride.routes.findIndex(r => r.name === 'Gorge run');
  // Out over the open sea: the jump carries on.
  const sea = fly(wingsuit, gorge, { at: v => v.t > 11 }).view;
  assert.ok(shoreDistance(sea.x, sea.z) > 2 && !canCutAway(sea.x, sea.z));
  assert.equal(cutAway(sea), false);
  assert.equal(sea.cut, undefined);
  const before = sea.x;
  stepRide(wingsuit, sea, 0.5);
  assert.notEqual(sea.x, before, 'the route plays on');
  // Swimming in the lake: refused too.
  const parachute = ledge('parachute'),
    splash = parachute.ride.routes.findIndex(r => r.name === 'Lake splash'),
    lake = fly(parachute, splash, { at: v => v.phase === 'swim' }).view;
  assert.ok(inLake(lake.x, lake.z));
  assert.equal(cutAway(lake), false);
  // Over the trailhead meadow: down you go, straight down, and stand where you came down.
  const meadow = parachute.ride.routes.findIndex(r => r.name === 'Meadow spiral'),
    over = fly(parachute, meadow, { at: v => v.t > 12 }).view;
  assert.ok(canCutAway(over.x, over.z));
  assert.equal(cutAway(over), true);
  const [cx, cz, cy] = [over.x, over.z, over.y];
  let y = cy,
    done = false;
  for (let i = 0; i < 400 && !done; i++) {
    done = stepRide(parachute, over, 0.05);
    assert.ok(Math.abs(over.x - cx) < 1e-9 && Math.abs(over.z - cz) < 1e-9, 'straight down');
    assert.ok(over.y <= y + 1e-9, 'only ever down');
    y = over.y;
  }
  assert.ok(done, 'lands');
  assert.ok(Math.abs(over.y - groundHeight(cx, cz)) < 1e-6);
  assert.deepEqual(rideExit(parachute, over), [cx, cz]);
  assert.equal(cutAway(over), false, 'only once');
});

test('with gentle motion you float straight down at the ledge, then land at the drawn route', () => {
  for (const seat of ledges) {
    const view = startRide(seat, {}, [], 0.5, true),
      [lx, lz] = seat.point;
    let done = false,
      y = view.y;
    for (let i = 0; i < 400 && !done; i++) {
      done = stepRide(seat, view, 0.05);
      assert.ok(Math.hypot(view.x - lx, view.z - lz) < 0.7, `${seat.id} stays at the ledge`);
      assert.ok(view.y <= y + 1e-9 && view.y >= groundHeight(view.x, view.z) - 0.02, `${seat.id} floats down`);
      y = view.y;
    }
    assert.ok(done && view.t <= GENTLE_SECONDS + 0.1, `${seat.id} is over quickly`);
    assert.deepEqual(rideExit(seat, view), seat.ride.routes[view.trip].exit);
  }
});

test('your autopilot sometimes jumps; coworkers never do', () => {
  const golden = PLAYER_SCHEDULE.golden.errands;
  for (const id of ['ws-0', 'pc-0']) {
    const errand = golden.find(a => a.seats?.includes(id));
    assert.ok(errand, `autopilot can pick ${id}`);
    assert.ok(errand.weight < 1, 'now and then');
    assert.ok(errand.dwell[0] >= RIDE_SECONDS[seats.find(s => s.id === id).ride.kind]);
  }
  const people = [
    ...demoCoworkers,
    ...hostedCoworkers(
      Array.from({ length: 30 }, (_, i) => ({
        id: `p${i}`,
        name: `p${i}`,
        role: 'Teammate',
        present: true,
        tasks: [],
        look: { hair: '#222', hairStyle: 'short', shirt: '#7193b5' },
      })),
    ),
  ];
  for (const person of people)
    for (const p of Object.keys(person.schedule)) {
      const block = person.schedule[p];
      for (const a of block ? [block.home, ...block.errands] : [])
        for (const id of a.seats ?? []) assert.ok(!/^(ws|pc)-/.test(id), `${person.name} doesn't jump (${id})`);
    }
});
