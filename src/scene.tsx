import { Cat, Rain, Rainbow, Shells, type Shell } from './island-extras';
import { FunSpots } from './fun';
import { EMOTE_ICONS, kayakRide, playerState, type Emote } from './fun-state';
import { seatPose, UPRIGHT } from './poses';
import { ISLAND_CENTER_Z, ISLAND_X_SCALE, shorePoint } from './shoreline';
import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Label } from './label';
import * as THREE from 'three';
import { Waves } from 'lucide-react';
import {
  desks,
  findPath,
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
import { periods } from './daylight';
import { Buildings } from './buildings';
import { cameraView, clampFocus, type ViewMode } from './camera-view';
import { currentTask, type DemoCoworker, type Target, type WorkState } from './people';
import { OVERVIEW_CENTER } from './shoreline';
import { DeskScreen, Whiteboard } from './work-props';
import { AvatarBody, Coworker } from './coworkers';
import { stepAlongPath, turnToward } from './steering';
import { Box, Cylinder, Palm, Seat, ZoneLabel } from './scene-parts';
import type { Profile } from './profile';

export const MIN_ZOOM = 10,
  MAX_ZOOM = 65;
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
  profile,
  go,
  seat,
  setSeat,
  onPosition,
  zoom,
  reset,
  atmosphere,
  time,
  viewMode,
  onExplore,
  onFreeLook,
  coworkers,
  greeting,
  onPickSeat,
  work,
  shipped,
  news,
  radioOn,
  onRadio,
  onTelescope,
  shells,
  onShell,
  onPetCat,
  emote,
  raining,
  rainbow,
}: {
  news: News;
  radioOn: boolean;
  onRadio: () => void;
  onTelescope: () => void;
  shells: Shell[];
  onShell: (id: string) => void;
  onPetCat: () => void;
  emote: { kind: Emote; seq: number } | null;
  raining: boolean;
  rainbow: boolean;
  coworkers: { person: DemoCoworker; target: Target | null }[];
  work: Record<string, WorkState>;
  shipped: Record<string, string>;
  greeting: { id: string; text: string } | null;
  onPickSeat: (id: string) => void;
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
  zoom: number;
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
    const down = (e: PointerEvent) => {
      if (e.button === 0 && e.pointerType !== 'touch') press = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const move = (e: PointerEvent) => {
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
  const pos = useRef(new THREE.Vector3(0, 0, 7)),
    path = useRef<Point[]>([]),
    keys = useRef(new Set<string>()),
    walk = useRef(0),
    last = useRef(0);
  const [marker, setMarker] = useState<Point | null>(null);
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
  const ride = useRef({ angle: 0, travelled: 0, from: [0, 0] as Point });
  const standUp = () => {
    const s = sittingIn.current;
    sittingIn.current = null;
    playerState.elevated = false;
    kayakRide.index = -1;
    // Kayaks (out on the water) and rooftop seats always return you to their step-in spot.
    if (s && (s.kind === 'kayak' || s.y || Math.hypot(pos.current.x - s.point[0], pos.current.z - s.point[1]) < 0.3))
      pos.current.set(s.approach[0], 0, s.approach[1]);
  };
  useEffect(() => {
    if (seat) {
      const s = seats.find(s => s.id === seat)!;
      sittingIn.current = s;
      playerState.elevated = !!s.y;
      if (s.kind === 'kayak') {
        // Paddle a loop around the island, starting from the jetty.
        ride.current = {
          angle: Math.atan2(s.point[1] - ISLAND_CENTER_Z, s.point[0] / ISLAND_X_SCALE),
          travelled: 0,
          from: s.point,
        };
        kayakRide.index = Number(s.id.split('-')[1]);
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
    if (controls.current) {
      const fit =
        fitMode === 'overview'
          ? Math.min(16, size.width / 88, size.height / 68)
          : Math.min(36, size.width / 20, size.height / 17);
      controls.current.object.zoom = (fit * zoom) / 30;
      controls.current.object.updateProjectionMatrix();
    }
  }, [zoom, reset, size.width, size.height, viewMode]);
  useFrame((state, dt) => {
    if (!avatar.current) return;
    dt = Math.min(dt, 0.05);
    const k = keys.current;
    let dx = 0,
      dz = 0;
    const sat = seat ? sittingIn.current : null;
    if (sat?.kind === 'kayak' && !k.size) {
      const r = ride.current;
      r.travelled += dt;
      r.angle += dt * 0.07;
      const [lx, lz] = shorePoint(r.angle, 5.5),
        [ax, az] = shorePoint(r.angle + 0.02, 5.5),
        ease = Math.min(1, r.travelled / 3);
      pos.current.set(r.from[0] + (lx - r.from[0]) * ease, 0, r.from[1] + (lz - r.from[1]) * ease);
      const heading = Math.atan2(ax - lx, az - lz);
      avatar.current.rotation.y = turnToward(avatar.current.rotation.y, heading, dt, 4);
      Object.assign(kayakRide, { x: pos.current.x, z: pos.current.z, heading: avatar.current.rotation.y });
      if (r.travelled * 0.07 >= Math.PI * 2) setSeat(null);
    }
    if (k.size) {
      if (viewMode !== 'follow') onExplore();
      if (seat) {
        standUp();
        setSeat(null);
      }
      path.current = [];
      setMarker(null);
      const horizontal = Number(k.has('d') || k.has('arrowright')) - Number(k.has('a') || k.has('arrowleft'));
      const vertical = Number(k.has('s') || k.has('arrowdown')) - Number(k.has('w') || k.has('arrowup'));
      const az = controls.current?.getAzimuthalAngle() ?? Math.PI / 4;
      dx = horizontal * Math.cos(az) + vertical * Math.sin(az);
      dz = -horizontal * Math.sin(az) + vertical * Math.cos(az);
    } else if (path.current.length) {
      const step = stepAlongPath(pos.current, path.current, mover.current, dt, 3);
      if (step) {
        dx = step.dx;
        dz = step.dz;
      }
      if (!path.current.length) setMarker(null);
    }
    if (k.size) {
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
      else if (viewMode === 'follow') desiredFocus.current.copy(pos.current);
      else desiredFocus.current.set(...OVERVIEW_CENTER);
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
    const now = performance.now() / 1000,
      pose = sat ? seatPose(sat.kind, sat.y ?? 0, motionOn ? now : 0) : UPRIGHT;
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
    avatar.current.position.y = sat ? pose.y : (moving ? Math.sin(walk.current) * 0.045 : 0) + lift;
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
      findMe.current.position.set(pos.current.x, 0.14, pos.current.z);
      findMe.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.06);
    }
    if (state.clock.elapsedTime - last.current > 0.4) {
      onPosition([pos.current.x, pos.current.z]);
      last.current = state.clock.elapsedTime;
    }
  });
  const walkTo = (target: Point) => {
    onExplore();
    if (seat) standUp();
    const route = findPath([pos.current.x, pos.current.z], target);
    if (route.length) {
      setSeat(null);
      path.current = route;
      setMarker(target);
    }
  };
  return (
    <>
      <AtmosphereScene settings={atmosphere} time={time} rain={raining} />
      <IslandTerrain
        onWalk={(target, delta) => {
          if (delta < 6) walkTo(target);
        }}
      />
      <FunSpots
        playerSeat={seat}
        radioOn={radioOn}
        onRadio={onRadio}
        onTelescope={onTelescope}
        period={time.period}
        night={night}
        motion={motionOn}
      />
      <Cat player={pos} motion={motionOn} onPet={onPetCat} />
      <Shells shells={shells} player={pos} onCollect={onShell} onWalk={walkTo} />
      <Rain raining={raining} motion={motionOn} />
      <Rainbow visible={rainbow} />
      <Campus news={news} night={night} />
      <Buildings player={pos} night={night} />
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
              ? { ...currentTask(person, work[person.id]), progress: work[person.id].progress }
              : null
          }
          shipped={shipped[person.id] ?? null}
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
                progress: work[person.id].progress,
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
      {trees.map(([x, z], i) => (
        <Palm key={i} x={x} z={z} i={i} />
      ))}
      <Box p={[0, -0.03, 9.3]} s={[2, 0.2, 3]} c="#b39a78" />
      {Array.from({ length: 9 }, (_, i) => (
        <Box key={i} p={[0, 0.08, 8 + i * 0.3]} s={[2.05, 0.04, 0.22]} c="#d5ba92" />
      ))}
      {districts
        .filter(d => d.id !== 'arrival')
        .map(d => (
          <ZoneLabel
            key={d.id}
            position={[d.point[0], fitMode === 'overview' ? 3 : 2.6, d.point[1] - 1.6]}
            title={d.name.toUpperCase()}
          />
        ))}
      {marker && (
        <mesh position={[marker[0], 0.22, marker[1]]} rotation={[-Math.PI / 2, 0, 0]}>
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
          <AvatarBody color={profile.color} xray={0.55} />
        </group>
        {bubble && (
          <Label position={[0, 2.45, 0]} zIndex={21}>
            <div className="emote-bubble">{bubble}</div>
          </Label>
        )}
        <Label position={[0, 1.85, 0]} zIndex={20}>
          <div className="avatar-label">
            <i />
            {profile.name} <span>you</span>
          </div>
        </Label>
      </group>
      <ContactShadows position={[0, 0.02, 0]} opacity={0.18} scale={35} blur={2} far={8} />
      <OrbitControls
        ref={controls}
        makeDefault
        target={[0, 0, 7]}
        minZoom={2}
        maxZoom={75}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2.7}
        enablePan={false}
        enableZoom={false}
        mouseButtons={{ LEFT: undefined, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.ROTATE }}
      />
    </>
  );
}
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
