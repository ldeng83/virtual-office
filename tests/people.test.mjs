import test from 'node:test'
import assert from 'node:assert/strict'
import { demoCoworkers, resolveTarget, ARRIVAL_DOCK } from '../src/people.ts'
import { findPath, walkable, seats } from '../src/world.ts'

const periods = ['dawn', 'morning', 'midday', 'golden', 'dusk', 'night']

test('demo coworkers have a slot (or day off) for every period', () => {
  for (const npc of demoCoworkers) for (const p of periods) assert.ok(p in npc.schedule, `${npc.name} ${p}`)
})

test('every scheduled place exists, is walkable, and reachable from the dock', () => {
  for (const npc of demoCoworkers) for (const p of periods) {
    const slot = npc.schedule[p]
    if (!slot) continue
    for (const seat of slot.seats ?? []) assert.ok(seats.some(s => s.id === seat), `${npc.name} ${p} seat ${seat}`)
    for (const playerSeat of [null, ...(slot.seats ?? [])]) {
      const target = resolveTarget(slot, playerSeat)
      assert.ok(walkable(...target.point), `${npc.name} ${p}`)
      assert.ok(findPath(ARRIVAL_DOCK, target.point).length, `${npc.name} ${p} reachable`)
    }
  }
})

test('coworkers avoid the seat the player is in', () => {
  const slot = demoCoworkers[0].schedule.morning
  assert.notEqual(resolveTarget(slot, slot.seats[0]).seatId, slot.seats[0])
})

test('coworkers never share a spot in the same period', () => {
  for (const p of periods) {
    const spots = demoCoworkers.map(n => resolveTarget(n.schedule[p], null)).filter(Boolean).map(t => t.point.join(','))
    assert.equal(new Set(spots).size, spots.length, p)
  }
})
