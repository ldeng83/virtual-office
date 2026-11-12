import test from 'node:test';
import assert from 'node:assert/strict';
import { animalRoute } from '../src/sea-life-motion.ts';

test('sea animals stay offshore and beach crabs stay clear of the dock', () => {
    for (let t = 0; t < 600; t += 0.5) {
        for (const kind of ['turtle', 'school', 'dolphin', 'ray', 'crab']) {
            for (let index = 0; index < (kind === 'crab' || kind === 'school' ? 3 : 2); index++) {
                const p = animalRoute(kind, index, t);
                assert.ok(Object.values(p).every(Number.isFinite));
                const radius = Math.hypot(p.x / 1.28, p.z);
                if (kind === 'crab') {
                    assert.ok(radius > 9.7 && radius < 10.4);
                    assert.ok(Math.abs(p.x) > 1.5 || p.z < 7.8);
                } else assert.ok(radius > 11, `${kind} entered the island`);
            }
        }
    }
});
test('dolphins leap occasionally and underwater species stay submerged', () => {
    assert.ok(animalRoute('dolphin', 0, 1.4).y > 1);
    assert.ok(animalRoute('dolphin', 0, 6).y < -0.4);
    assert.ok(animalRoute('dolphin', 1, 1.4).y < -0.4);
    for (const kind of ['ray', 'school']) for (let t = 0; t < 30; t++) assert.ok(animalRoute(kind, 0, t).y < -0.4);
});

test('crabs pause between scuttles and briefly hide in the sand', () => {
    assert.equal(animalRoute('crab', 0, 8).activity, 0);
    assert.equal(animalRoute('crab', 0, 3).activity, 1);
    assert.ok(animalRoute('crab', 0, 22).y < -0.3);
    assert.deepEqual(animalRoute('crab', 0, 24), animalRoute('crab', 0, 0));
});

test('animals stay in local habitats instead of circling the island', () => {
    const habitats = { turtle: [1.15, 1.95], school: [1.0, 2.1], dolphin: [2.0, 2.75], ray: [-0.05, 0.6], crab: [0.7, 1.4] };
    for (const [kind, [min, max]] of Object.entries(habitats)) {
        for (let i = 0; i < (kind === 'school' || kind === 'crab' ? 3 : 2); i++) {
            for (let t = 0; t < 600; t += 0.5) {
                const p = animalRoute(kind, i, t);
                const angle = Math.atan2(p.z, p.x / 1.28);
                assert.ok(angle >= min && angle <= max, `${kind} left its habitat`);
            }
        }
    }
});
