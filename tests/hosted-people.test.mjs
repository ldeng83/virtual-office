import test from 'node:test';
import assert from 'node:assert/strict';
import { hostedCoworkers, WORK_SEATS } from '../src/hosted-people.ts';
import { resolveTarget } from '../src/people.ts';
import { seats } from '../src/world.ts';
import { periods } from '../src/daylight.ts';

const P = (id, extra = {}) => ({
  id,
  name: id,
  role: 'Teammate',
  present: true,
  tasks: [],
  look: { hair: '#222', hairStyle: 'short', shirt: '#7193b5' },
  ...extra,
});
const homes = people => people.map(p => p.schedule.morning.home.seats);

test('only present people, in a stable order', () => {
  const out = hostedCoworkers([P('b'), P('a'), P('c', { present: false })]);
  assert.deepEqual(
    out.map(p => p.id),
    ['a', 'b'],
  );
  assert.deepEqual(homes(hostedCoworkers([P('a'), P('b')])), homes(out));
});

test('every period is planned and every seat exists', () => {
  for (const p of hostedCoworkers([P('a'), P('b')]))
    for (const period of Object.keys(periods)) {
      const block = p.schedule[period];
      assert.ok(block, `${p.id} ${period}`);
      for (const a of [block.home, ...block.errands])
        for (const id of a.seats ?? [])
          assert.ok(
            seats.some(s => s.id === id),
            id,
          );
    }
});

test('work seats are real seats, desks first', () => {
  assert.equal(WORK_SEATS[0], 'desk-0');
  for (const id of WORK_SEATS)
    assert.ok(
      seats.some(s => s.id === id),
      id,
    );
  assert.equal(new Set(WORK_SEATS).size, WORK_SEATS.length);
});

test('home seats are distinct, and a crowd overflows without sharing', () => {
  const crowd = hostedCoworkers(Array.from({ length: WORK_SEATS.length + 5 }, (_, i) => P(`m${i}`)));
  const taken = crowd.map(p => p.schedule.morning.home.seats?.[0]).filter(Boolean);
  assert.equal(taken.length, WORK_SEATS.length);
  assert.equal(new Set(taken).size, taken.length);
  for (const p of crowd.filter(p => !p.schedule.morning.home.seats)) assert.ok(resolveTarget(p.schedule.morning.home));
});

test('someone who sorts last does not move anyone already seated', () => {
  const before = hostedCoworkers([P('a'), P('b')]),
    after = hostedCoworkers([P('a'), P('b'), P('z')]);
  assert.deepEqual(homes(after).slice(0, 2), homes(before));
});

test('the same person keeps the same seat across periods', () => {
  const [p] = hostedCoworkers([P('a')]);
  assert.deepEqual(p.schedule.midday.home.seats, p.schedule.morning.home.seats);
  assert.equal(p.schedule.morning.home.work, true);
});

test('tasks fall back, and the look carries over', () => {
  const [p] = hostedCoworkers([
    P('a', { look: { hair: '#111', hairStyle: 'long', shirt: '#abc', skin: '#fed', bottoms: '#123' } }),
  ]);
  assert.equal(p.tasks[0].title, 'Heads-down work');
  assert.deepEqual([p.color, p.hair, p.hairStyle, p.skin, p.bottoms], ['#abc', '#111', 'long', '#fed', '#123']);
  const [q] = hostedCoworkers([P('a', { tasks: ['Ship the report', 'Review PRs'] })]);
  assert.deepEqual(
    q.tasks.map(t => t.title),
    ['Ship the report', 'Review PRs'],
  );
});
