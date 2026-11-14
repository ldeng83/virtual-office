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

- Click the ground to walk around obstacles. Explore five districts: the original office village, quiet forest with a pond and focus benches, social beach with gathering seats and a hammock, flower garden peninsula with a coastal lookout, and a rocky wild coast. The island has five times the land area of the previous expanded layout; the studio and southern dock keep their positions.
- Use WASD or arrow keys to move relative to the camera.
- The camera follows your avatar by default. Choose **Island overview** to see the full island, or **Follow me** to return. Right-drag to orbit; use the on-screen + / − buttons to zoom. Reset view restores the camera orientation and zoom for the selected mode.
- Click a chair to sit; walk or select **Stand up** to leave.
- Select any of nine locations in the scrollable sidebar to travel there. The collapsible mini-map shows your position, trails, pond, and district markers; select a district marker to travel there. Travelling or starting to walk restores Follow me.
- Check in or out, change availability, and edit your name and avatar color.
- Open the people tab to view your local presence and the two demo coworkers, Maya and Theo. They follow a daily routine tied to the island's time of day (desk, meetings, focus spots, campfire, beach), walk between places, sit in seats you then can't take, and appear on the mini-map. Walk near one to say hi, or use the locate button in the people tab to look at them. Turn them off in profile settings. They use the same person model that real coworkers will use once shared presence arrives.
- Main trails connect every district. Ponds, rocks, trees, and campfires block walking. All trees use fixed geometry and opaque foliage: walking, camera movement, and zoom never switch their detail or visibility. Trees remain still even when Gentle motion is enabled.
- Open the sliders button at the top right of the island for real-time lighting, manual day periods, gentle motion, and optional ocean audio.
- Night adds warm studio lighting and campfire glow. Audio has a volume control and pauses when the tab is hidden. It starts muted on every visit.
- Follow real time is on by default and uses your device timezone: Dawn (5–7 am), Morning (7–11 am), Midday (11 am–3 pm), Golden hour (3–6 pm), Dusk (6–8 pm), Night (8 pm–5 am). These are fixed local windows, independent of season or location. Lighting, water, shadows, lamps, and stars blend between period centers, including across midnight.
- Select any period to hold it manually; turn Follow real time back on to resume. The island chip always shows the current local clock, with a Manual badge when overridden.
- The ocean blends turquoise shallows into deeper blue water, with crossing surface swells, broken shoreline foam, moving light patterns in the shallows, and sparse glints. Broad highlights respond to the sun or moon direction; underwater light patterns soften at night. Water colors follow all six day periods, with warmer highlights at sunset and cooler glints at night.
- Sea life includes two surfacing turtles, three schools of seven fish, two dolphins with staggered leaps, two gliding manta rays, and three beach crabs that scuttle, pause, and hide in the sand. Animals stay in localized habitats: turtles and fish near the dock, rays along the right-hand shallows, dolphins farther offshore to the left, and crabs on the front-right beach. Their small oval routes leave open stretches of ocean; crabs stay clear of the dock. Translucent water reveals underwater animals.
- Palms and forest trees stay static, clouds drift with soft ground shadows, and fireflies glow around the quiet garden from dusk into night. Cloud colors and firefly visibility follow the day cycle.
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
- `src/world.ts`: districts, trails, furniture, collision rules, and A* navigation with cached grid checks.
- `src/districts.tsx`: static forest trees, pond, beach gathering area, flower beds, lookout, and rocky coast.
- `src/people.ts`: shared person model, demo coworker routines, and seat/target resolution.
- `src/coworkers.tsx`: shared avatar body and the walking, seated demo coworker.
- `src/island-map.tsx`: collapsible mini-map, position marker, and district travel.
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
