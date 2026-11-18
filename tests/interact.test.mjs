import test from 'node:test';
import assert from 'node:assert/strict';
import { REACH, SPOTS, isUseKey, nearestSpot, seatAction } from '../src/interact.ts';
import { seats } from '../src/world.ts';

test('every seat says what using it does', () => {
  for (const seat of seats) assert.ok(seatAction(seat).length > 3, seat.id);
  const action = id => seatAction(seats.find(s => s.id === id));
  assert.equal(action('dv-0'), 'Go diving');
  assert.equal(action('pn-0'), 'Play the piano');
  assert.equal(action('fs-0'), 'Go fishing');
  assert.match(action('pz-0'), /^Sit: /);
});

test('E picks the nearest spot within reach, and nothing when none is close', () => {
  const piano = SPOTS.find(s => s.id === 'pn-0');
  assert.equal(nearestSpot(piano.x + 0.3, piano.z, piano.y)?.id, 'pn-0');
  assert.equal(nearestSpot(piano.x, piano.z + REACH + 4, piano.y)?.id === 'pn-0', false);
  assert.equal(nearestSpot(200, 200, 0), null);
  // Rooftop seats are out of reach from the ground below them.
  const roof = SPOTS.find(s => s.id === 'rt-0');
  assert.notEqual(nearestSpot(roof.x, roof.z, 0)?.id, 'rt-0');
});

test('the radio and the telescope are usable spots too', () => {
  assert.ok(SPOTS.some(s => s.id === 'radio') && SPOTS.some(s => s.id === 'telescope'));
  assert.equal(new Set(SPOTS.map(s => s.id)).size, SPOTS.length);
});

test('E and Space both use the nearest thing', () => {
  const canvas = { tagName: 'CANVAS' };
  assert.equal(isUseKey({ key: 'e', target: canvas }), true);
  assert.equal(isUseKey({ key: 'E', target: canvas }), true);
  assert.equal(isUseKey({ key: ' ', target: canvas }), true);
  assert.equal(isUseKey({ key: 'Spacebar', target: canvas }), true);
  assert.equal(isUseKey({ key: 'q', target: canvas }), false);
  assert.equal(isUseKey({ key: 'Enter', target: canvas }), false);
});

test('Space on a focused button or link presses that, not the nearest thing', () => {
  for (const tagName of ['BUTTON', 'A', 'SUMMARY'])
    assert.equal(isUseKey({ key: ' ', target: { tagName } }), false, tagName);
  // E is not how a button is pressed, so it still reaches the island.
  assert.equal(isUseKey({ key: 'e', target: { tagName: 'BUTTON' } }), true);
  assert.equal(isUseKey({ key: ' ', target: null }), true);
});
