import test from 'node:test';
import assert from 'node:assert/strict';
import { SPOTS } from '../src/interact.ts';
import { freeSpot, NEAR, nearbyPlaces, PLACE_ACTIVITIES, placeDistance } from '../src/place-activities.ts';
import { districts } from '../src/world.ts';

const at = id => districts.find(d => d.id === id).point;
const labels = place => PLACE_ACTIVITIES[place].map(a => a.label);

test('every usable spot is listed under exactly one place, grouped by what it is', () => {
  const listed = Object.values(PLACE_ACTIVITIES).flatMap(list => list.flatMap(a => a.spots.map(s => s.id)));
  assert.deepEqual([...listed].sort(), SPOTS.map(s => s.id).sort());
  assert.deepEqual(labels('jetty'), ['Fish', 'Kayak', 'Dive']);
  assert.deepEqual(labels('marina'), ['Jet ski', 'Sail', 'Parasail', 'Water taxi']);
  assert.ok(labels('cafe').includes('Radio') && labels('cafe').includes('Piano'));
  // One button per kind of thing, however many of them there are.
  assert.equal(PLACE_ACTIVITIES.office.find(a => a.label === 'Desk').spots.length, 14);
  for (const [place, list] of Object.entries(PLACE_ACTIVITIES)) {
    assert.ok(list.length <= 5, `${place} keeps a short list`);
    // Nothing is listed under a place on the far side of the island.
    for (const a of list)
      for (const s of a.spots)
        assert.ok(Math.hypot(s.x - at(place)[0], s.z - at(place)[1]) < 26, `${s.id} at ${place}`);
  }
});

test('a place opens when you are at it, hints when close and is just a name from afar', () => {
  const [jx, jz] = at('jetty');
  const here = nearbyPlaces(jx, jz);
  assert.equal(here.open, 'jetty');
  assert.ok(!here.hinted.includes('jetty'));
  // Standing by one of its spots counts too, even away from the name.
  const kayak = PLACE_ACTIVITIES.jetty.find(a => a.label === 'Kayak').spots[0];
  assert.equal(nearbyPlaces(kayak.x, kayak.z).open, 'jetty');
  // A dozen units off: icons only.
  const off = nearbyPlaces(jx + 16, jz);
  assert.notEqual(off.open, 'jetty');
  assert.ok(off.hinted.includes('jetty'));
  // The far side of the island: neither.
  const far = nearbyPlaces(...at('boardwalk'));
  assert.ok(far.open !== 'jetty' && !far.hinted.includes('jetty'));
  // Out at sea nothing is open.
  assert.deepEqual(nearbyPlaces(0, 200), { open: null, hinted: [] });
});

test('only one place is open at a time, and it does not flicker between neighbours', () => {
  for (const d of districts) {
    const { open, hinted } = nearbyPlaces(...d.point);
    assert.ok(!hinted.includes(open));
  }
  // Find a point between two places where they're equally close, then lean slightly each way.
  const [a, b] = ['firepit', 'boardwalk'];
  let tie = null;
  for (let f = 0; f <= 1 && !tie; f += 0.002) {
    const x = at(a)[0] + (at(b)[0] - at(a)[0]) * f,
      z = at(a)[1] + (at(b)[1] - at(a)[1]) * f;
    if (placeDistance(b, x, z) <= placeDistance(a, x, z)) tie = [x, z];
  }
  assert.ok(tie && placeDistance(a, ...tie) < NEAR, 'the two overlap');
  const fromA = nearbyPlaces(...tie, { open: a, hinted: [] }),
    fromB = nearbyPlaces(...tie, { open: b, hinted: [] });
  assert.equal(fromA.open, a);
  assert.equal(fromB.open, b);
  // A place stays open a little past the distance at which it would open.
  const [jx, jz] = at('jetty');
  let edge = 0;
  while (nearbyPlaces(jx - edge, jz).open === 'jetty') edge += 0.25;
  assert.equal(nearbyPlaces(jx - edge - 1, jz).open, null);
  assert.equal(nearbyPlaces(jx - edge - 1, jz, { open: 'jetty', hinted: [] }).open, 'jetty');
  assert.equal(nearbyPlaces(jx - edge - 4, jz, { open: 'jetty', hinted: [] }).open, null);
});

test('a button takes you to the nearest free spot, and is off when they are all taken', () => {
  const kayaks = PLACE_ACTIVITIES.jetty.find(a => a.label === 'Kayak'),
    [first, second] = kayaks.spots;
  assert.equal(freeSpot(kayaks, first.x, first.z, new Set()).id, first.id);
  assert.equal(freeSpot(kayaks, second.x, second.z, new Set()).id, second.id);
  assert.equal(freeSpot(kayaks, first.x, first.z, new Set([first.id])).id, second.id);
  assert.equal(freeSpot(kayaks, first.x, first.z, new Set([first.id, second.id])), null);
});
