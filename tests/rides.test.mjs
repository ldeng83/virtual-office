import test from 'node:test';
import assert from 'node:assert/strict';
import { shoreDistance } from '../src/shoreline.ts';
import { BRIDGE_HEIGHT, DECKS, highlandsDistance } from '../src/highlands.ts';
import {
  CLIMB_SECONDS,
  DIVE_DEPTH,
  PARASAIL_HEIGHT,
  RIDE_SECONDS,
  ridePose,
  startRide,
  stepRide,
} from '../src/rides.ts';
import { courseSeconds, detour, planDetour, tripCourse, TRIPS } from '../src/boat-trips.ts';
import { SEA } from '../src/open-sea.ts';
import { demoCoworkers } from '../src/people.ts';
import { bluff, findPath, locations, marina, onJetty, seats, segmentDistance, walkable } from '../src/world.ts';

const rides = seats.filter(s => s.ride);
const ride = (seat, t, trip = 0, course) =>
  ridePose(seat.ride.kind, seat.ride.launch, t, seat.ride.route, trip, course);
// Run a ride until it ends, sampling every 0.25s.
function run(seat, trip = 0, course, limit = 400) {
  const samples = [];
  for (let t = 0; t < limit; t += 0.25) {
    const p = ride(seat, t, trip, course);
    samples.push({ t, ...p });
    if (p.done) break;
  }
  return samples;
}

test('every ride can be reached on foot from the pier', () => {
  for (const kind of ['kayak', 'jetski', 'sailboat', 'parasail', 'climb', 'scuba', 'ferry'])
    assert.ok(
      rides.some(s => s.ride.kind === kind),
      `${kind} has a launch spot`,
    );
  for (const seat of rides) {
    assert.ok(walkable(...seat.approach), `${seat.id} step-in spot is walkable`);
    assert.ok(findPath(locations[0].point, seat.approach).length, `${seat.id} is reachable`);
  }
});

const boats = rides.filter(s => s.ride.kind in TRIPS);
// Once under way, the vehicle (the tow boat for parasailing) stays off the beach and clear of the docks.
function staysOnTheWater(samples, name) {
  const last = samples.at(-1);
  for (const p of samples.filter(p => p.t > 6 && p.t < last.t - 6)) {
    const [x, z] = p.boat ? [p.boat.x, p.boat.z] : [p.x, p.z];
    assert.ok(shoreDistance(x, z) > 2, `${name} stays in the water at t=${p.t}`);
    assert.ok(highlandsDistance(x, z) > 2.5, `${name} keeps off the Highlands at t=${p.t}`);
    assert.ok(!onJetty(x, z), `${name} doesn't cross a dock at t=${p.t}`);
    assert.ok(
      segmentDistance([x, z], [marina.x, marina.z0], [marina.x, marina.z1 + 2]) > 2.5,
      `${name} keeps clear of the marina at t=${p.t}`,
    );
  }
}

test('every trip a boat can pick goes out on the open water and comes back to its launch', () => {
  for (const seat of boats)
    TRIPS[seat.ride.kind].forEach((trip, i) => {
      const name = `${seat.id} "${trip.doing}"`,
        samples = run(seat, i),
        last = samples.at(-1);
      assert.ok(last.done, `${name} finishes`);
      assert.ok(last.t <= RIDE_SECONDS[seat.ride.kind], `${name} fits the time allowed`);
      const [ex, ez] = last.boat ? [last.boat.x, last.boat.z] : [last.x, last.z];
      assert.ok(Math.hypot(ex - seat.ride.launch[0], ez - seat.ride.launch[1]) < 0.3, `${name} returns`);
      staysOnTheWater(samples, name);
    });
});

test('each boat has several different trips, and boarding picks one of them', () => {
  for (const seat of boats) {
    const trips = TRIPS[seat.ride.kind];
    assert.ok(trips.length >= 2, `${seat.ride.kind} has a choice of trips`);
    assert.equal(new Set(trips.map(t => t.doing)).size, trips.length);
    assert.equal(new Set(trips.map(t => t.start)).size, trips.length);
    const picked = trips.map((_, i) => startRide(seat, {}, [], (i + 0.5) / trips.length).trip);
    assert.deepEqual(
      picked,
      trips.map((_, i) => i),
    );
    assert.equal(startRide(seat, {}, [], 0.9999999).trip, trips.length - 1);
    // No two trips are the same water: somewhere along the way they're well apart.
    const courses = trips.map((_, i) => tripCourse(seat.ride.kind, seat.ride.launch, i).points);
    const apart = (a, b) => Math.max(...a.map(p => Math.min(...b.map(q => Math.hypot(p[0] - q[0], p[1] - q[1])))));
    for (let i = 0; i < courses.length; i++)
      for (let j = 0; j < i; j++)
        assert.ok(Math.max(apart(courses[i], courses[j]), apart(courses[j], courses[i])) > 10, `${seat.id} ${i}/${j}`);
  }
});

test('between them the trips cover the whole sea, with plenty to choose from', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(TRIPS).map(([kind, trips]) => [kind, trips.length])), {
    kayak: 15,
    jetski: 15,
    sailboat: 15,
    parasail: 10,
  });
  for (const kind of ['kayak', 'jetski', 'sailboat']) {
    const { launch } = seats.find(s => s.ride?.kind === kind).ride,
      wakes = TRIPS[kind].flatMap((_, i) => tripCourse(kind, launch, i).points);
    // Every patch of open water has a trip passing within sight of it, and nothing leaves the sea.
    for (let x = SEA.minX + 10; x <= SEA.maxX - 10; x += 15)
      for (let z = SEA.minZ + 10; z <= SEA.maxZ - 10; z += 15) {
        if (shoreDistance(x, z) < 8 || highlandsDistance(x, z) < 8) continue;
        const nearest = Math.min(...wakes.map(p => Math.hypot(p[0] - x, p[1] - z)));
        assert.ok(nearest < 34, `${kind}: nothing passes (${x}, ${z}); nearest is ${nearest.toFixed(0)} away`);
      }
    for (const [x, z] of wakes)
      assert.ok(x > SEA.minX && x < SEA.maxX && z > SEA.minZ && z < SEA.maxZ, `${kind} leaves the sea at ${x}, ${z}`);
  }
});

test('a boat bends its trip to pass a whale or dolphins within reach, and still gets home', () => {
  const seat = seats.find(s => s.ride?.kind === 'sailboat'),
    { launch } = seat.ride,
    course = tripCourse('sailboat', launch, 1),
    // A whale out past the far end of the open-sea trip.
    far = course.points[Math.floor(course.points.length / 2)],
    out = Math.hypot(far[0], far[1]),
    whale = { kind: 'whale', x: far[0] * (1 + 22 / out), z: far[1] * (1 + 22 / out), present: true };
  const nearest = c => Math.min(...c.points.map(p => Math.hypot(p[0] - whale.x, p[1] - whale.z)));
  assert.ok(nearest(course) > 20);
  const view = startRide(seat, {}, [whale], 1.5 / TRIPS.sailboat.length);
  assert.equal(view.trip, 1);
  assert.equal(view.detour, 'whale');
  // It passes close, but not over the top of it.
  assert.ok(nearest(view.course) < 9 && nearest(view.course) > 3, `passes at ${nearest(view.course)}`);
  assert.ok(courseSeconds('sailboat', view.course) <= RIDE_SECONDS.sailboat);
  const samples = run(seat, view.trip, view.course);
  assert.ok(samples.at(-1).done);
  assert.ok(Math.hypot(samples.at(-1).x - launch[0], samples.at(-1).z - launch[1]) < 0.3);
  staysOnTheWater(samples, 'the detour');

  // Whales come before dolphins; things that have dived, sharks and anything too far away are left alone.
  const dolphins = { ...whale, kind: 'dolphins' };
  assert.equal(planDetour('sailboat', course, [dolphins, whale]).sight, 'whale');
  assert.equal(planDetour('sailboat', course, [dolphins]).sight, 'dolphins');
  assert.equal(planDetour('sailboat', course, [{ ...whale, present: false }]), null);
  assert.equal(planDetour('sailboat', course, [{ ...whale, kind: 'shark' }]), null);
  assert.equal(planDetour('sailboat', course, [{ ...whale, x: whale.x * 3, z: whale.z * 3 }]), null);
  // It aims for where the animal will be, not where it is now.
  const moving = { ...whale, x: 500, z: 500, ahead: () => ({ x: whale.x, z: whale.z, present: true }) };
  assert.ok(nearest(planDetour('sailboat', course, [moving]).course) < 9);
  assert.equal(planDetour('sailboat', course, [{ ...whale, ahead: () => ({ x: 0, z: 0, present: false }) }]), null);
  // Nothing drags a boat onto the beach, and the tow boat keeps to its run.
  assert.equal(detour(course, [0, 0], 200), null);
  assert.equal(planDetour('parasail', tripCourse('parasail', launch, 0), [whale]), null);
});

test('parasailing lifts you high above the sea and lands you back on the boat', () => {
  const samples = run(seats.find(s => s.ride?.kind === 'parasail'));
  assert.ok(Math.max(...samples.map(p => p.y)) > PARASAIL_HEIGHT * 0.95);
  assert.equal(samples[0].y, 0);
  assert.ok(samples.at(-1).y < 0.05);
});

test('parasailing keeps well away from the rope bridge, boat and rider both', () => {
  const strait = DECKS.find(d => d.id === 'strait');
  const seat = seats.find(s => s.ride?.kind === 'parasail');
  TRIPS.parasail.forEach((_, trip) => {
    for (const p of run(seat, trip)) {
      assert.ok(segmentDistance([p.x, p.z], strait.a, strait.b) > 15, `rider near the bridge at t=${p.t}`);
      assert.ok(segmentDistance([p.boat.x, p.boat.z], strait.a, strait.b) > 15, `boat near the bridge at t=${p.t}`);
      // The rider stays over water while aloft.
      if (p.y > 1) assert.ok(shoreDistance(p.x, p.z) > 1 && highlandsDistance(p.x, p.z) > 1, `over land at t=${p.t}`);
    }
  });
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

test('everyone on the team takes rides, staying long enough to finish them', () => {
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
  const riders = { 'sb-0': startRide(helm, {}, [], 0.99) };
  for (let i = 0; i < 40; i++) stepRide(helm, riders['sb-0'], 0.25);
  riders['sb-1'] = startRide(bow, riders);
  assert.equal(riders['sb-1'].t, riders['sb-0'].t);
  assert.equal(riders['sb-1'].trip, riders['sb-0'].trip);
  stepRide(helm, riders['sb-0'], 0.25);
  stepRide(bow, riders['sb-1'], 0.25);
  assert.ok(Math.hypot(riders['sb-0'].x - riders['sb-1'].x, riders['sb-0'].z - riders['sb-1'].z) < 1e-9);
  // Jet skis don't share: each one starts its own lap.
  const [a, b] = ['js-0', 'js-1'].map(id => seats.find(s => s.id === id));
  const skis = { 'js-0': startRide(a, {}) };
  skis['js-0'].t = 10;
  assert.equal(startRide(b, skis).t, 0);
});

test('the water taxi runs between the dock and the Highlands jetty on open water', () => {
  for (const seat of rides.filter(s => s.ride.kind === 'ferry')) {
    const samples = run(seat),
      last = samples.at(-1),
      end = seat.ride.route.at(-1);
    assert.ok(last.done && Math.hypot(last.x - end[0], last.z - end[1]) < 0.3, `${seat.id} arrives`);
    assert.ok(walkable(...seat.ride.exit), `${seat.id} drops you on a walkable spot`);
    for (const p of samples.filter(p => p.t > 3 && p.t < last.t - 3)) {
      assert.ok(
        shoreDistance(p.x, p.z) > 1.5 && highlandsDistance(p.x, p.z) > 1.5,
        `${seat.id} in the water at t=${p.t}`,
      );
      assert.ok(!onJetty(p.x, p.z), `${seat.id} clear of docks at t=${p.t}`);
    }
  }
});

test('the rope bridge is high enough for every boat to pass under', () => {
  const strait = DECKS.find(d => d.id === 'strait');
  assert.ok(BRIDGE_HEIGHT - strait.sag > 3.8, 'clears the sailboat mast');
});
