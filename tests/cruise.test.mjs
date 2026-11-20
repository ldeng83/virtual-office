import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BERTH,
  BOARD_SECONDS,
  boardAt,
  boardingWalk,
  boatPose,
  companyPeriod,
  cruiseRoute,
  CYCLE_SECONDS,
  DECK_SPOTS,
  deckRoute,
  deckStep,
  departsAt,
  freeDeckSpot,
  gangwayOpen,
  GANGWAY_FOOT,
  GANGWAY_TOP,
  leavesDeck,
  leavingWalk,
  onDeck,
  pierWait,
  routeSpeed,
  sailingAt,
  toDeck,
  toWorld,
  TRIP_SECONDS,
  tripFor,
  voyageStep,
  whaleMeet,
} from '../src/cruise.ts';
import { DOCKS } from '../src/boat-trips.ts';
import { shoreDistance } from '../src/shoreline.ts';
import { highlandsDistance } from '../src/highlands.ts';
import { whalePose } from '../src/open-sea.ts';
import { demoCoworkers, nextActivity, resolveTarget, ARRIVAL_DOCK } from '../src/people.ts';
import { PLAYER_SCHEDULE } from '../src/autopilot.ts';
import { findPath, segmentDistance, walkable } from '../src/world.ts';

const land = (x, z) => Math.min(shoreDistance(x, z), highlandsDistance(x, z));
// A sailing well in the future (any will do: everything is a function of the clock).
const FIRST = Math.floor(Date.UTC(2026, 10, 20, 12) / 1000 / CYCLE_SECONDS);
const at = (sailing, seconds) => (sailing * CYCLE_SECONDS + seconds) * 1000;
// One of each trip, and a run of whale runs.
const sample = (() => {
  const picked = new Map();
  for (let n = FIRST; n < FIRST + 600 && picked.size < 4; n++) if (!picked.has(tripFor(n))) picked.set(tripFor(n), n);
  for (let n = FIRST, runs = 0; n < FIRST + 300 && runs < 12; n++)
    if (tripFor(n) === 'whales') picked.set(`w${runs++}`, n);
  return [...picked.values()];
})();
const HULL_CORNERS = [
  [-2.2, -5.5],
  [2.2, -5.5],
  [2.2, 2.6],
  [-2.2, 2.6],
  [0, 5.6],
];

test('the timetable boards, rings, sails and comes back on the same cycle everywhere', () => {
  const n = FIRST;
  assert.equal(sailingAt(at(n, 0)).phase, 'boarding');
  assert.equal(sailingAt(at(n, 10)).departsIn, BOARD_SECONDS - 10);
  assert.equal(sailingAt(at(n, BOARD_SECONDS + 2)).phase, 'departing');
  assert.equal(sailingAt(at(n, BOARD_SECONDS + 60)).phase, 'sailing');
  assert.equal(sailingAt(at(n, CYCLE_SECONDS - 5)).phase, 'arriving');
  assert.equal(sailingAt(at(n, BOARD_SECONDS + 60)).backIn, TRIP_SECONDS - 60);
  assert.equal(sailingAt(at(n, CYCLE_SECONDS)).sailing, n + 1);
  assert.equal(departsAt(n), at(n, BOARD_SECONDS));
  // The gangway is down only while she's boarding.
  assert.equal(gangwayOpen(at(n, 1)), false);
  assert.equal(gangwayOpen(at(n, 20)), true);
  assert.equal(gangwayOpen(at(n, BOARD_SECONDS + 1)), false);
  assert.equal(gangwayOpen(at(n, BOARD_SECONDS + 100)), false);
});

test('the trips rotate, with the sunset cruise only in the evening at the company, not on your own clock', () => {
  const trips = new Set(),
    noon = Math.floor(Date.UTC(2026, 10, 20, 17) / 1000 / CYCLE_SECONDS),
    evening = Math.floor(Date.UTC(2026, 10, 20, 21, 30) / 1000 / CYCLE_SECONDS);
  // 17:00 UTC is noon in New York: the plain rotation, three different trips in a row.
  assert.deepEqual([0, 1, 2].map(i => tripFor(noon + i)).sort(), ['highlands', 'loop', 'whales']);
  assert.equal(tripFor(noon), tripFor(noon + 3));
  // 21:30 UTC is 4:30 pm in New York (golden hour): the island loop's turn goes to the sunset cruise.
  assert.equal(companyPeriod(departsAt(evening)), 'golden');
  assert.deepEqual([0, 1, 2].map(i => tripFor(evening + i)).sort(), ['highlands', 'sunset', 'whales']);
  for (let n = FIRST; n < FIRST + 400; n++) {
    const trip = tripFor(n);
    trips.add(trip);
    if (trip === 'sunset') assert.ok(['golden', 'dusk'].includes(companyPeriod(departsAt(n))), `${n}`);
  }
  assert.equal(trips.size, 4);
});

test('every sailing is a smooth round trip on open water, clear of the islands and the other docks', () => {
  const ownBerth = DOCKS.length - 3;
  for (const n of sample) {
    const route = cruiseRoute(n);
    assert.ok(routeSpeed(route) < 3, `sailing ${n} keeps a boat's pace (${routeSpeed(route).toFixed(2)})`);
    let previous = null;
    for (let t = 0; t <= CYCLE_SECONDS; t += 0.25) {
      const p = boatPose(at(n, t), false);
      for (const [u, v] of HULL_CORNERS) {
        const [x, z] = toWorld(p, u, v);
        assert.ok(land(x, z) > 1, `sailing ${n} (${tripFor(n)}) in the water at t=${t}`);
        // Out of the berth, she keeps off every other dock (and its own pier).
        if (t > BOARD_SECONDS + 25 && t < CYCLE_SECONDS - 25)
          DOCKS.forEach((segment, i) => {
            if (i >= ownBerth + 2) return;
            assert.ok(segmentDistance([x, z], ...segment) > 1, `sailing ${n} clear of dock ${i} at t=${t}`);
          });
      }
      if (previous) {
        const turn = Math.abs(
          Math.atan2(Math.sin(p.heading - previous.heading), Math.cos(p.heading - previous.heading)),
        );
        assert.ok(turn < 0.15, `sailing ${n} turns smoothly at t=${t}`);
        assert.ok(Math.hypot(p.x - previous.x, p.z - previous.z) < 1, `sailing ${n} doesn't jump at t=${t}`);
      }
      previous = p;
    }
    // Back at the berth, bow the same way, ready for the next one.
    const home = boatPose(at(n + 1, 0) - 1, false);
    assert.ok(Math.hypot(home.x - BERTH.x, home.z - BERTH.z) < 1e-6);
    assert.ok(Math.abs(home.heading - BERTH.heading) < 0.01);
  }
});

test('the whale run heads for where a whale will be, and still gets back on time', () => {
  let met = 0;
  for (let n = FIRST; n < FIRST + 120; n++) {
    if (tripFor(n) !== 'whales') continue;
    const meet = whaleMeet(n),
      route = cruiseRoute(n);
    assert.equal(route.whale, meet?.whale ?? null);
    if (!meet) continue;
    met++;
    // Somewhere on her route she passes within a few lengths of that point.
    const nearest = Math.min(...route.points.map(p => Math.hypot(p[0] - meet.at[0], p[1] - meet.at[1])));
    assert.ok(nearest < 14, `sailing ${n} passes the whale (${nearest.toFixed(1)})`);
    const halfway = whalePose(meet.whale, (departsAt(n) / 1000 + TRIP_SECONDS / 2) % 86400);
    assert.deepEqual(meet.at, [halfway.x, halfway.z]);
    const back = boatPose(at(n, CYCLE_SECONDS) - 1, false);
    assert.ok(Math.hypot(back.x - BERTH.x, back.z - BERTH.z) < 1e-6);
  }
  assert.ok(met > 5, `whales met on ${met} runs`);
});

test('walking the deck keeps you inside the rail and out of the wheelhouse', () => {
  let p = [0, -3];
  for (let i = 0; i < 400; i++) {
    const a = i * 0.7,
      next = deckStep(p, [p[0] + Math.cos(a) * 0.4, p[1] + Math.sin(a) * 0.4], false);
    assert.ok(onDeck(...next, false), `step ${i} on deck`);
    p = next;
  }
  // Walls: the rail and the wheelhouse stop you; you slide along them.
  assert.deepEqual(deckStep([1.5, -2], [2.5, -2], false), [1.5, -2]);
  assert.deepEqual(deckStep([1.5, -2], [2.5, -1.8], false), [1.5, -1.8]);
  assert.ok(!onDeck(0, 1.5, false), 'the wheelhouse is solid');
  assert.ok(!onDeck(0, 6, false) && !onDeck(-3, 0, false));
  // A walk from the stern to the bow goes round the wheelhouse.
  const route = deckRoute([0, -3], [0, 4.2]);
  let from = [0, -3];
  for (const to of route) {
    for (let k = 1; k <= 20; k++) {
      const q = [from[0] + ((to[0] - from[0]) * k) / 20, from[1] + ((to[1] - from[1]) * k) / 20];
      assert.ok(onDeck(...q, false), `deck route ${q}`);
    }
    from = to;
  }
});

test('you board and leave only by the gangway, and only while it is down', () => {
  const n = FIRST,
    boarding = at(n, 20),
    sailing = at(n, BOARD_SECONDS + 30),
    [fx, fz] = toWorld(BERTH, ...GANGWAY_FOOT),
    [ox, oz] = toWorld(BERTH, 2.8, -0.4);
  assert.ok(walkable(fx, fz), 'the foot of the gangway is on the pier');
  assert.ok(findPath(ARRIVAL_DOCK, [fx, fz]).length, 'and the pier is reachable');
  assert.ok(boardAt(ox, oz, boarding), 'up the gangway while boarding');
  assert.equal(boardAt(ox, oz, sailing), null, 'not once she has sailed');
  // Off the pier anywhere but the gangway is still just water.
  const [sx, sz] = toWorld(BERTH, 2.8, -3);
  assert.equal(boardAt(sx, sz, boarding), null);
  assert.ok(!walkable(sx, sz) && !walkable(...toWorld(BERTH, 2.6, -0.4)));
  // Walking down the gangway puts you back on the pier; with it raised, the rail is a wall.
  assert.ok(leavesDeck([3, -0.4], true));
  assert.ok(!leavesDeck([3, -0.4], false));
  assert.deepEqual(deckStep([1.7, -0.4], [2.2, -0.4], false), [1.7, -0.4]);
  assert.deepEqual(deckStep([1.7, -0.4], [2.2, -0.4], true), [2.2, -0.4]);
  // Raised with you on it: you're put back on deck.
  assert.ok(onDeck(...deckStep([2.6, -0.4], [2.7, -0.4], false), false));
  const [u, v] = toDeck(BERTH, ...toWorld(BERTH, 1.2, 3.4));
  assert.ok(Math.abs(u - 1.2) < 1e-9 && Math.abs(v - 3.4) < 1e-9);
});

test('deck spots are never double-booked, and the cruise is everyone’s errand in the daytime', () => {
  const taken = new Set();
  for (let i = 0; i < DECK_SPOTS.length; i++) {
    const cruise = resolveTarget(
      demoCoworkers[0].schedule.dusk?.errands.find(e => e.cruise) ?? PLAYER_SCHEDULE.dusk.errands.find(e => e.cruise),
      taken,
    );
    assert.ok(!taken.has(cruise.seatId), `${cruise.seatId} is free`);
    taken.add(cruise.seatId);
    assert.ok(walkable(...cruise.approach) && findPath(ARRIVAL_DOCK, cruise.approach).length, cruise.seatId);
  }
  assert.equal(freeDeckSpot(taken), null);
  // With every deck spot taken, nobody picks the cruise.
  const block = { home: PLAYER_SCHEDULE.dusk.home, errands: PLAYER_SCHEDULE.dusk.errands.filter(e => e.cruise) };
  assert.equal(
    nextActivity(block, block.home, () => 0.5, taken),
    block.home,
  );
  // Each waits in a place of their own.
  assert.equal(new Set(DECK_SPOTS.map(s => pierWait(s.id).join())).size, DECK_SPOTS.length);
  for (const person of demoCoworkers)
    for (const period of ['morning', 'midday', 'golden', 'dusk'])
      if (person.schedule[period])
        assert.ok(
          person.schedule[period].errands.some(e => e.cruise),
          person.name,
        );
  for (const person of demoCoworkers)
    for (const period of ['dawn', 'night'])
      assert.ok(!person.schedule[period]?.errands.some(e => e.cruise), `${person.name} ${period}`);
});

test('a passenger waits, boards, rides one sailing and ends up back on the pier', () => {
  const n = FIRST,
    spot = DECK_SPOTS[3],
    wait = pierWait(spot.id);
  // Out at sea when they arrive: wait.
  let voyage = { stage: 'pier', sailing: -1 };
  voyage = voyageStep(voyage, at(n - 1, BOARD_SECONDS + 50), false);
  assert.equal(voyage.stage, 'pier');
  // Too late to make it before the gangway goes up: wait for the next one.
  assert.equal(voyageStep(voyage, at(n, BOARD_SECONDS - 3), false).stage, 'pier');
  voyage = voyageStep(voyage, at(n, 10), false);
  assert.deepEqual(voyage, { stage: 'boarding', sailing: n });
  voyage = voyageStep(voyage, at(n, 14), true);
  assert.equal(voyage.stage, 'boarding');
  voyage = voyageStep(voyage, at(n, 16), false);
  assert.equal(voyage.stage, 'aboard');
  // Aboard all the way round, and not off at the next boarding of the same sailing.
  for (let t = 16; t < CYCLE_SECONDS; t += 5) assert.equal(voyageStep(voyage, at(n, t), false).stage, 'aboard');
  voyage = voyageStep(voyage, at(n + 1, 5), false);
  assert.equal(voyage.stage, 'leaving');
  voyage = voyageStep(voyage, at(n + 1, 9), false);
  assert.equal(voyage.stage, 'done');
  // The walks on and off: up the gangway onto the deck, and back down to the pier.
  const on = boardingWalk(spot),
    off = leavingWalk(spot, wait);
  assert.deepEqual(on[0], toWorld(BERTH, ...GANGWAY_FOOT));
  assert.deepEqual(on.at(-1), toWorld(BERTH, spot.u, spot.v));
  assert.deepEqual(off.at(-1), wait);
  assert.ok(walkable(...off.at(-2)) && walkable(...wait), 'off onto the pier');
  for (const p of [...on.slice(1, -1), ...off.slice(0, -2)]) {
    const [u, v] = toDeck(BERTH, ...p);
    assert.ok(onDeck(u, v, true), `walk point ${u.toFixed(2)},${v.toFixed(2)} on deck or gangway`);
  }
  assert.ok(Math.abs(toDeck(BERTH, ...on[1])[0] - GANGWAY_TOP[0]) < 1e-9, 'via the top of the gangway');
});
