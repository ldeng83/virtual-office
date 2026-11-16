import test from 'node:test';
import assert from 'node:assert/strict';
import { shoreDistance } from '../src/shoreline.ts';
import {
  CLIMB_SECONDS,
  DIVE_DEPTH,
  PARASAIL_HEIGHT,
  RIDE_SECONDS,
  ridePose,
  startRide,
  stepRide,
} from '../src/rides.ts';
import { demoCoworkers } from '../src/people.ts';
import { bluff, findPath, locations, marina, onJetty, seats, segmentDistance, walkable } from '../src/world.ts';

const rides = seats.filter(s => s.ride);
const ride = (seat, t) => ridePose(seat.ride.kind, seat.ride.launch, t);
// Run a ride until it ends, sampling every 0.25s.
function run(seat, limit = 400) {
  const samples = [];
  for (let t = 0; t < limit; t += 0.25) {
    const p = ride(seat, t);
    samples.push({ t, ...p });
    if (p.done) break;
  }
  return samples;
}

test('every ride can be reached on foot from the pier', () => {
  for (const kind of ['kayak', 'jetski', 'sailboat', 'parasail', 'climb', 'scuba'])
    assert.ok(
      rides.some(s => s.ride.kind === kind),
      `${kind} has a launch spot`,
    );
  for (const seat of rides) {
    assert.ok(walkable(...seat.approach), `${seat.id} step-in spot is walkable`);
    assert.ok(findPath(locations[0].point, seat.approach).length, `${seat.id} is reachable`);
  }
});

test('water rides loop out on the open water and come back to their launch', () => {
  for (const seat of rides.filter(s => !['climb', 'scuba'].includes(s.ride.kind))) {
    const samples = run(seat);
    const last = samples.at(-1);
    assert.ok(last.done, `${seat.id} finishes`);
    const [ex, ez] = last.boat ? [last.boat.x, last.boat.z] : [last.x, last.z];
    assert.ok(Math.hypot(ex - seat.ride.launch[0], ez - seat.ride.launch[1]) < 0.3, `${seat.id} returns`);
    // Once under way, the vehicle (the tow boat for parasailing) stays off the beach and clear of the docks.
    for (const p of samples.filter(p => p.t > 6 && p.t < last.t - 6)) {
      const [x, z] = p.boat ? [p.boat.x, p.boat.z] : [p.x, p.z];
      assert.ok(shoreDistance(x, z) > 2, `${seat.id} stays in the water at t=${p.t}`);
      assert.ok(!onJetty(x, z), `${seat.id} doesn't cross a dock at t=${p.t}`);
      assert.ok(
        segmentDistance([x, z], [marina.x, marina.z0], [marina.x, marina.z1 + 2]) > 2.5,
        `${seat.id} keeps clear of the marina at t=${p.t}`,
      );
    }
  }
});

test('parasailing lifts you high above the sea and lands you back on the boat', () => {
  const samples = run(seats.find(s => s.ride?.kind === 'parasail'));
  assert.ok(Math.max(...samples.map(p => p.y)) > PARASAIL_HEIGHT * 0.95);
  assert.equal(samples[0].y, 0);
  assert.ok(samples.at(-1).y < 0.05);
});

test('the climb goes up the face to the lookout and waits there', () => {
  const seat = seats.find(s => s.ride?.kind === 'climb');
  const top = ride(seat, CLIMB_SECONDS + 5);
  assert.ok(Math.abs(top.y - bluff.h) < 1e-6);
  assert.equal(top.done, false);
  for (let t = 0; t < CLIMB_SECONDS; t += 0.5) {
    const p = ride(seat, t);
    assert.ok(p.y >= 0 && p.y <= bluff.h + 1e-6);
  }
});

test('the dive goes down to the reef and comes back up at the ladder', () => {
  const seat = seats.find(s => s.ride?.kind === 'scuba');
  const samples = run(seat);
  assert.ok(Math.min(...samples.map(p => p.y)) < -DIVE_DEPTH + 0.2);
  const last = samples.at(-1);
  assert.ok(last.done && last.y > -0.05);
  for (const p of samples.filter(p => p.y < -1)) assert.ok(shoreDistance(p.x, p.z) > 1, 'dives stay off the island');
});

test('Maya and Theo take rides, staying long enough to finish them', () => {
  for (const person of demoCoworkers) {
    const rideErrands = Object.values(person.schedule)
      .flatMap(block => (block ? [block.home, ...block.errands] : []))
      .filter(a => a.seats?.some(id => seats.find(s => s.id === id)?.ride));
    assert.ok(rideErrands.length >= 3, `${person.name} has rides in their day`);
    for (const a of rideErrands) {
      const kind = seats.find(s => s.id === a.seats[0]).ride.kind;
      assert.ok(a.dwell[0] >= RIDE_SECONDS[kind], `${person.name}'s ${kind} lasts the whole ride`);
    }
  }
});

test('a second sailor joins the boat on the trip already under way', () => {
  const [helm, bow] = ['sb-0', 'sb-1'].map(id => seats.find(s => s.id === id));
  const riders = { 'sb-0': startRide(helm, {}) };
  for (let i = 0; i < 40; i++) stepRide(helm, riders['sb-0'], 0.25);
  riders['sb-1'] = startRide(bow, riders);
  assert.equal(riders['sb-1'].t, riders['sb-0'].t);
  stepRide(helm, riders['sb-0'], 0.25);
  stepRide(bow, riders['sb-1'], 0.25);
  assert.ok(Math.hypot(riders['sb-0'].x - riders['sb-1'].x, riders['sb-0'].z - riders['sb-1'].z) < 1e-9);
  // Jet skis don't share: each one starts its own lap.
  const [a, b] = ['js-0', 'js-1'].map(id => seats.find(s => s.id === id));
  const skis = { 'js-0': startRide(a, {}) };
  skis['js-0'].t = 10;
  assert.equal(startRide(b, skis).t, 0);
});
