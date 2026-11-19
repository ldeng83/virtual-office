import test from 'node:test';
import assert from 'node:assert/strict';
import { movementAxes, pinchZoom, steerVector, stickVector, wantsTouchNav } from '../src/touch.ts';

const keys = (...down) => ({ has: key => down.includes(key) });
const idle = { active: false, x: 0, y: 0 };

test('the stick ignores a small nudge and points the way you drag', () => {
  assert.deepEqual(stickVector(0, 0, 40), { x: 0, y: 0 });
  assert.deepEqual(stickVector(3, 4, 40), { x: 0, y: 0 });
  assert.deepEqual(stickVector(40, 0, 0), { x: 0, y: 0 });
  const right = stickVector(40, 0, 40);
  assert.equal(right.x, 1);
  assert.equal(right.y, 0);
  const up = stickVector(0, -80, 40);
  assert.equal(up.x, 0);
  assert.equal(up.y, -1);
});

test('a pinch scales zoom and stays inside the limits', () => {
  assert.equal(pinchZoom(30, 100, 150, 4, 65), 45);
  assert.equal(pinchZoom(60, 100, 200, 4, 65), 65);
  assert.equal(pinchZoom(10, 100, 20, 4, 65), 4);
  assert.equal(pinchZoom(30, 0, 10, 4, 65), 30);
  assert.equal(pinchZoom(30, 100, 0, 4, 65), 30);
});

test('movement keys and the stick steer together, relative to the camera', () => {
  assert.deepEqual(movementAxes(keys('w'), idle), { x: 0, z: -1 });
  assert.deepEqual(movementAxes(keys('d'), idle), { x: 1, z: 0 });
  assert.equal(movementAxes(keys(), idle), null);
  assert.equal(movementAxes(keys('w', 's'), idle), null);
  assert.deepEqual(movementAxes(keys(), { active: true, x: 0, y: -1 }), { x: 0, z: -1 });
  assert.equal(movementAxes(keys(), { active: true, x: 0, y: 0 }), null);
  assert.deepEqual(steerVector(1, 0, 0), [1, 0]);
  assert.deepEqual(steerVector(0, 1, 0), [0, 1]);
  assert.ok(Math.abs(steerVector(1, 0, Math.PI / 2)[0]) < 1e-10);
  assert.ok(Math.abs(steerVector(1, 0, Math.PI / 2)[1] + 1) < 1e-10);
});

test('touch controls show for a coarse pointer or after a finger lands', () => {
  assert.equal(wantsTouchNav(false, false), false);
  assert.equal(wantsTouchNav(true, false), true);
  assert.equal(wantsTouchNav(false, true), true);
});
