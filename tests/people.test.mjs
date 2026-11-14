import test from 'node:test'
import assert from 'node:assert/strict'
import { demoCoworkers, resolveTarget, nextActivity, ARRIVAL_DOCK } from '../src/people.ts'
import { findPath, walkable, seats } from '../src/world.ts'

const periods = ['dawn', 'morning', 'midday', 'golden', 'dusk', 'night']
const activities = (block) => block ? [block.home, ...block.errands] : []

test('demo coworkers have a block (or time off) for every period', () => {
  for (const npc of demoCoworkers) for (const p of periods) assert.ok(p in npc.schedule, `${npc.name} ${p}`)
})

test('every home and errand spot exists, is walkable, and reachable from the dock', () => {
  for (const npc of demoCoworkers) for (const p of periods) for (const a of activities(npc.schedule[p])) {
    for (const seat of a.seats ?? []) assert.ok(seats.some(s => s.id === seat), `${npc.name} ${a.activity} seat ${seat}`)
    for (const taken of [new Set(), new Set(a.seats ?? [])]) {
      const target = resolveTarget(a, taken)
      assert.ok(walkable(...target.point), `${npc.name} ${a.activity}`)
      assert.ok(findPath(ARRIVAL_DOCK, target.point).length, `${npc.name} ${a.activity} reachable`)
      assert.ok(target.dwell >= a.dwell[0] && target.dwell <= a.dwell[1])
    }
  }
})

test('coworkers take the next seat when their first choice is taken', () => {
  const home = demoCoworkers[0].schedule.morning.home
  assert.equal(resolveTarget(home, new Set([home.seats[0]])).seatId, home.seats[1])
})

test('home spots never collide between coworkers', () => {
  for (const p of periods) {
    const spots = demoCoworkers.map(n => n.schedule[p] && resolveTarget(n.schedule[p].home)).filter(Boolean).map(t => t.point.join(','))
    assert.equal(new Set(spots).size, spots.length, p)
  }
})

test('planner alternates home and weighted errands', () => {
  const block = demoCoworkers[0].schedule.morning
  assert.equal(nextActivity(block, null), block.home)
  assert.equal(nextActivity(block, block.errands[0]), block.home)
  // weights: coffee 3, stretch 1 → low rolls pick coffee, high rolls pick the stretch
  assert.equal(nextActivity(block, block.home, () => 0.1), block.errands[0])
  assert.equal(nextActivity(block, block.home, () => 0.9), block.errands[1])
})

test('working moves the task forward and finishing starts the next one', async () => {
  const { advanceWork } = await import('../src/people.ts')
  const theo = demoCoworkers[1], first = theo.tasks[0]
  let { state, finished } = advanceWork(theo, { task: 0, progress: 0 }, first.seconds / 2)
  assert.equal(finished, null)
  assert.ok(Math.abs(state.progress - 0.5) < 1e-9)
  ;({ state, finished } = advanceWork(theo, state, first.seconds / 2))
  assert.equal(finished, first)
  assert.deepEqual(state, { task: 1, progress: 0 })
  ;({ state } = advanceWork(theo, { task: theo.tasks.length - 1, progress: 0.99 }, 1000))
  assert.equal(state.task, 0)
})

test('the whiteboard spot is reachable and every coworker has work time in their day', async () => {
  const { WHITEBOARD_SPOT } = await import('../src/people.ts')
  assert.ok(findPath(ARRIVAL_DOCK, WHITEBOARD_SPOT).length)
  for (const npc of demoCoworkers) assert.ok(periods.some(p => activities(npc.schedule[p]).some(a => a.work)), npc.name)
})
