import test from 'node:test';
import assert from 'node:assert/strict';
import { reef } from '../src/world.ts';
import {
  FLYERS,
  FLYING_SHOALS,
  JELLYFISH,
  PODS,
  ROAMING_SCHOOLS,
  SEA,
  WHALES,
  breachChance,
  crossing,
  flyingFish,
  jellyPose,
  landDistance,
  podMember,
  schoolPose,
  seaRegion,
  sharkPose,
  straitTurtle,
  whalePose,
} from '../src/open-sea.ts';

const HOUR = 3600;
const finite = pose => Object.values(pose).every(v => typeof v !== 'number' || Number.isFinite(v));

test('crossings run from one edge of the sea to another, clear of both islands', () => {
  const onEdge = ([x, z]) => x === SEA.minX || x === SEA.maxX || z === SEA.minZ || z === SEA.maxZ || x === -90;
  for (const [slot, margin] of [
    [0, 7],
    [12, 7],
    [21, 9],
    [31, 16],
    [40, 13],
  ])
    for (let n = 0; n < 200; n++) {
      const route = crossing(slot, n, margin);
      assert.ok(onEdge(route.a) && onEdge(route.b));
      assert.ok(route.length > 130 && route.length < 300);
      assert.equal(crossing(slot, n, margin), route);
    }
});

test('successive crossings take different routes all over the sea', () => {
  const quadrants = new Set();
  for (let t = 0; t < HOUR; t += 5) {
    const p = podMember(0, 0, t);
    if (p.presence > 0.9) quadrants.add(`${p.x > 0}${p.z > -40}`);
  }
  assert.equal(quadrants.size, 4);
});

test('nothing out at sea ever swims onto land', () => {
  for (let t = 0; t < 2 * HOUR; t += 0.7) {
    const poses = [
      ...PODS.flatMap((size, pod) => Array.from({ length: size }, (_, member) => podMember(pod, member, t))),
      ...Array.from({ length: ROAMING_SCHOOLS }, (_, i) => schoolPose(i, t)),
      ...Array.from({ length: FLYING_SHOALS * FLYERS }, (_, i) => flyingFish(Math.floor(i / FLYERS), i % FLYERS, t)),
      sharkPose(t),
      straitTurtle(t),
    ];
    for (const p of poses) {
      assert.ok(finite(p));
      assert.ok(landDistance(p.x, p.z) > 1.5, `swam ashore at ${p.x}, ${p.z}`);
    }
    for (let i = 0; i < WHALES; i++) {
      const p = whalePose(i, t);
      assert.ok(finite(p));
      assert.ok(landDistance(p.x, p.z) > 15, 'a whale came into the shallows');
    }
  }
  for (let i = 0; i < JELLYFISH; i++)
    for (let t = 0; t < 600; t += 3) {
      const p = jellyPose(reef, i, t);
      assert.ok(landDistance(p.x, p.z) > 3 && p.y < -0.6);
    }
});

test('animals arrive from the deep and leave the same way', () => {
  let hidden = 0,
    shown = 0;
  for (let t = 0; t < HOUR; t += 1) {
    const p = podMember(1, 0, t);
    if (p.presence < 0.01) {
      hidden++;
      assert.ok(p.y < -3);
    } else if (p.presence > 0.99) shown++;
  }
  assert.ok(hidden > 0 && shown > hidden * 5);
});

test('pods leap one after another', () => {
  let t = 0;
  while (podMember(0, 0, t).leap < 0.9) t += 0.1;
  assert.ok(podMember(0, 0, t).y > 0.5);
  // The next dolphin back is a beat behind: lower now, at its highest shortly after.
  assert.ok(podMember(0, 1, t).leap < podMember(0, 0, t).leap);
  assert.ok(podMember(0, 1, t + 0.6).leap > 0.9);
});

test('whales spout, breach now and then, and breach most at dawn and golden hour', () => {
  const count = chance => {
    const seen = { breaches: new Set(), spouts: 0, splashes: 0, peak: -9 };
    for (let t = 0; t < 2 * HOUR; t += 0.25) {
      const p = whalePose(0, t, chance);
      if (p.breaching) seen.breaches.add(p.event);
      if (p.breaching) seen.peak = Math.max(seen.peak, p.y);
      if (p.spout >= 0) seen.spouts++;
      if (p.splash >= 0) seen.splashes++;
      // Between events a whale is a shadow under the surface.
      if (!p.breaching && p.spout < 0 && p.splash < 0) assert.ok(p.y < -0.3);
    }
    return seen;
  };
  const day = count(breachChance('midday')),
    golden = count(breachChance('golden'));
  assert.ok(day.breaches.size >= 10 && day.spouts > 0 && day.splashes > 0);
  assert.ok(day.peak > 2, 'a breach clears the water');
  assert.ok(golden.breaches.size > day.breaches.size * 1.8);
  assert.ok(breachChance('dawn') > breachChance('morning') && breachChance('night') < breachChance('morning'));
});

test('the shark shows only a fin, and the strait turtle swims between the islands', () => {
  for (let t = 0; t < 600; t += 2) assert.ok(sharkPose(t).y < -0.7);
  const south = straitTurtle(0),
    north = straitTurtle(100);
  assert.ok(south.z > -52 && north.z < -58);
  assert.deepEqual(straitTurtle(200).x.toFixed(6), south.x.toFixed(6));
});

test('sightings are described by where they are', () => {
  assert.equal(seaRegion(-70, -10), 'off the west coast');
  assert.equal(seaRegion(70, 0), 'off the east coast');
  assert.equal(seaRegion(0, 50), 'south of the island');
  assert.equal(seaRegion(10, -55), 'in the strait');
  assert.equal(seaRegion(-60, -90), "off the Highlands' west shore");
  assert.equal(seaRegion(0, -135), 'north of the Highlands');
});
