# Island cruise boat — design

Date: 2026-11-20 · Status: draft for approval

## Intent

A large passenger boat at a new dock that lots of people ride together.
It sails on a timetable; anyone aboard when it casts off goes along. Trips
vary. Passengers (you, your autopilot, simulated coworkers) sit, lean on the
rails, wave and take photos — and **you can walk around the deck while it
sails**. It should make the island feel busy and shared.

"Multiple users" here means the island's existing crowd: other people are
simulated per browser (only check-in presence is shared). Real shared
positions are a separate, later project. Because the timetable runs off the
wall clock, every browser sees the boat leave at the same moment.

## Goals

1. **New dock**: a long pier off the south-east coast, from the shore near
   (30, 5) out to a berth near (36–38, 13–15), clear of the boardwalk,
   firepit/hammocks and marina. Gangway, departure board, bell.
2. **Timetable**: departures every few minutes, computed from wall-clock time
   (like sea life in open-sea-scene.tsx:199), so it's the same everywhere.
   The boat waits at the berth to board, rings the bell, raises the gangway,
   sails, returns, lowers the gangway.
3. **Trips** (which trip a sailing runs is also derived from the clock):
   - *Island loop*: round the office island.
   - *Highlands cruise*: out past the Highlands and back.
   - *Sunset cruise*: only in golden / dusk periods (daylight.ts).
   - *Whale run*: into the open sea, passing the existing whales via
     `seaState.sights` / `planDetour` (rides.ts:232).
   Every trip is a round trip back to the same berth.
4. **On deck**: 10–12 deck spots (rail benches, sun-deck loungers, bow,
   stern). A captain stands at the wheel (scenery, not a seat). Passengers
   idle with poses: lean on the rail, wave, take a photo, doze.
5. **Walk the deck**: while aboard, the player walks freely on the deck.

## Approach (chosen: deck coordinates)

Considered:
1. **Deck coordinates** — *chosen.* While aboard, the player's position is a
   point `(u, v)` in the boat's own frame; walking moves `(u, v)` inside the
   hull outline; world position = boat pose ∘ `(u, v)` every frame.
2. Moving walkable region — make the deck part of `walkable()` and drag the
   player with it each frame. Rejected: pathfinding and walk checks assume
   static ground (cached grid in world.ts); slip-off glitches, hard to test.
3. Spot-hopping — movement keys jump between fixed deck spots. Rejected: not
   real walking, which is the point.

## Decided

- Items 1–5 above, deck coordinates for walking (user).
- Built in virtual-office, synced to bi-ops-web with `npm run sync:island`.

## Builder's calls (proposed, correct me)

**Boat & state**
- One boat, *Island Queen*, ~10 long × 4 wide, two levels drawn but one
  walkable deck plus a small raised sun deck reached by a step (or keep it one
  level if the step complicates walking — builder's choice).
- A pure module (e.g. `cruise.ts`): `sailingAt(now)` → `{ phase:
  'boarding' | 'departing' | 'sailing' | 'arriving', trip, t, departsIn,
  backIn }` and `boatPose(now)` → `{ x, z, heading, roll, pitch }`. Pure
  functions of time so they are testable and identical across browsers.
- **One fixed cycle** (tunable): ~60 s boarding, bell at −15 s, a ~3–4 min
  trip; every trip fits the same trip time, with the boat's speed set per
  route. Sailing number = `floor(now / cycle)`; no epoch bookkeeping. Keep the
  Highlands cruise short enough (e.g. up the east coast toward the Highlands'
  south shore and back) that its speed stays boat-like.
- **Trip choice** is a pure function of the sailing number plus the period
  computed in a fixed zone (America/New_York, the company's), **not** the
  viewer's local zone or manual mood setting: rotation of Island loop /
  Highlands cruise / Whale run, with Sunset cruise substituted when that fixed
  zone is golden or dusk. So every browser agrees on the trip.
- **Whale run** aims at the clock-driven whale position (`whalePose(whale, t)`
  in open-sea.ts) for the time the boat will be there, and fits inside the
  fixed trip time. It never reads `seaState`/`planDetour`, so `boatPose(now)`
  stays a pure function of time and "back in" is exact.

**Boarding & leaving**
- While the gangway is down, walking up it puts you aboard: switch from world
  `pos` to deck `(u, v)`. Walking down it (or off the stern edge at the
  gangway) puts you back on the pier.
- Once the gangway is up you can't get off; deck edges are walls.
- If you stay aboard, you ride the next sailing too.
- Missing the boat: the gangway rises at departure; the pier end is just
  pier.

**On deck**
- Walking: keys / touch stick move `(u, v)` relative to camera azimuth minus
  boat heading; clamp to a hull outline polygon minus the wheelhouse and
  rail. Tap-to-walk on deck: raycast the deck plane, convert to `(u, v)`,
  walk a straight line (the deck is open enough; no A*).
- Deck seats: E/Space/click near a bench or lounger sits you; any movement key
  stands you up again (on deck, not off the boat).
- Camera follow keeps working because world position is still computed each
  frame; zoom out a little while sailing.

**Crowd**
- Coworkers: a new errand "On the *Island Queen*" in the daytime periods
  (morning through dusk), with a higher weight in golden/dusk so the sunset
  cruise is the busiest. They ride whichever sailing is next: walk to the
  pier, wait on it if the boat is out, board during boarding, take a free deck
  spot, idle-pose for one sailing, and walk off when it's back.
  Because every trip returns to the same berth, the "snap back to seat" issue
  from the jumps doesn't arise.
- Player autopilot: same errand; it boards, sits, rides one sailing, walks off.
- Deck spots are shared through the existing `occupied` / `taken` logic, so
  two people never take the same bench.

**HUD**
- At the pier: "*Island Queen* · Sunset cruise · departs in 0:40".
- Aboard: "Aboard *Island Queen* · Whale run · back in 2:10".
- Bell sound/flash and a toast at departure (respect existing sound settings
  if any).

**Motion & performance**
- Boat route waypoints stay in water and clear of other docks (reuse
  `obstacles` / `DOCKS` in boat-trips.ts:21-49).
- Gentle roll/pitch; with reduced motion, no roll/pitch and no camera sway.
- Boat and pier meshes batched like other statics; passengers reuse existing
  avatar meshes.

## Non-goals

- Real multi-user presence (seeing actual teammates aboard).
- Stops at other docks / one-way trips.
- Steering the boat yourself.
- Swimming off the boat.

## Anti-goals

- Falling through or sliding off the deck, or ending up in the sea.
- The boat clipping the island, piers or other boats.
- Breaking existing walking, rides or jumps (walkable/findPath untouched for
  on-ground movement).

## Left to the builder

- Exact pier and berth coordinates, hull outline, cycle timings, route
  waypoints.
- Idle-pose animations and boat/pier look, in the style of water-sports.tsx.
- Tests (pure): timetable phases and trip rotation; boat pose continuity and
  water clearance along every route; deck-walk clamping inside the hull;
  board/leave only via gangway while docked; deck spots never double-booked;
  coworkers return to the pier.
