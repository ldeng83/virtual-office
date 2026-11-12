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

Check-in, name, color, and status persist in browser localStorage. This is a local prototype, with no authentication, shared presence, attendance backend, chat, microphone capture, or voice calls. The meeting areas are scenery for this milestone.

## Project structure

- `src/main.tsx`: application interface, scene, avatar controller, and interactions.
- `src/world.ts`: locations, furniture, collision rules, and grid navigation.
- `src/style.css`: responsive layout and visual styling.
- `tests/navigation.test.mjs`: boundary, obstacle, destination, and seating accessibility checks.

## Verification

```sh
npm test
npm run build
```

The navigation tests use Node's built-in TypeScript support and need no installed dependencies. They verify collision boundaries, connections between every named location, access to every seat, and rejection of invalid destinations.

Verification: all four navigation tests and the production build (including TypeScript checking) passed. Fixed oversized location labels caused by distance scaling with the orthographic camera. Visual browser verification remains blocked because the sandbox cannot access the Orca browser runtime.

Google Fonts are optional; local sans-serif fallbacks work offline. The 3D scene requires WebGL. A rendering error displays a reload message.

## Next milestone

Add a Colyseus server with one shared island room, server-owned employee positions and statuses, interpolation for remote avatars, seat ownership, and reconnect handling. Then add authentication and persistent office workflows. Keep real attendance records separate from connection presence. Chat and isolated LiveKit voice rooms follow those foundations.
