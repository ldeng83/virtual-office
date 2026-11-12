import test from 'node:test'
import assert from 'node:assert/strict'
import { findPath, walkable, locations, desks, seats, trees } from '../src/world.ts'

test('island boundary, trees, desks, and meeting tables block movement', () => {
 assert.equal(walkable(15,0),false)
 assert.equal(walkable(0,12),false)
 for(const d of desks)assert.equal(walkable(d.x,d.z),false)
 for(const t of trees)assert.equal(walkable(...t),false)
 assert.equal(walkable(5,-5),false)
 assert.equal(walkable(8,-2),false)
 assert.equal(walkable(0,7),true)
})
test('every location is connected by a collision-free route',()=>{
 for(const start of locations)for(const end of locations){
  const route=findPath(start.point,end.point)
  assert.ok(route.length,`${start.name} → ${end.name}`)
  for(const point of route)assert.ok(walkable(...point))
  assert.deepEqual(route.at(-1),end.point)
 }
})
test('all seats have walkable access from arrival',()=>{
 for(const seat of seats){assert.ok(walkable(...seat.point),seat.name);assert.ok(findPath([0,7],seat.point).length,seat.name)}
})
test('invalid destinations return no path',()=>{
 assert.deepEqual(findPath([0,7],[100,100]),[])
 assert.deepEqual(findPath([0,7],[desks[0].x,desks[0].z]),[])
})
