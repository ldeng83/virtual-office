# Wingsuit & parachute jumps — design

Date: 2026-11-20 · Status: draft for approval

## Intent

Add two sky activities to the island: **wingsuit flying** and **parachuting**.
Both are *automatic*: you start the jump and watch it play out, like the
existing parasail, water-taxi and scuba rides. Variety comes from **several
routes per sport**, and the route is **drawn at random each jump**, so jumping
again is a surprise. Your own **autopilot jumps too**, so an idle player
sometimes hikes up and goes.

## Goals

- Two new ride kinds, `wingsuit` and `parachute`, built on the existing
  `Seat.ride` / `ridePose()` system (world.ts, rides.ts) — no physics engine.
- One jump ledge per sport at the Highlands summit. Pressing E (or clicking)
  at a ledge starts a jump on a randomly drawn route.
- At least three routes per sport (below), each ending at a different landing
  spot via `ride.exit`.
- The same route is never drawn twice in a row (per ledge).
- The HUD names the route drawn ("Wingsuit · Gorge run").
- Player autopilot (use-autopilot.ts / autopilot.ts) can choose a jump as an
  errand.

## Non-goals

- No manual steering, no flight model, no new touch controls.
- No route picker menu (the user chose random over picking).
- No plane or balloon launch in this change (possible later).
- No scoring, rings or logbook in this change.
- Coworkers don't jump in this change. A finished ride snaps a coworker back to
  its seat (coworkers.tsx ~297), which would teleport them from the landing
  spot to the summit; fixing that means letting coworkers continue from a
  ride's `exit`, a separate change to the schedule in people.ts.
- No free swimming after a water landing.

## Anti-goals (would make it a failure even if it works)

- Flying through terrain: every route stays visibly above `groundHeight()`
  along its whole path.
- A jump that strands you: you always end standing on walkable ground (or
  swim ashore for the lake route) and can walk home.
- Motion sickness: no camera snaps or spins; respect `settings.motion` /
  `prefers-reduced-motion`.

## Approaches considered

1. **One ledge per route** — choose by where you walk. Fits the existing
   one-seat-one-ride pattern but crowds the summit.
2. **One ledge, random route** — *chosen by the user.* Simple placement,
   surprise every jump.
3. **One ledge with a route menu** — full choice, but the only activity with a
   menu and needs new phone-friendly UI.

## Decided

- Automatic rides, random route per jump (user).
- Autopilot jumps when idle (user).
- Built in virtual-office and synced to bi-ops-web with `npm run sync:island`
  (SOURCE.md forbids editing the copy).

## Builder's calls (proposed, correct me)

- **Two ledges, one per sport**, near `SUMMIT` (highlands.ts). Not one ledge
  that also randomises the sport.
- **Route data:** each route is a list of 3D waypoints `[x, y, z]` (the water
  taxi's `Point[]` is 2D), plus a name, landing `exit`, and duration.
  `ride.route` stays for the ferry; jump routes live in a new `routes` list on
  the ride, and the drawn index is held in the live ride state (`riders`).
- **Wingsuit routes** (from the peak, ~17 high: fast, hugging terrain, chute
  pops at the end):
  - *Gorge run*: down `GORGE`, past `FALLS`, out over the sea, landing on the
    office-island beach.
  - *Lake skim*: low sweep over `LAKE`, landing at `CAMPSITE`.
  - *Island hop*: long glide across open sea, landing on the office-island lawn.
- **Parachute routes** (short free fall, canopy, slow drift):
  - *Meadow spiral*: circles down to `LANDING`.
  - *Coast drift*: drifts along the shore to `WEST_JETTY`.
  - *Lake splash*: splashes down in `LAKE`, then a short **scripted** swim to
    the shore (part of the route's poses, not player-controlled); `exit` is on
    the bank.
- **Pose:** banking roll from path curvature for the wingsuit; parasail's chute
  swing reused for the canopy phase.
- **Camera:** in follow mode, pull out with height like parasail
  (scene.tsx ~420) so the flight stays in frame.
- **One rider per ledge:** only the player jumps, so each ledge is one seat.
  The last-drawn route per ledge is kept in module state (fun-state.ts style),
  not in the rider.
- **Cut away early:** a movement key ends the scripted route and you float
  straight down to `groundHeight()` below, then stand — **only when the point
  below is walkable land**. Over water (lake, sea) movement keys are ignored
  and the route plays on, so a jump can never strand you offshore.
- **Reduced motion:** a slow straight-down canopy float at the ledge, then a
  fade to the route's landing spot. No sweeping flight, so it never crosses
  terrain.
- **Autopilot:** add `ride('wingsuit', …)` and `ride('parachute', …)` errands
  to the golden-hour block, low weight, next to the summit hike.
- **Models:** simple low-poly suit and canopy meshes in the style of
  water-sports.tsx.

## Left to the builder

- Exact waypoint coordinates and durations; tune by eye in the running app.
- Ledge placement and marker look.
- Labels in `RIDES` (interact.ts) and messages in `RIDE_MESSAGES` (use-fun.ts).
- Tests: pure tests for route drawing (no repeat), route clearance above
  terrain, pose endpoints matching each route's `exit`, every `exit` walkable,
  and cut-away refused over water.
