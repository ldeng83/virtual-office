import test from 'node:test';
import assert from 'node:assert/strict';
import { daylightAtHour, localHour, normalizeAtmosphere, periodAtHour, periods } from '../src/daylight.ts';

test('local day periods change at the agreed boundaries', () => {
    for (const [hour, expected] of [[0, 'night'], [4.999, 'night'], [5, 'dawn'], [7, 'morning'], [11, 'midday'], [15, 'golden'], [18, 'dusk'], [20, 'night'], [23.999, 'night'], [24, 'night']]) assert.equal(periodAtHour(hour), expected);
    assert.equal(localHour(new Date(2026, 10, 11, 9, 30, 0)), 9.5);
});
test('lighting stays continuous at boundaries, anchors, and midnight', () => {
    const lighting = hour => {
        const { from, to, progress } = daylightAtHour(hour);
        assert.ok(progress >= 0 && progress <= 1);
        return ['ambient', 'sun', 'lamps', 'darkness'].map(key => periods[from][key] * (1 - progress) + periods[to][key] * progress);
    };
    for (const hour of [0, 0.5, 5, 6, 7, 9, 11, 13, 15, 16.5, 18, 19, 20, 24]) {
        const before = lighting(hour - 0.000001), after = lighting(hour + 0.000001);
        before.forEach((value, i) => assert.ok(Math.abs(value - after[i]) < 0.00001, `discontinuity at ${hour}`));
    }
    for (let minute = 0; minute < 1440; minute++) lighting(minute / 60);
    assert.deepEqual(lighting(0), lighting(24));
});
test('new settings follow real time and legacy presets migrate', () => {
    assert.deepEqual(normalizeAtmosphere(null, true), { mode: 'auto', mood: 'midday', motion: false, volume: 35 });
    assert.equal(normalizeAtmosphere({ mood: 'day' }).mood, 'midday');
    assert.equal(normalizeAtmosphere({ mood: 'sunset' }).mood, 'golden');
    assert.deepEqual(normalizeAtmosphere({ mode: 'manual', mood: 'dusk', motion: false, volume: 12 }), { mode: 'manual', mood: 'dusk', motion: false, volume: 12 });
    assert.equal(normalizeAtmosphere({ mood: '__proto__', volume: Infinity }).mood, 'midday');
    assert.equal(normalizeAtmosphere({ volume: 110 }).volume, 100);
    assert.equal(normalizeAtmosphere({ volume: -1 }).volume, 0);
});
