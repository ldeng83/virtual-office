import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autopilotBlock,
  idlePhase,
  PLAYER_SCHEDULE,
  seatHome,
  DEFAULT_AUTOPILOT,
  restoreAutopilot,
  inputIntent,
} from '../src/autopilot.ts';
import { nextActivity, resolveTarget, ARRIVAL_DOCK } from '../src/people.ts';
import { findPath, seats, walkable } from '../src/world.ts';
import { RIDE_SECONDS } from '../src/rides.ts';

const periods = ['dawn', 'morning', 'midday', 'golden', 'dusk', 'night'];

test('autopilot starts after 90 seconds idle by default; an old saved default moves with it', () => {
  assert.equal(DEFAULT_AUTOPILOT.delay, 90_000);
  assert.deepEqual(idlePhase(89_000, 90_000), { start: false, countdown: 1 });
  assert.equal(restoreAutopilot({ enabled: true, delay: 10_000, paused: false }).delay, 90_000);
  assert.equal(restoreAutopilot({ delay: 10_000, version: 2 }).delay, 10_000);
  assert.equal(restoreAutopilot({ delay: 30_000 }).delay, 30_000);
  assert.equal(restoreAutopilot({ enabled: false }).enabled, false);
});

test('the countdown shows for the last three seconds', () => {
  assert.deepEqual(idlePhase(2_000, 10_000), { start: false, countdown: null });
  assert.deepEqual(idlePhase(7_100, 10_000), { start: false, countdown: 3 });
  assert.deepEqual(idlePhase(9_500, 10_000), { start: false, countdown: 1 });
  assert.deepEqual(idlePhase(10_000, 10_000), { start: true, countdown: null });
});

test('your autopilot day has a home for every period, and every spot exists and is reachable', () => {
  for (const p of periods) {
    const block = PLAYER_SCHEDULE[p];
    assert.ok(block?.home, p);
    for (const a of [block.home, ...block.errands]) {
      for (const id of a.seats ?? [])
        assert.ok(
          seats.some(s => s.id === id),
          `${p} ${a.activity} seat ${id}`,
        );
      const target = resolveTarget(a, new Set());
      assert.ok(walkable(...target.approach), `${p} ${a.activity}`);
      assert.ok(findPath(ARRIVAL_DOCK, target.approach).length, `${p} ${a.activity} reachable`);
      const ride = a.seats && seats.find(s => s.id === a.seats[0])?.ride;
      if (ride) assert.ok(a.dwell[0] >= RIDE_SECONDS[ride.kind], `${a.activity} lasts the whole ride`);
    }
  }
  // Rides and hikes are part of it.
  const all = periods.flatMap(p => PLAYER_SCHEDULE[p].errands);
  assert.ok(all.filter(a => a.trail).length >= 3);
  assert.ok(all.filter(a => a.seats?.some(id => seats.find(s => s.id === id)?.ride)).length >= 5);
});

test('your status shapes the plan: Focused and In a meeting stay put, Available roams', () => {
  const focused = autopilotBlock('midday', 'Focused', null);
  assert.equal(focused.errands.length, 0);
  assert.ok(focused.home.work && focused.home.seats.every(id => id.startsWith('booth-')));
  const meeting = autopilotBlock('morning', 'In a meeting', null);
  assert.equal(meeting.errands.length, 0);
  assert.equal(meeting.home.status, 'In a meeting');
  for (const status of ['Available', 'Away']) {
    const block = autopilotBlock('golden', status, null);
    assert.equal(block.home, PLAYER_SCHEDULE.golden.home);
    assert.ok(block.errands.length > 0);
  }
});

test('a seat you were already in becomes home; rides never do', () => {
  const desk = seatHome('desk-3');
  assert.deepEqual(desk.seats, ['desk-3']);
  assert.ok(desk.work);
  assert.equal(autopilotBlock('morning', 'Focused', desk).home, desk);
  assert.equal(autopilotBlock('morning', 'Available', desk).home, desk);
  // A hammock is home while Available, but Focused heads to the library instead.
  const hammock = seatHome('hm-0');
  assert.equal(autopilotBlock('dusk', 'Available', hammock).home, hammock);
  assert.notEqual(autopilotBlock('dusk', 'Focused', hammock).home, hammock);
  assert.equal(seatHome('pa-0'), null);
  assert.equal(seatHome(null), null);
  // From that home, the planner still picks errands and comes back.
  const block = autopilotBlock('morning', 'Available', desk);
  assert.equal(nextActivity(block, null), desk);
  assert.notEqual(
    nextActivity(block, desk, () => 0.5),
    desk,
  );
});

test('looking around (zoom, pan, orbit) leaves autopilot running; clicks and keys take over', () => {
  // Scroll to zoom over the island, and the zoom buttons.
  assert.equal(inputIntent('wheel', 0, 'view'), 'look');
  assert.equal(inputIntent('wheel', 0, 'panel'), 'look');
  assert.equal(inputIntent('pointerdown', 0, 'zoom'), 'look');
  // Right-drag orbits; a left press waits to see whether it's a drag (pan) or a click (walk).
  assert.equal(inputIntent('pointerdown', 2, 'view'), 'look');
  assert.equal(inputIntent('pointerdown', 0, 'view'), 'press');
  // Everything else is you taking control.
  assert.equal(inputIntent('keydown', 0, 'view'), 'control');
  assert.equal(inputIntent('pointerdown', 0, 'panel'), 'control');
  assert.equal(inputIntent('pointerdown', 0, 'other'), 'control');
  assert.equal(inputIntent('wheel', 0, 'other'), 'control');
});
