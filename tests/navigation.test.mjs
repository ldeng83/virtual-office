import test from 'node:test'
import assert from 'node:assert/strict'
import { findPath, walkable, locations, desks, seats, trees, meetingTables, forestTrees, ponds, coastRocks, districts, districtTrails } from '../src/world.ts'

test('island boundary, trees, desks, and meeting tables block movement', () => {
 assert.equal(walkable(60,0),false)
 assert.equal(walkable(0,12),false)
 for(const d of desks)assert.equal(walkable(d.x,d.z),false)
 for(const t of [...trees,...forestTrees])assert.equal(walkable(...t),false)
 for(const table of meetingTables) assert.equal(walkable(...table),false)
 for(const p of ponds) assert.equal(walkable(p.x,p.z),false)
 for(const [x,z] of coastRocks) assert.equal(walkable(x,z),false)
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

test('every map district is a safe, connected travel destination',()=>{
 for(const district of districts){assert.ok(walkable(...district.point),district.name);assert.ok(findPath([0,7],district.point).length,district.name)}
})
test('district trails remain clear of terrain obstacles',()=>{
 for(const path of districtTrails)for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*4)
  for(let n=0;n<=steps;n++){const t=n/steps;assert.ok(walkable(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t),`blocked trail ${a} → ${b}`)}
 }
})
