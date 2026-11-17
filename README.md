# BIsland — Boston Identity Island

A desktop-first, single-player prototype of a browser-based 3D office for a team of ten. Built with React, TypeScript, React Three Fiber, Drei, Three.js, and Vite. All scenery is generated from geometry; no external 3D models are needed.

## Run

Use Node.js 24 LTS and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Production build: `npm run build`. Preview the build: `npm run preview`.

## Explore

- Click the ground to walk around obstacles. The island is an office park on the water (about 78 × 65 units; `GROWTH` in `src/shoreline.ts` sets its size, and each zone keeps its own layout while moving outward with the coast): an arrival pier and glass lobby on the south shore, a central plaza with a fountain and team-news screen, a main workspace with 14 desks in Design and Engineering areas around a planted atrium, Pavilions S, M and L (2, 6 and 12 seats), a focus library with six booths, a café with a sea-view terrace, a town hall amphitheater, a wellness garden with a walking loop around the pond, a boardwalk with loungers on the east beach, and a marked future plot. Buildings have a solid base, a glass window band and roofs (a green roof on the workspace); the lobby and pavilions are glass between timber posts with translucent roofs. Walls block walking, so enter through the doorways where the walkways arrive. When you step inside, or pan the camera onto a building, its roof fades away and the camera-facing walls turn see-through, so you can see the people at their desks. Name boards mark each entrance, and the plaza screen shows the clock and the latest team news. Sitting in a library booth switches your status to Focused; standing up restores it.
- Use WASD or arrow keys to move relative to the camera.
- The camera follows your avatar by default. Choose **Island overview** to see the full island, or **Follow me** to return. Right-drag to orbit; use the on-screen + / − buttons to zoom. Reset view restores the camera orientation and zoom for the selected mode.
- Click a chair to sit; walk or select **Stand up** to leave.
- Select any of nine places in the scrollable sidebar to travel there. A round mini-map in the corner stays centred on you (north up) with an arrow for the way you face, the place icons, coworkers and the route you're walking. Click it or press **M** for the full map: both islands with place names, trails, the bridge and the water-taxi route, and where everyone on the team is (names step aside when people sit close together). On the full map, click to walk there (the route is drawn), double-click to jump, drag and scroll to look around, and use Office / Highlands / Both to frame it. Its side panel lists the trails (with length, difficulty and a ✓ once done, plus a Hike button) and people (Find). Esc closes it. Travelling or starting to walk restores Follow me.
- Check in or out, change availability, and edit your name and avatar color.
- You never lose yourself behind scenery: when trees, roofs, or canopies cover your avatar, a tinted silhouette shows through them, and a soft ring in your color pulses at your feet (also shown when zoomed far out). Coworkers get a fainter silhouette. Scenery itself never fades or changes.
- Take a break: ping-pong (with rallies) and cornhole on the games lawn; hammocks that sway and a firepit with log seats by the east beach; a fishing jetty off the west coast where something bites every so often, with kayaks that paddle a loop around the island; a piano that plays a soft improvisation while you sit at it; a lo-fi radio on the café counter you hear louder the closer you are; loungers on the workspace's rooftop terrace (up the outdoor stair); a team quiz at golden hour and movie night at dusk on the town hall screen; and a telescope by the yoga deck that shows a constellation after dusk.
- Rides (all on autopilot; any movement key brings you back): from the water sports dock on the south-west shore, a jet ski that laps the island and hops waves, a sailboat for two on a slow clockwise lap, and parasailing behind a tow boat that lifts you 10 units up while the camera pulls back over the island. From the jetty, kayaks and a scuba dive down to a reef with coral, a turtle, fish and a small wreck (the water clears around you). On the north shore, a climbing bluff with a lookout on top.
- The Highlands: a wild second island across the strait to the north, reached by a high rope bridge from beside the games lawn (boats pass underneath) or by the water taxi from the water sports dock to its west jetty. A 17-unit mountain with a summit cairn, flag and benches; a lake ringed with birches, with a jetty and lily pads; a creek down from a waterfall pool, with a crystal cave beside the falls; a gorge with a hanging bridge; pine forest, palms by the beach, a ranger hut and a campsite with tents and a campfire. Three marked trails start at the trailhead board: 🟢 Lakeside Loop (easy), 🔵 Waterfall Trail (moderate) and ⚫ Summit Ridge (hard, in switchbacks). Pick one on the board to hike it on autopilot. Passing every checkpoint earns that trail's badge, and the footer counts trails done and summits this week. Deer graze in the clearings and bolt if you come close, birds lift off the trees, fireflies come out at night and a cloud bank wraps the mountain in the morning. The team hikes too: lake loops, lunchtime walks to the falls and summit climbs, and Wilson heads over to the campsite fire at dusk.
- Small touches: Mochi the island cat wanders between sunny spots and follows you for a while after you pet her; five seashells wash up along the coast each day (walk over them to collect); emotes (wave, dance, high five, cheer) that nearby coworkers react to; a nudge to take a break after a long stretch at your desk; and passing showers followed by a rainbow (or bring one on from the island settings).
- The team uses the fun spots too: piano and hammock breaks, ping-pong and cornhole at lunch, fishing in the morning, the rooftop at golden hour, and movie night or the firepit at dusk. Everyone takes rides as well (kayaks, jet skis, sailing, parasailing, the climbing bluff and reef dives), at least three a day each. One-seat rides are never shared: if someone is already on it, the planner picks another errand. Take the other sailboat seat to sail with whoever is aboard.
- You are Le Deng (rename yourself in profile settings). Open the people tab to see you and the seven teammates who walk the island on a demo routine: Shuwan Yao, Bin Yang, Aaron Wang, Wilson Zhang, Houping Zhu, Bin Lin and Daniel Zheng. Avatars show two-letter initials, and Shuwan's avatar has long hair. Each part of the island's day gives them a home activity (desk, Pavilion M, library booth, boardwalk) plus short errands such as café coffee runs, garden laps, whiteboard sketching, and 1:1s in Pavilion S that a small planner picks every 15–50 seconds. They walk between places, sit in seats you then can't take, breathe, look around, type, nod in meetings, show an activity icon, turn to look at you when you come near, wave if they're available, and appear on the mini-map. Walk near one to say hi, or use the locate button in the people tab to look at them. Each has a small task backlog: time at a work spot fills a progress bar on their name tag, their desk monitor glows and shows live code or growing wireframes, the meeting-grove whiteboard fills with boxes and sticky notes while Bin Yang sketches, and finishing a task pops a “✅ Shipped” bubble. Walk close to see their current task card. The Activity tab is a team feed of arrivals, meetings, coffee breaks, and shipped tasks; select an entry to look at that person. Turn them off in profile settings. They use the same person model that real coworkers will use once shared presence arrives.
- Walkways run from the plaza to every zone. The fountain, tables, chairs, benches, stools, loungers, booth panels, lamp posts, flower beds, trees and the pond all block walking. To sit, select a seat; standing up (or walking off) steps you out to the seat's free side, and coworkers walk to that spot before they sit. Palms ring the coast and a few shade trees stand on the lawns; all trees use fixed geometry and never change detail or visibility.
- Open the sliders button at the top right of the island for real-time lighting, manual day periods, gentle motion, and optional ocean audio.
- Night adds warm workspace lighting, glowing windows, path lights along every walkway, plaza lamp posts and a lit café terrace. Audio has a volume control and pauses when the tab is hidden. It starts muted on every visit.
- Follow real time is on by default and uses your device timezone: Dawn (5–7 am), Morning (7–11 am), Midday (11 am–3 pm), Golden hour (3–6 pm), Dusk (6–8 pm), Night (8 pm–5 am). These are fixed local windows, independent of season or location. Lighting, water, shadows, lamps, and stars blend between period centers, including across midnight.
- Select any period to hold it manually; turn Follow real time back on to resume. The island chip always shows the current local clock, with a Manual badge when overridden.
- The ocean blends turquoise shallows into deeper blue water, with crossing surface swells, broken shoreline foam, moving light patterns in the shallows, and sparse glints. Broad highlights respond to the sun or moon direction; underwater light patterns soften at night. Water colors follow all six day periods, with warmer highlights at sunset and cooler glints at night.
- Sea life includes two surfacing turtles, three schools of seven fish, two dolphins with staggered leaps, two gliding manta rays, and three beach crabs that scuttle, pause, and hide in the sand. Animals stay in localized habitats: turtles and fish near the dock, rays along the right-hand shallows, dolphins farther offshore to the left, and crabs on the front-right beach. Their small oval routes leave open stretches of ocean; crabs stay clear of the dock. Translucent water reveals underwater animals.
- Trees stay static, clouds drift with soft ground shadows, and fireflies glow over the wellness garden pond from dusk into night. Cloud colors and firefly visibility follow the day cycle.
- Motion defaults off when your device requests reduced motion; you can change it in island settings. Turning it off freezes sea animal movement, ocean swells, foam, light patterns, and glints, clouds, and firefly movement and pulsing in place; static evening glows remain visible.

Check-in, name, color, status, and atmosphere preferences persist in browser localStorage. This is a local prototype, with no authentication, shared presence, attendance backend, chat, microphone capture, or voice calls. The meeting areas are scenery for this milestone.

## Project structure

- `src/main.tsx`: entry point.
- `src/app.tsx`: app shell: header, island panel overlays, bottom bar, and app-wide state.
- `src/sidebar.tsx`, `src/dialogs.tsx`: sidebar (check-in, places, people, activity feed) and the help, profile and atmosphere dialogs.
- `src/scene.tsx`: the 3D world: camera modes, avatar movement, seating, visibility ring, and scene composition.
- `src/scene-parts.tsx`: shared scene pieces (boxes, cylinders, palms, seats by kind, place labels).
- `src/label.tsx`: DOM labels pinned to 3D positions (name tags, place labels).
- `src/use-coworkers.ts`: demo coworker state: routines, work progress, team feed, greetings, and seat ownership.
- `src/profile.ts`: your stored name, color, status, and check-in.
- `src/sea-life.tsx`: geometry-based sea animals and species-specific animation.
- `src/sea-life-motion.ts`: offshore routes, dolphin leaps, and crab behavior.
- `src/ocean.tsx`: procedural water gradient, displaced swells, caustics, shoreline foam, and sun/moon highlights in a single shader surface.
- `src/island-life.tsx`: drifting clouds, soft cloud shadows, and evening fireflies.
- `src/daylight.ts`: local time mapping, continuous day-cycle sampling, and saved-settings migration.
- `src/atmosphere.tsx`: lighting presets, atmosphere controls, and synthesized ocean audio.
- `src/shoreline.ts`: shared coastal contour for terrain, collision, ocean effects, and animal routes.
- `src/terrain.tsx`: shaped sand and grass terrain plus click-to-walk surface.
- `src/world.ts`: campus layout (building pads, furniture, seats, walkways, places), collision rules, and A\* navigation (8 directions, no corner cutting) with cached grid checks, straightened into clean lines by line-of-sight smoothing.
- `src/buildings.tsx`: building and pavilion shells (walls between doorways, glass, roofs) that open up when you're inside.
- `src/highlands.ts`, `src/highlands-scene.tsx`: the Highlands as data (coast, terrain height with trails cut into the slope, lake, creek, gorge, bridges and jetties, trails, forest, where you can walk) and in 3D (terrain, water and falls, bridges, trails and markers, hut, camp, cave, summit, instanced forest, deer, birds, fireflies and clouds). `groundHeight(x, z)` is the one source of how high anyone stands.
- `src/batch.ts`, `src/static-batch.tsx`: merges scenery that never moves (seats, desks, palms, campus decor, fun spots, the dock, bluff and reef) into one draw per material; the originals stay for clicks. Mark a moving part inside with `userData={{ dynamic: true }}`.
- `src/rides.ts`, `src/water-sports.tsx`: ride paths over time (shared by the player and the vehicles), and the dock, jet skis, sailboat, tow boat and chute, climbing bluff and dive reef.
- `src/fun.tsx`: games lawn, firepit and hammocks, jetty and kayaks, piano, café radio, telescope, rooftop terrace and the town hall screen.
- `src/island-extras.tsx`: Mochi the cat, the daily seashells, rain and the rainbow.
- `src/use-fun.ts`, `src/music.ts`, `src/poses.ts`: fun activity state (radio, piano, fishing, shells, emotes, weather, break nudges), generated music, and how avatars sit, lie and paddle.
- `src/campus.tsx`: campus ground plan: plaza and fountain, building floors, furniture, screens, amphitheater, wellness garden, and boardwalk.
- `src/people.ts`: shared person model, demo coworker routines, the home/errand activity planner, and seat/target resolution.
- `src/work-props.tsx`: live desk monitor screens and the meeting whiteboard.
- `src/coworkers.tsx`: shared avatar body and the demo coworker's walking, idle animation, and reactions to you.
- `src/steering.ts`: smooth path following (corner rounding, ease in/out, gradual turning) shared by you and coworkers.
- `src/island-map.tsx`: the round mini-map (centred on you) and the full map (both islands, names, trails, people; click to walk, double-click to jump). Both move markers every frame without re-rendering React.
- `src/style.css`: responsive layout and visual styling.
- `tests/navigation.test.mjs`: boundary, obstacle, destination, and seating accessibility checks.

## Verification

```sh
npm test
npm run format:check
npm run build
```

The navigation tests use Node's built-in TypeScript support and need no installed dependencies. They verify collision boundaries, connections between every named location, access to every seat, and rejection of invalid destinations.

Verification: all fifteen shoreline, day-cycle, navigation, and sea-life tests and the production build (including TypeScript checking) passed. Tests cover exact fivefold area growth, fixed dock coastline, obstacle boundaries, every location and seat, clear district trails, map destinations, day-cycle continuity, and ten minutes of sea animal routes.

Browser checks cover district travel through the mini-map, live position updates, camera following while walking, desktop/mobile overview framing, and static tree rendering across camera modes. The atmosphere presets, water shader, motion pause/resume, decoration pointer passthrough, settings persistence, and mobile layout have also been checked. The audio engine was exercised; subjective sound quality was not assessed.

Google Fonts are optional; local sans-serif fallbacks work offline. The 3D scene requires WebGL. A rendering error displays a reload message.

## Next milestone

Add a Colyseus server with one shared island room, server-owned employee positions and statuses, interpolation for remote avatars, seat ownership, and reconnect handling. Then add authentication and persistent office workflows. Keep real attendance records separate from connection presence. Chat and isolated LiveKit voice rooms follow those foundations.
