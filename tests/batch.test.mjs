import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchStatic } from '../src/batch.ts';

const box = (color, x, extra = {}) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color, ...extra }));
  mesh.position.set(x, 0, 0);
  mesh.castShadow = true;
  return mesh;
};

test('static meshes that look alike merge into one draw, and stay clickable', () => {
  const root = new THREE.Group();
  root.position.set(10, 0, 0);
  const reds = [0, 2, 4].map(x => box('#ff0000', x));
  const blue = box('#0000ff', 6),
    glass = box('#ffffff', 8, { transparent: true, opacity: 0.5 }),
    moving = box('#ff0000', 10);
  moving.userData.dynamic = true;
  const shared = new THREE.MeshStandardMaterial({ color: '#00ff00' });
  const glowA = new THREE.Mesh(new THREE.BoxGeometry(), shared),
    glowB = new THREE.Mesh(new THREE.BoxGeometry(), shared);
  root.add(...reds, blue, glass, moving, glowA, glowB);

  const { merged } = batchStatic(root);
  assert.equal(merged.length, 2, 'reds merge into one mesh, blue into another');
  assert.equal(merged[0].geometry.attributes.position.count, 36 * 3);
  assert.ok(merged.every(m => m.castShadow && m.parent === root));
  // Originals no longer draw, but are still there for clicks.
  for (const m of [...reds, blue]) assert.equal(m.material.visible, false);
  for (const m of [glass, moving, glowA, glowB]) assert.notEqual(m.material.visible, false, 'left as is');
  const ray = new THREE.Raycaster(new THREE.Vector3(12, 5, 0), new THREE.Vector3(0, -1, 0));
  root.updateMatrixWorld(true);
  const hits = ray.intersectObject(root, true);
  assert.equal(hits[0].object, reds[1], 'the click lands on the original, not the merged mesh');
  // Merged geometry sits where the originals were.
  merged[0].geometry.computeBoundingBox();
  assert.deepEqual(merged[0].geometry.boundingBox.min.toArray(), [-0.5, -0.5, -0.5]);
  assert.deepEqual(merged[0].geometry.boundingBox.max.toArray(), [4.5, 0.5, 0.5]);
});
