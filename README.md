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

- Click the ground to walk around obstacles.
- Use WASD or arrow keys to move relative to the camera.
- Right-drag to orbit; use the on-screen + / − buttons to zoom.
- Click a chair to sit; walk or select **Stand up** to leave.
- Select a location in the sidebar to teleport there.
- Check in or out, change availability, and edit your name and avatar color.
- Open the people tab to view your local presence.
- Open the sliders button at the top right of the island for real-time lighting, manual day periods, gentle motion, and optional ocean audio.
- Night adds warm studio lighting and campfire glow. Audio has a volume control and pauses when the tab is hidden. It starts muted on every visit.
- Follow real time is on by default and uses your device timezone: Dawn (5–7 am), Morning (7–11 am), Midday (11 am–3 pm), Golden hour (3–6 pm), Dusk (6–8 pm), Night (8 pm–5 am). These are fixed local windows, independent of season or location. Lighting, water, shadows, lamps, and stars blend between period centers, including across midnight.
- Select any period to hold it manually; turn Follow real time back on to resume. The island chip always shows the current local clock, with a Manual badge when overridden.
- Palms sway with gentle gusts, clouds drift with soft ground shadows, and fireflies glow around the quiet garden from dusk into night. Cloud colors and firefly visibility follow the day cycle.
- Motion defaults off when your device requests reduced motion; you can change it in island settings. Turning it off freezes palm sway, clouds, and firefly movement and pulsing in place; static evening glows remain visible.

Check-in, name, color, status, and atmosphere preferences persist in browser localStorage. This is a local prototype, with no authentication, shared presence, attendance backend, chat, microphone capture, or voice calls. The meeting areas are scenery for this milestone.

## Project structure

- `src/main.tsx`: application interface, scene, avatar controller, and interactions.
- `src/island-life.tsx`: drifting clouds, soft cloud shadows, and evening fireflies.
- `src/daylight.ts`: local time mapping, continuous day-cycle sampling, and saved-settings migration.
- `src/atmosphere.tsx`: lighting presets, animated water ripples, atmosphere controls, and synthesized ocean audio.
- `src/world.ts`: locations, furniture, collision rules, and grid navigation.
- `src/style.css`: responsive layout and visual styling.
- `tests/navigation.test.mjs`: boundary, obstacle, destination, and seating accessibility checks.

## Verification

```sh
npm test
npm run build
```

The navigation tests use Node's built-in TypeScript support and need no installed dependencies. They verify collision boundaries, connections between every named location, access to every seat, and rejection of invalid destinations.

Verification: all seven day-cycle and navigation tests and the production build (including TypeScript checking) passed. Fixed oversized location labels caused by distance scaling with the orthographic camera. Atmosphere controls, all six day periods and real-time mode, audio play/mute, keyboard volume control, preference persistence, and mobile dialog layout were verified in the Orca browser. Palm/cloud/firefly animation, pause/resume, daytime firefly visibility, and decoration pointer passthrough were also checked in the browser. The audio engine was exercised; subjective sound quality was not assessed.

Google Fonts are optional; local sans-serif fallbacks work offline. The 3D scene requires WebGL. A rendering error displays a reload message.

## Next milestone

Add a Colyseus server with one shared island room, server-owned employee positions and statuses, interpolation for remote avatars, seat ownership, and reconnect handling. Then add authentication and persistent office workflows. Keep real attendance records separate from connection presence. Chat and isolated LiveKit voice rooms follow those foundations.
