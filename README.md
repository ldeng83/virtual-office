# Atoll — Island office

A desktop-first, single-player prototype of a browser-based 3D office for a team of ten. Built with React, TypeScript, React Three Fiber, Drei, Three.js, and Vite. All scenery is generated from geometry; no external 3D models are needed.

## Run

Use Node.js 24 LTS and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Production build: `npm run build`. Preview the build: `npm run preview`.

## Explore

- Click the ground to walk around obstacles. The island is a compact office park on the water: an arrival pier and glass lobby on the south shore, a central plaza with a fountain and team-news screen, a main workspace with 14 desks in Design and Engineering areas around a planted atrium, Pavilions S, M and L (2, 6 and 12 seats), a focus library with six booths, a café with a sea-view terrace, a town hall amphitheater, a wellness garden with a walking loop around the pond, a boardwalk with loungers on the east beach, and a marked future plot. Buildings have a solid base, a glass window band and roofs (a green roof on the workspace); the lobby and pavilions are glass between timber posts with translucent roofs. Walls block walking, so enter through the doorways where the walkways arrive. When you step inside, or pan the camera onto a building, its roof fades away and the camera-facing walls turn see-through, so you can see the people at their desks. Name boards mark each entrance, and the plaza screen shows the clock and the latest team news. Sitting in a library booth switches your status to Focused; standing up restores it.
- Use WASD or arrow keys to move relative to the camera.
- The camera follows your avatar by default. Choose **Island overview** to see the full island, or **Follow me** to return. Right-drag to orbit; use the on-screen + / − buttons to zoom. Reset view restores the camera orientation and zoom for the selected mode.
- Click a chair to sit; walk or select **Stand up** to leave.
- Select any of nine places in the scrollable sidebar to travel there. The collapsible mini-map shows your position, walkways, building footprints, the pond, and place markers; select a marker to travel there. Travelling or starting to walk restores Follow me.
- Check in or out, change availability, and edit your name and avatar color.
- You never lose yourself behind scenery: when trees, roofs, or canopies cover your avatar, a tinted silhouette shows through them, and a soft ring in your color pulses at your feet (also shown when zoomed far out). Coworkers get a fainter silhouette. Scenery itself never fades or changes.
- Open the people tab to view your local presence and the two demo coworkers, Maya and Theo. Each part of the island's day gives them a home activity (desk, Pavilion M, library booth, boardwalk) plus short errands such as café coffee runs, garden laps, whiteboard sketching, and 1:1s in Pavilion S that a small planner picks every 15–50 seconds. They walk between places, sit in seats you then can't take, breathe, look around, type, nod in meetings, show an activity icon, turn to look at you when you come near, wave if they're available, and appear on the mini-map. Walk near one to say hi, or use the locate button in the people tab to look at them. Each has a small task backlog: time at a work spot fills a progress bar on their name tag, their desk monitor glows and shows live code or growing wireframes, the meeting-grove whiteboard fills with boxes and sticky notes while Theo sketches, and finishing a task pops a “✅ Shipped” bubble. Walk close to see their current task card. The Activity tab is a team feed of arrivals, meetings, coffee breaks, and shipped tasks; select an entry to look at that person. Turn them off in profile settings. They use the same person model that real coworkers will use once shared presence arrives.
- Walkways run from the plaza to every zone. The fountain, furniture, booth panels, trees and the pond block walking. Palms ring the coast and a few shade trees stand on the lawns; all trees use fixed geometry and never change detail or visibility.
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

- `src/main.tsx`: application interface, scene, avatar controller, and interactions.
- `src/sea-life.tsx`: geometry-based sea animals and species-specific animation.
- `src/sea-life-motion.ts`: offshore routes, dolphin leaps, and crab behavior.
- `src/ocean.tsx`: procedural water gradient, displaced swells, caustics, shoreline foam, and sun/moon highlights in a single shader surface.
- `src/island-life.tsx`: drifting clouds, soft cloud shadows, and evening fireflies.
- `src/daylight.ts`: local time mapping, continuous day-cycle sampling, and saved-settings migration.
- `src/atmosphere.tsx`: lighting presets, atmosphere controls, and synthesized ocean audio.
- `src/shoreline.ts`: shared coastal contour for terrain, collision, ocean effects, and animal routes.
- `src/terrain.tsx`: shaped sand and grass terrain plus click-to-walk surface.
- `src/world.ts`: campus layout (building pads, furniture, seats, walkways, places), collision rules, and A* navigation (8 directions, no corner cutting) with cached grid checks, straightened into clean lines by line-of-sight smoothing.
- `src/buildings.tsx`: building and pavilion shells (walls between doorways, glass, roofs) that open up when you're inside.
- `src/campus.tsx`: campus ground plan: plaza and fountain, building floors, furniture, screens, amphitheater, wellness garden, and boardwalk.
- `src/people.ts`: shared person model, demo coworker routines, the home/errand activity planner, and seat/target resolution.
- `src/work-props.tsx`: live desk monitor screens and the meeting whiteboard.
- `src/coworkers.tsx`: shared avatar body and the demo coworker's walking, idle animation, and reactions to you.
- `src/steering.ts`: smooth path following (corner rounding, ease in/out, gradual turning) shared by you and coworkers.
- `src/island-map.tsx`: collapsible mini-map with walkways, building footprints, position marker, and place travel.
- `src/style.css`: responsive layout and visual styling.
- `tests/navigation.test.mjs`: boundary, obstacle, destination, and seating accessibility checks.

## Verification

```sh
npm test
npm run build
```

The navigation tests use Node's built-in TypeScript support and need no installed dependencies. They verify collision boundaries, connections between every named location, access to every seat, and rejection of invalid destinations.

Verification: all fifteen shoreline, day-cycle, navigation, and sea-life tests and the production build (including TypeScript checking) passed. Tests cover exact fivefold area growth, fixed dock coastline, obstacle boundaries, every location and seat, clear district trails, map destinations, day-cycle continuity, and ten minutes of sea animal routes.

Browser checks cover district travel through the mini-map, live position updates, camera following while walking, desktop/mobile overview framing, and static tree rendering across camera modes. The atmosphere presets, water shader, motion pause/resume, decoration pointer passthrough, settings persistence, and mobile layout have also been checked. The audio engine was exercised; subjective sound quality was not assessed.

Google Fonts are optional; local sans-serif fallbacks work offline. The 3D scene requires WebGL. A rendering error displays a reload message.

## Next milestone

Add a Colyseus server with one shared island room, server-owned employee positions and statuses, interpolation for remote avatars, seat ownership, and reconnect handling. Then add authentication and persistent office workflows. Keep real attendance records separate from connection presence. Chat and isolated LiveKit voice rooms follow those foundations.
