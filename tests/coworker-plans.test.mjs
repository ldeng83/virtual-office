import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePlans } from '../src/coworker-plans.ts';
import { hostedCoworkers } from '../src/hosted-people.ts';

const P = id => ({
  id,
  name: id,
  role: 'Teammate',
  present: true,
  tasks: [],
  look: { hair: '#222', hairStyle: 'short', shirt: '#7193b5' },
});
const none = new Set();

test('a newcomer gets a plan and nobody else is touched', () => {
  const two = hostedCoworkers([P('a'), P('b')]),
    plans = reconcilePlans({}, two, 'morning', none),
    three = hostedCoworkers([P('a'), P('b'), P('z')]),
    next = reconcilePlans(plans, three, 'morning', none);
  assert.ok(next.z);
  assert.equal(next.a, plans.a);
  assert.equal(next.b, plans.b);
});

test('someone who left is dropped', () => {
  const plans = reconcilePlans({}, hostedCoworkers([P('a'), P('b')]), 'morning', none),
    next = reconcilePlans(plans, hostedCoworkers([P('a')]), 'morning', none);
  assert.deepEqual(Object.keys(next), ['a']);
  assert.equal(next.a, plans.a);
});

test('a newcomer avoids a seat that is already taken', () => {
  const [a] = hostedCoworkers([P('a')]),
    home = a.schedule.morning.home.seats[0],
    free = reconcilePlans({}, [a], 'morning', none),
    blocked = reconcilePlans(
      {},
      [
        {
          ...a,
          schedule: {
            ...a.schedule,
            morning: { ...a.schedule.morning, home: { ...a.schedule.morning.home, seats: [home, 'pz-0'] } },
          },
        },
      ],
      'morning',
      new Set([home]),
    );
  assert.equal(free.a.seatId, home);
  assert.equal(blocked.a.seatId, 'pz-0');
});

test('a newcomer avoids a seat another coworker is using right now', () => {
  const [a, b] = hostedCoworkers([P('a'), P('b')]),
    seat = b.schedule.morning.home.seats[0],
    squatter = {
      ...a,
      schedule: {
        ...a.schedule,
        morning: { ...a.schedule.morning, home: { ...a.schedule.morning.home, seats: [seat] } },
      },
    },
    plans = reconcilePlans({}, [squatter], 'morning', none),
    choosy = {
      ...b,
      schedule: {
        ...b.schedule,
        morning: { ...b.schedule.morning, home: { ...b.schedule.morning.home, seats: [seat, 'pz-1'] } },
      },
    },
    next = reconcilePlans(plans, [squatter, choosy], 'morning', none);
  assert.equal(next.b.seatId, 'pz-1');
});

test('nothing to do returns the same object', () => {
  const people = hostedCoworkers([P('a'), P('b')]),
    plans = reconcilePlans({}, people, 'morning', none);
  assert.equal(reconcilePlans(plans, people, 'morning', none), plans);
});
