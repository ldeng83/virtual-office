import test from 'node:test';
import assert from 'node:assert/strict';
import { shoreDistance } from '../src/shoreline.ts';
import {
  AIR_SECONDS,
  DIVE_AREA,
  DIVE_DEPTH,
  SPECIES,
  airLeft,
  canSwim,
  chest,
  inSight,
  stepSwim,
  tourPose,
  tourSeconds,
  wreck,
} from '../src/dive.ts';
import { reef, seats } from '../src/world.ts';

const launch = seats.find(s => s.ride?.kind === 'scuba').ride.launch;
const diver = () => ({ t: 20, x: reef.x, y: -DIVE_DEPTH, z: reef.z, heading: 0, roll: 0, mode: 'free' });

test('the guided tour visits the reef and the wreck at a steady pace, within one tank', () => {
  const duration = tourSeconds(launch);
  assert.ok(duration < AIR_SECONDS - 20, `tour takes ${duration}s`);
  let nearReef = Infinity,
    nearWreck = Infinity,
    previous = tourPose(launch, 0);
  for (let t = 0.25; t <= duration; t += 0.25) {
    const p = tourPose(launch, t);
    nearReef = Math.min(nearReef, Math.hypot(p.x - reef.x, p.z - reef.z));
    nearWreck = Math.min(nearWreck, Math.hypot(p.x - wreck.x, p.z - wreck.z));
    assert.ok(Math.hypot(p.x - previous.x, p.z - previous.z) < 0.4, `no jumps at ${t}s`);
    if (p.y < -1) assert.ok(canSwim(p.x, p.z) || shoreDistance(p.x, p.z) > 1.5, `in open water at ${t}s`);
    previous = p;
  }
  assert.ok(nearReef < 3 && nearWreck < 6.5);
  assert.ok(inSight('wreck', previous.x - wreck.x, previous.z - wreck.z) === false);
});

test('the reef, the wreck and the chest are all inside the dive area', () => {
  for (const [x, z] of [[reef.x, reef.z], [wreck.x, wreck.z], chest]) assert.ok(canSwim(x, z));
  assert.ok(!canSwim(DIVE_AREA.x + DIVE_AREA.r + 1, DIVE_AREA.z));
  assert.ok(!canSwim(0, 0), 'not on the island');
});

test('free swimming follows the steering, stays in the dive area and holds its depth', () => {
  const d = diver();
  for (let i = 0; i < 100; i++) stepSwim(launch, d, [-1, 0], 0.05);
  assert.ok(d.x < reef.x - 10 && Math.abs(d.z - reef.z) < 0.01);
  assert.ok(Math.abs(d.y + DIVE_DEPTH) < 0.2);
  // Swimming at the island or out to sea stops at the edge.
  for (const steer of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const e = diver();
    for (let i = 0; i < 1200; i++) stepSwim(launch, e, steer, 0.05), (e.t = 20);
    assert.ok(canSwim(e.x, e.z), `stopped at the edge heading ${steer}`);
  }
});

test('when the air runs out you swim back and surface at the ladder', () => {
  const d = { ...diver(), x: wreck.x, z: wreck.z, t: AIR_SECONDS - 1 };
  assert.ok(airLeft(d.t) > 0 && airLeft(AIR_SECONDS) === 0);
  let done = false,
    steps = 0;
  while (!done && steps++ < 2000) done = stepSwim(launch, d, [-1, 0], 0.05);
  assert.equal(d.mode, 'return');
  assert.ok(done && steps * 0.05 < 30, 'back within half a minute');
  assert.ok(Math.hypot(d.x - launch[0], d.z - launch[1]) < 0.2 && d.y > -0.3);
});

test('the logbook has one entry per species, each with a spotting distance', () => {
  assert.equal(new Set(SPECIES.map(s => s.id)).size, SPECIES.length);
  assert.ok(inSight('whale', 10, 0) && !inSight('turtle', 10, 0) && inSight('turtle', 2, 2));
});
