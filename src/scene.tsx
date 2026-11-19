import { Cat, Dog, Rain, Rainbow, Shells, type Shell } from './island-extras';
import { FunSpots } from './fun';
import { WaterSports } from './water-sports';
import { StaticBatch } from './static-batch';
import { diveState, EMOTE_ICONS, playerControl, playerState, riders, seaState, type Emote } from './fun-state';
import { airLeft, stepSwim } from './dive';
import { DiveScene } from './dive-scene';
import { InteractionHints } from './interaction-hints';
import type { AutopilotCommand } from './use-autopilot';
import { PARASAIL_HEIGHT, riderPose, riderSpot, startRide, stepRide } from './rides';
import { seatPose, UPRIGHT } from './poses';
import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Label } from './label';
import * as THREE from 'three';
import { Waves } from 'lucide-react';
import {
  desks,
  findPath,
  locations,
  seats,
  trees,
  walkable,
  districts,
  WHITEBOARD,
  WHITEBOARD_FACING,
  WHITEBOARD_SPOT,
  type Point,
} from './world';
import { AtmosphereScene, type IslandTime, type Atmosphere } from './atmosphere';
import { IslandTerrain } from './terrain';
import { Campus, type News } from './campus';
import { periods, renderQuality } from './daylight';
import { Buildings } from './buildings';
import { cameraView, clampFocus, type ViewMode } from './camera-view';
import { islandKey } from './hosted';
import { movementAxes, pinchZoom, steerVector, touchSteer } from './touch';
import { currentTask, type DemoCoworker, type Target, type WorkState } from './people';
import { OVERVIEW_CENTER } from './shoreline';
import { groundHeight, HIGHLANDS_OVERVIEW, inHighlands, trailById, type Trail } from './highlands';
import { HighlandsScene } from './highlands-scene';
import { DeskScreen, Whiteboard } from './work-props';
import { AvatarBody, Coworker, DiveGear } from './coworkers';
import { stepAlongPath, turnToward } from './steering';
import { Box, Cylinder, Palm, Seat } from './scene-parts';
import { PlaceLabels } from './place-labels';
import type { Profile } from './profile';

// Parts of the scene that only change with their own props skip the scene's frequent re-renders.
const Atmosphere3D = React.memo(AtmosphereScene),
  CampusScene = React.memo(Campus),
  BuildingShells = React.memo(Buildings),
  WaterSportsScene = React.memo(WaterSports),
  Terrain = React.memo(IslandTerrain),
  Highlands3D = React.memo(HighlandsScene);
// The low end takes in the whole sea, both islands and every boat trip.
export const MIN_ZOOM = 4,
  MAX_ZOOM = 65;
// How far the camera tips over underwater (from straight down), to look along the seabed.
const DIVE_TILT = 1.34;
const occlusionRay = new THREE.Raycaster(),
  lookDir = new THREE.Vector3(),
  lookPoint = new THREE.Vector3();
// Glass and faded roofs don't count as hiding you.
const seeThrough = (object: THREE.Object3D) => {
  const material = (object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
  const m = Array.isArray(material) ? material[0] : material;
  return m && m.transparent ? m.opacity : 1;
};
const isInside = (object: THREE.Object3D, parent: THREE.Object3D) => {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (o === parent) return true;
  return false;
};
const viewCorners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ],
  viewNdc = new THREE.Vector2(),
  viewRay = new THREE.Raycaster(),
  viewHit = new THREE.Vector3(),
  groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
export function World({
  onPerson,
  profile,
  go,
  seat,
  setSeat,
  onPosition,
  reset,
  atmosphere,
  time,
  viewMode,
  onExplore,
  onFreeLook,
  coworkers,
  greeting,
  onPickSeat,
  occupied,
  work,
  shipped,
  news,
  radioOn,
  onRadio,
  onTelescope,
  shells,
  onShell,
  onPetCat,
  onPetDog,
  emote,
  raining,
  rainbow,
  onHike,
  walkRequest,
  hikeRequest,
  onNoRoute,
  autopilot,
  autopilotOn,
  onAutopilotArrive,
}: {
  news: News;
  radioOn: boolean;
  onRadio: () => void;
  onTelescope: () => void;
  shells: Shell[];
  onShell: (id: string) => void;
  onPetCat: () => void;
  onPetDog: () => void;
  emote: { kind: Emote; seq: number } | null;
  raining: boolean;
  rainbow: boolean;
  onHike: (trail: Trail) => void;
  // Requests from the map: walk to a point, or hike a trail.
  walkRequest: { point: Point; seq: number } | null;
  hikeRequest: { id: Trail['id']; seq: number } | null;
  onNoRoute: () => void;
  // Autopilot: where to go next, whether it's driving, and a callback once you get there.
  autopilot: AutopilotCommand | null;
  autopilotOn: boolean;
  onAutopilotArrive: () => void;
  coworkers: { person: DemoCoworker; target: Target | null }[];
  work: Record<string, WorkState>;
  shipped: Record<string, string>;
  greeting: { id: string; text: string } | null;
  onPickSeat: (id: string) => void;
  onPerson: (id: string) => void;
  occupied: ReadonlySet<string>;
  viewMode: ViewMode;
  onExplore: () => void;
  onFreeLook: () => void;
  profile: Profile;
  go: {
    point: Point;
    seq: number;
  } | null;
  seat: string | null;
  setSeat: (s: string | null) => void;
  onPosition: (p: Point) => void;
  reset: number;
  atmosphere: Atmosphere;
  time: IslandTime;
}) {
  const { size, camera, gl } = useThree();
  const night = THREE.MathUtils.lerp(periods[time.from].darkness, periods[time.to].darkness, time.progress);
  const freeFocus = useRef(new THREE.Vector3()),
    dragging = useRef(false),
    baseMode = useRef<'follow' | 'overview'>('follow');
  if (viewMode !== 'free') baseMode.current = viewMode;
  // Free look keeps the zoom framing of whichever mode it was entered from.
  const fitMode = viewMode === 'free' ? baseMode.current : viewMode;
  useEffect(() => {
    // Left-drag pans the camera; a short press is still a click (walk / sit).
    const el = gl.domElement,
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      ray = new THREE.Raycaster(),
      ndc = new THREE.Vector2();
    const ground = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      ndc.set(((x - r.left) / r.width) * 2 - 1, (-(y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(plane, new THREE.Vector3());
    };
    let press: { x: number; y: number; id: number } | null = null;
    const touchPoints = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    // Two fingers zoom. Orbit stays on one finger, and a short tap is still a click.
    const applyPinch = () => {
      if (touchPoints.size < 2) {
        pinch = 0;
        if (controls.current) controls.current.enableRotate = true;
        return;
      }
      const [a, b] = [...touchPoints.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (controls.current) controls.current.enableRotate = false;
      if (pinch > 0) cameraView.zoom = pinchZoom(cameraView.zoom, pinch, dist, MIN_ZOOM, MAX_ZOOM);
      pinch = dist;
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
        applyPinch();
      }
      // Left-drag pans with a mouse. Touch drags orbit instead, so a finger isn't also panning.
      if (e.button === 0 && e.pointerType !== 'touch') press = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && touchPoints.has(e.pointerId)) {
        touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touchPoints.size >= 2) {
          applyPinch();
          return;
        }
      }
      if (!press || e.pointerId !== press.id) return;
      if (!dragging.current) {
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6) return;
        dragging.current = true;
        if (controls.current) freeFocus.current.copy(controls.current.target);
        el.style.cursor = 'grabbing';
        onFreeLook();
      }
      const from = ground(press.x, press.y),
        to = ground(e.clientX, e.clientY);
      if (from && to) {
        const [x, z] = clampFocus(freeFocus.current.x + from.x - to.x, freeFocus.current.z + from.z - to.z);
        freeFocus.current.set(x, 0, z);
      }
      press.x = e.clientX;
      press.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (touchPoints.delete(e.pointerId)) applyPinch();
      if (press && e.pointerId === press.id) {
        press = null;
        if (dragging.current) el.style.cursor = '';
        dragging.current = false;
      }
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      if (controls.current) controls.current.enableRotate = true;
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [gl, camera, onFreeLook]);
  const findMe = useRef<THREE.Mesh>(null),
    findMeMaterial = useRef<THREE.MeshBasicMaterial>(null),
    hidden = useRef(false),
    occlusionCheck = useRef(0);
  const avatar = useRef<THREE.Group>(null),
    controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const cameraDelta = useRef(new THREE.Vector3()),
    desiredFocus = useRef(new THREE.Vector3()),
    lookPending = useRef(false);
  const mover = useRef({ speed: 0 });
  const pos = useRef(new THREE.Vector3(locations[0].point[0], 0, locations[0].point[1])),
    path = useRef<Point[]>([]),
    keys = useRef(new Set<string>()),
    walk = useRef(0),
    last = useRef(0);
  const [marker, setMarker] = useState<Point | null>(null);
  const pilotGoal = useRef<Target | null>(null);
  useEffect(() => {
    if (go) {
      setSeat(null);
      pos.current.set(...([go.point[0], 0, go.point[1]] as [number, number, number]));
      path.current = [];
      setMarker(null);
    }
  }, [go]);
  // Seats are solid. Sitting places you in the seat; standing up steps you out to its free side.
  const sittingIn = useRef<(typeof seats)[number] | null>(null);
  const motionOn = atmosphere.motion;
  const poseRef = useRef<THREE.Group>(null);
  const emoteState = useRef<{ kind: Emote; start: number }>({ kind: 'wave', start: -10 });
  const [bubble, setBubble] = useState<string | null>(null);
  useEffect(() => {
    if (!emote) return;
    emoteState.current = { kind: emote.kind, start: performance.now() / 1000 };
    setBubble(EMOTE_ICONS[emote.kind]);
    const t = window.setTimeout(() => setBubble(null), 2400);
    return () => window.clearTimeout(t);
  }, [emote]);
  const arrived = useRef<Point | null>(null);
  const rideY = useRef(0),
    snapZoom = useRef(true),
    reported = useRef<Point>([Infinity, Infinity]);
  // Diving: how far the camera has settled into its underwater framing, and the tilt to go back to.
  const immersion = useRef(0),
    washing = useRef(false),
    surfaceTilt = useRef(1),
    torch = useRef<THREE.PointLight>(null);
  const standUp = () => {
    const s = sittingIn.current;
    sittingIn.current = null;
    playerState.elevated = false;
    if (s?.ride) delete riders[s.id];
    rideY.current = 0;
    // Rides (out on the water or up the bluff) and rooftop seats always return you to their step-in spot.
    // The water taxi drops you on the far side when it arrives.
    const exit = arrived.current;
    arrived.current = null;
    if (exit) pos.current.set(exit[0], 0, exit[1]);
    else if (s && (s.ride || s.y || Math.hypot(pos.current.x - s.point[0], pos.current.z - s.point[1]) < 0.3))
      pos.current.set(s.approach[0], 0, s.approach[1]);
  };
  useEffect(() => {
    if (seat) {
      const s = seats.find(s => s.id === seat)!;
      // Switching straight from one ride to another leaves the first vehicle behind.
      if (sittingIn.current?.ride) delete riders[sittingIn.current.id];
      rideY.current = 0;
      sittingIn.current = s;
      playerState.elevated = !!s.y;
      if (s.ride) riders[s.id] = startRide(s, riders, seaState.sights);
      if (s.ride?.kind === 'scuba') {
        diveState.seen.clear();
        diveState.surface = false;
      }
      path.current = [];
      setMarker(null);
      pos.current.set(s.point[0], 0, s.point[1]);
      if (avatar.current) avatar.current.rotation.y = s.angle;
    } else standUp();
  }, [seat]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
        if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true],.modal')) return;
        if (!islandKey(e)) return;
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
          e.preventDefault();
          keys.current.add(e.key.toLowerCase());
        }
      },
      up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase()),
      clear = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);
  useEffect(() => {
    if (controls.current) {
      controls.current.reset();
    }
  }, [reset]);
  useEffect(() => {
    // A reset, resize or new view mode frames the island straight away rather than easing there.
    snapZoom.current = true;
  }, [reset, size.width, size.height, viewMode]);
  useFrame((state, dt) => {
    if (!avatar.current) return;
    dt = Math.min(dt, 0.05);
    const k = keys.current;
    let dx = 0,
      dz = 0;
    const sat = seat ? sittingIn.current : null;
    const view = sat?.ride ? riders[sat.id] : undefined;
    // Keys and the touch stick, relative to the camera. Holding either counts, even in the dead zone.
    const axes = movementAxes(k, touchSteer);
    const holding = k.size > 0 || touchSteer.active;
    let steer: Point | null = null;
    if (holding) {
      const ax = axes ?? { x: 0, z: 0 };
      steer = steerVector(ax.x, ax.z, controls.current?.getAzimuthalAngle() ?? Math.PI / 4);
    }
    // Diving: the movement keys take over from the guided tour and steer you, instead of ending the ride.
    const dive = sat && view?.kind === 'scuba' ? view : undefined;
    if (dive) {
      if (diveState.surface) dive.mode = 'return';
      else if (!dive.mode && steer && dive.y < -1) dive.mode = 'free';
      if (steer && viewMode !== 'follow') onExplore();
    }
    diveState.surface = false;
    if (sat && view && (!holding || dive)) {
      // Autopilot: follow the ride's path; the vehicle follows your entry in `riders`.
      const done = dive?.mode ? stepSwim(sat.ride!.launch, dive, steer, dt) : stepRide(sat, view, dt),
        [x, z] = riderSpot(sat, view);
      pos.current.set(x, 0, z);
      rideY.current = view.y;
      avatar.current.rotation.y = view.heading;
      if (done) {
        arrived.current = sat.ride?.exit ?? null;
        setSeat(null);
      }
    }
    // Going under and coming back up: the view changes behind a wash of bubbles.
    const depth = dive ? dive.y : 0,
      wasUnder = diveState.under;
    if (!wasUnder && depth < -1) {
      diveState.under = true;
      surfaceTilt.current = controls.current?.getPolarAngle() ?? 1;
    } else if (wasUnder && depth > -0.45) diveState.under = false;
    const wash = dive ? (diveState.under ? depth > -1 : depth < -0.45) : wasUnder;
    if (wash && !washing.current) diveState.onSplash();
    washing.current = wash;
    if (dive)
      Object.assign(diveState, {
        x: dive.x,
        y: dive.y,
        z: dive.z,
        air: airLeft(dive.t),
        free: dive.mode === 'free',
        returning: dive.mode === 'return',
      });
    immersion.current = THREE.MathUtils.damp(immersion.current, diveState.under ? 1 : 0, 3, dt);
    if (torch.current) torch.current.intensity = diveState.under ? 1 + night * 7 : 0;
    const walking = steer && !dive;
    if (walking) {
      if (viewMode !== 'follow') onExplore();
      if (seat) {
        standUp();
        setSeat(null);
      }
      path.current = [];
      setMarker(null);
      [dx, dz] = steer!;
    } else if (path.current.length) {
      const step = stepAlongPath(pos.current, path.current, mover.current, dt, 3);
      if (step) {
        dx = step.dx;
        dz = step.dz;
      }
      if (!path.current.length) setMarker(null);
    } else if (pilotGoal.current && !sat) {
      // Autopilot reached its spot: face the way the activity faces, then report back.
      const goal = pilotGoal.current;
      pilotGoal.current = null;
      if (!goal.seatId) avatar.current.rotation.y = goal.angle;
      latest.current.arrive();
    }
    if (walking) {
      const length = Math.hypot(dx, dz);
      dx = length > 0.03 ? (dx / length) * dt * 3 : 0;
      dz = length > 0.03 ? (dz / length) * dt * 3 : 0;
    }
    const moving = Math.hypot(dx, dz) > 1e-5;
    if (moving) {
      if (walkable(pos.current.x + dx, pos.current.z)) pos.current.x += dx;
      if (walkable(pos.current.x, pos.current.z + dz)) pos.current.z += dz;
      avatar.current.rotation.y = turnToward(avatar.current.rotation.y, Math.atan2(dx, dz), dt, 12);
      walk.current += dt * 12;
    }
    if (controls.current) {
      // Zoom eases toward what the UI asks for, fitted to the view; parasailing pulls the camera
      // back as you rise, to take in the whole island.
      const fit =
          fitMode === 'overview'
            ? Math.min(16, size.width / 104, size.height / 80)
            : Math.min(36, size.width / 20, size.height / 17),
        lift = sat?.ride?.kind === 'parasail' ? Math.min(1, rideY.current / PARASAIL_HEIGHT) : 0,
        view = controls.current.object,
        // However far out you zoom, the view stops at the whole sea: there's nothing beyond it.
        widest = Math.min(size.width / 330, size.height / 200),
        wantZoom = Math.max(widest, ((fit * cameraView.zoom) / 30) * (1 - 0.5 * lift) * (1 + 0.7 * immersion.current));
      if (Math.abs(view.zoom - wantZoom) > wantZoom * 1e-4) {
        view.zoom = snapZoom.current ? wantZoom : THREE.MathUtils.damp(view.zoom, wantZoom, lift ? 3 : 10, dt);
        view.updateProjectionMatrix();
      }
      snapZoom.current = false;
      const target = controls.current.target;
      if (cameraView.look) {
        const [x, z] = clampFocus(...cameraView.look);
        freeFocus.current.set(x, 0, z);
        cameraView.look = null;
        lookPending.current = true;
      }
      const free = viewMode === 'free' || dragging.current || lookPending.current;
      if (viewMode === 'free') lookPending.current = false;
      if (free) desiredFocus.current.copy(freeFocus.current);
      else if (viewMode === 'follow')
        desiredFocus.current
          .copy(pos.current)
          .setY(rideY.current ? rideY.current * 0.8 : groundHeight(pos.current.x, pos.current.z));
      // The overview frames whichever island you're on.
      else
        desiredFocus.current.set(...(inHighlands(pos.current.x, pos.current.z) ? HIGHLANDS_OVERVIEW : OVERVIEW_CENTER));
      cameraDelta.current
        .copy(desiredFocus.current)
        .sub(target)
        .multiplyScalar(1 - Math.exp(-dt * (dragging.current ? 30 : 5)));
      target.add(cameraDelta.current);
      controls.current.object.position.add(cameraDelta.current);
      // Orthographic rays must start above all visible ground, including tall portrait views and zoomed-out follow views.
      const reach = (size.height / controls.current.object.zoom) * 1.5;
      const distance = viewMode !== 'follow' ? Math.max(100, reach) : Math.max(44, reach);
      cameraDelta.current.copy(controls.current.object.position).sub(target).setLength(distance);
      controls.current.object.position.copy(target).add(cameraDelta.current);
      // Underwater the camera drops to look along the seabed, and cuts away whatever is in front of you.
      const sunk = immersion.current > 0.002,
        tilt = THREE.MathUtils.lerp(surfaceTilt.current, DIVE_TILT, immersion.current);
      controls.current.minPolarAngle = sunk ? tilt : 0.3;
      controls.current.maxPolarAngle = sunk ? tilt : Math.PI / 2.7;
      const near = diveState.under ? distance - 16 : 0.1;
      if (camera.near !== near) {
        camera.near = near;
        camera.updateProjectionMatrix();
      }
      controls.current.update();
      cameraView.focus = [target.x, target.z];
      cameraView.corners = viewCorners.map(([x, y]) => {
        viewNdc.set(x, y);
        viewRay.setFromCamera(viewNdc, camera);
        const hit = viewRay.ray.intersectPlane(groundPlane, viewHit);
        return hit ? ([hit.x, hit.z] as Point) : cameraView.focus;
      });
    }
    avatar.current.position.copy(pos.current);
    Object.assign(playerState, {
      x: pos.current.x,
      z: pos.current.z,
      heading: avatar.current.rotation.y,
      route: path.current,
    });
    const now = performance.now() / 1000,
      rider = sat?.ride && riderPose(sat.ride.kind, now, -rideY.current),
      pose = rider
        ? { ...rider, y: rideY.current + rider.y }
        : sat
          ? seatPose(sat.kind, sat.y ?? 0, motionOn ? now : 0)
          : UPRIGHT;
    // Emotes: a short hop, spin or cheer.
    const e = emoteState.current,
      age = now - e.start,
      active = age < 2.4 && !sat;
    const lift = !active
      ? 0
      : e.kind === 'dance'
        ? Math.abs(Math.sin(age * 8)) * 0.12
        : e.kind === 'cheer'
          ? Math.max(0, Math.sin(age * 7)) * 0.35
          : e.kind === 'highfive'
            ? Math.max(0, Math.sin(age * 4)) * 0.25
            : Math.max(0, Math.sin(age * 6)) * 0.15 * (age < 1 ? 1 : 0);
    // Standing on the ground (hills, bridges) or riding at the ride's own height.
    const floor = sat?.ride ? 0 : groundHeight(pos.current.x, pos.current.z);
    avatar.current.position.y = floor + (sat ? pose.y : (moving ? Math.sin(walk.current) * 0.045 : 0) + lift);
    if (poseRef.current) {
      poseRef.current.rotation.x = pose.pitch;
      poseRef.current.position.z = pose.z;
      poseRef.current.rotation.y = pose.roll + (active && e.kind === 'dance' ? age * 9 : 0);
      poseRef.current.rotation.z = active && e.kind === 'highfive' ? Math.sin(age * 4) * 0.2 : 0;
    }
    // A few times a second, check whether anything sits between the camera and you.
    occlusionCheck.current -= dt;
    if (occlusionCheck.current <= 0) {
      occlusionCheck.current = 0.2;
      state.camera.getWorldDirection(lookDir);
      hidden.current = [0.6, 1.2].some(height => {
        lookPoint.set(pos.current.x, avatar.current!.position.y + height, pos.current.z);
        occlusionRay.set(lookPoint.clone().addScaledVector(lookDir, -60), lookDir);
        occlusionRay.far = 59.7;
        return occlusionRay
          .intersectObjects(state.scene.children, true)
          .some(hit => hit.object.visible && !isInside(hit.object, avatar.current!) && seeThrough(hit.object) > 0.5);
      });
    }
    if (findMe.current && findMeMaterial.current) {
      const want = hidden.current || (controls.current?.object.zoom ?? 30) < 14 ? 0.85 : 0;
      findMeMaterial.current.opacity = THREE.MathUtils.damp(findMeMaterial.current.opacity, want, 8, dt);
      findMe.current.visible = findMeMaterial.current.opacity > 0.02;
      findMe.current.position.set(pos.current.x, floor + 0.14, pos.current.z);
      findMe.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.06);
    }
    // Report where you are a few times a second, but only when you've moved (each report re-renders the app).
    if (state.clock.elapsedTime - last.current > 0.4) {
      last.current = state.clock.elapsedTime;
      if (Math.hypot(pos.current.x - reported.current[0], pos.current.z - reported.current[1]) > 0.05) {
        reported.current = [pos.current.x, pos.current.z];
        onPosition(reported.current);
      }
    }
  });
  // Stable handlers for the memoized scenery, always calling the latest version.
  const latest = useRef({
    walkTo: (_: Point) => {},
    onPickSeat,
    hike: (_: Trail['id']) => {},
    arrive: onAutopilotArrive,
  });
  const hike = React.useCallback((id: Trail['id']) => latest.current.hike(id), []);
  const pickSeat = React.useCallback((id: string) => latest.current.onPickSeat(id), []);
  const walkOnGround = React.useCallback((target: Point, delta: number) => {
    if (delta < 6) latest.current.walkTo(target);
  }, []);
  const walkTo = (target: Point) => {
    onExplore();
    if (seat) standUp();
    const route = findPath([pos.current.x, pos.current.z], target);
    if (route.length) {
      setSeat(null);
      path.current = route;
      setMarker(target);
    }
    return route.length > 0;
  };
  // Autopilot hike: walk to the start of the trail, then follow it to the end (any key stops).
  const startHike = (id: Trail['id']) => {
    const trail = trailById(id),
      here: Point = [pos.current.x, pos.current.z],
      lead = findPath(here, trail.points[0]);
    if (!lead.length && Math.hypot(here[0] - trail.points[0][0], here[1] - trail.points[0][1]) > 1) return;
    onExplore();
    if (seat) standUp();
    setSeat(null);
    path.current = [...lead, ...trail.points.slice(1)];
    setMarker(trail.points[trail.points.length - 1]);
    onHike(trail);
  };
  latest.current = { walkTo, onPickSeat, hike: startHike, arrive: onAutopilotArrive };
  // Autopilot heads to its next spot: the start of a trail (then along it), or a seat's step-in point.
  useEffect(() => {
    if (!autopilot) return;
    const goal = autopilot.target;
    pilotGoal.current = goal;
    // Stand up first: routes start from the seat's step-in spot, not from inside the seat.
    if (seat) {
      standUp();
      setSeat(null);
    }
    if (goal.route && goal.activity.trail) {
      startHike(goal.activity.trail);
      return;
    }
    const here: Point = [pos.current.x, pos.current.z];
    path.current =
      Math.hypot(here[0] - goal.approach[0], here[1] - goal.approach[1]) > 0.3 ? findPath(here, goal.approach) : [];
    setMarker(path.current.length ? goal.approach : null);
  }, [autopilot]);
  playerControl.halt = () => {
    pilotGoal.current = null;
    path.current = [];
    setMarker(null);
  };
  useEffect(() => {
    if (walkRequest && !walkTo(walkRequest.point)) onNoRoute();
  }, [walkRequest]);
  useEffect(() => {
    if (hikeRequest) startHike(hikeRequest.id);
  }, [hikeRequest]);
  return (
    <>
      <Atmosphere3D settings={atmosphere} time={time} rain={raining} />
      <Terrain onWalk={walkOnGround} />
      <FunSpots
        playerSeat={seat}
        radioOn={radioOn}
        onRadio={onRadio}
        onTelescope={onTelescope}
        period={time.period}
        night={night}
        motion={motionOn}
      />
      <WaterSportsScene motion={motionOn} />
      <DiveScene motion={motionOn} night={night} />
      <InteractionHints
        seat={seat}
        onUse={spot =>
          spot.id === 'radio' ? onRadio() : spot.id === 'telescope' ? onTelescope() : onPickSeat(spot.id)
        }
      />
      <Highlands3D
        onWalk={walkOnGround}
        onHike={hike}
        player={pos}
        night={night}
        period={time.period}
        motion={motionOn}
      />
      <Cat player={pos} motion={motionOn} onPet={onPetCat} />
      <Dog player={pos} motion={motionOn} onPet={onPetDog} />
      <Shells shells={shells} player={pos} onCollect={onShell} onWalk={walkTo} />
      <Rain raining={raining} motion={motionOn} />
      <Rainbow visible={rainbow} />
      <StaticBatch name="campus-batch">
        <CampusScene news={news} night={night} />
      </StaticBatch>
      <BuildingShells player={pos} night={night} />
      <Scenery onPickSeat={pickSeat} />
      {coworkers.map(({ person, target }) => (
        <Coworker
          key={person.id}
          person={person}
          target={target}
          greeting={greeting?.id === person.id ? greeting.text : null}
          player={pos}
          motion={atmosphere.motion}
          task={
            target?.activity.work
              ? {
                  ...currentTask(person, work[person.id]),
                  progress: person.simulated === false ? undefined : work[person.id].progress,
                }
              : null
          }
          shipped={shipped[person.id] ?? null}
          onClick={onPerson}
        />
      ))}
      {coworkers.map(({ person, target }) => {
        const desk = target?.activity.work ? desks.find(d => d.id === target.seatId) : undefined;
        return (
          desk &&
          target && (
            <DeskScreen
              key={`screen-${person.id}`}
              desk={desk}
              seat={target.point}
              work={{
                personId: person.id,
                craft: person.craft,
                progress: person.simulated === false ? 0.5 : work[person.id].progress,
                celebrating: !!shipped[person.id],
              }}
            />
          )
        );
      })}
      <Whiteboard
        position={WHITEBOARD}
        face={WHITEBOARD_FACING}
        spot={WHITEBOARD_SPOT}
        active={coworkers.some(c => c.target?.activity.place === 'Pavilion M')}
      />
      <PlaceLabels
        raised={fitMode === 'overview'}
        quiet={!!seat || autopilotOn}
        occupied={occupied}
        onUse={spot =>
          spot.id === 'radio' ? onRadio() : spot.id === 'telescope' ? onTelescope() : onPickSeat(spot.id)
        }
      />
      {marker && (
        <mesh position={[marker[0], groundHeight(...marker) + 0.22, marker[1]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.24, 24]} />
          <meshBasicMaterial color="#fffce8" />
        </mesh>
      )}
      {/* Always-visible ring under you, shown while you're hidden behind something or zoomed far out. */}
      <mesh ref={findMe} rotation={[-Math.PI / 2, 0, 0]} renderOrder={30} raycast={() => null}>
        <ringGeometry args={[0.36, 0.5, 48]} />
        <meshBasicMaterial
          ref={findMeMaterial}
          color={profile.color}
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      <group ref={avatar} name="player-avatar">
        <group ref={poseRef}>
          <AvatarBody
            color={profile.color}
            hair={profile.hair}
            hairStyle={profile.hairStyle}
            skin={profile.skin}
            bottoms={profile.bottoms}
            xray={0.55}
          />
          {seats.find(s => s.id === seat)?.ride?.kind === 'scuba' && <DiveGear />}
        </group>
        <pointLight ref={torch} position={[0, 0.6, 0.4]} intensity={0} distance={11} decay={1.4} color="#fff1cf" />
        {bubble && (
          <Label position={[0, 2.45, 0]} zIndex={21}>
            <div className="emote-bubble">{bubble}</div>
          </Label>
        )}
        <Label position={[0, 1.85, 0]} zIndex={20}>
          <div className="avatar-label">
            <em style={{ background: profile.color }}>{profile.name.trim()[0]?.toUpperCase()}</em>
            {profile.name} <span>{autopilotOn ? '🤖 autopilot' : 'you'}</span>
          </div>
        </Label>
      </group>
      {renderQuality(atmosphere.quality).contactShadows && (
        <ContactShadows position={[0, 0.02, 0]} opacity={0.18} scale={35} blur={2} far={8} />
      )}
      <OrbitControls
        ref={controls}
        makeDefault
        target={[locations[0].point[0], 0, locations[0].point[1]]}
        minZoom={2}
        maxZoom={75}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2.7}
        enablePan={false}
        enableZoom={false}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        mouseButtons={{ LEFT: undefined, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.ROTATE }}
      />
    </>
  );
}
// Static scenery (desks, seats, palms, the pier): memoized so the scene's frequent re-renders skip it.
const Scenery = React.memo(function Scenery({ onPickSeat }: { onPickSeat: (id: string) => void }) {
  return (
    <StaticBatch name="scenery">
      {desks.map((d, i) => (
        <group key={d.id} position={[d.x, 0, d.z]}>
          <Box p={[0, 0.85, 0]} s={[1.35, 0.12, 0.8]} c="#e6cda8" />
          {[-0.5, 0.5].map(x => (
            <Box key={x} p={[x, 0.43, 0]} s={[0.07, 0.8, 0.6]} c="#7d8271" />
          ))}
          <Box p={[0, 1.17, -0.1]} s={[0.55, 0.35, 0.05]} c="#485f5b" />
          <Box p={[0, 0.96, 0]} s={[0.08, 0.15, 0.08]} c="#485f5b" />
          <Box p={[0, 0.93, 0.18]} s={[0.4, 0.025, 0.15]} c="#ece9da" />
          <Cylinder p={[0.46, 0.99, 0]} r={0.09} h={0.18} c={i % 2 ? '#c17c5e' : '#8b9d7b'} />
        </group>
      ))}
      {seats.map(s => (
        <Seat key={s.id} seat={s} onSelect={onPickSeat} />
      ))}
      {trees.map(([x, z], i) => (
        <Palm key={i} x={x} z={z} i={i} />
      ))}
      <Box p={[0, -0.03, 13.95]} s={[2, 0.2, 3]} c="#b39a78" />
      {Array.from({ length: 9 }, (_, i) => (
        <Box key={i} p={[0, 0.08, 12.65 + i * 0.3]} s={[2.05, 0.04, 0.22]} c="#d5ba92" />
      ))}
    </StaticBatch>
  );
});
export class SceneBoundary extends React.Component<
  {
    children: React.ReactNode;
  },
  {
    failed: boolean;
  }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-error">
        <Waves size={40} />
        <h2>The island couldn’t load</h2>
        <p>Try a browser with WebGL enabled, then reload.</p>
        <button onClick={() => window.location.reload()}>Reload island</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
