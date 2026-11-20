import { seatPose, UPRIGHT } from './poses';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Label } from './label';
import * as THREE from 'three';
import { findPath, seats, type Point } from './world';
import { riders, seaState } from './fun-state';
import { groundHeight } from './highlands';
import { riderPose, riderSpot, startRide, stepRide } from './rides';
import { ARRIVAL_DOCK, peopleView, type DemoCoworker, type Target } from './people';
import { stepAlongPath, turnToward, wrapAngle } from './steering';
import { DEFAULT_LOOK } from './hosted';
import {
  berthFloor,
  boardingWalk,
  boatPose,
  DECK_IDLE_ICONS,
  DECK_Y,
  deckIdle,
  deckSpot,
  leavingWalk,
  toWorld,
  voyageStep,
  type DeckIdle,
  type Voyage,
} from './cruise';

// Shared avatar body so the player and coworkers always look like the same kind of person.
// The head and torso are separate groups so coworkers can look around and breathe.
//
// X-ray: every visible avatar pixel marks the stencil buffer; a second, flat tinted copy is then
// drawn only where the avatar is behind something (depth test "greater") and not where the avatar
// itself is visible, so you can always see people through trees, roofs, and canopies.
const parts = {
  torso: new THREE.CylinderGeometry(0.22, 0.26, 0.6, 12),
  face: new THREE.SphereGeometry(0.22, 16, 12),
  hair: new THREE.SphereGeometry(0.22, 12, 8),
  // Falls behind the head to the shoulders; the face hides its front.
  longHair: new THREE.CapsuleGeometry(0.19, 0.24, 4, 12),
  leg: new THREE.BoxGeometry(0.17, 0.4, 0.19),
};
const stencilMark = {
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.AlwaysStencilFunc,
  stencilZPass: THREE.ReplaceStencilOp,
} as const;
const xrayMaterials = new Map<string, THREE.MeshBasicMaterial>();
function xrayMaterial(color: string, opacity: number) {
  const key = `${color}/${opacity}`;
  if (!xrayMaterials.has(key))
    xrayMaterials.set(
      key,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        depthFunc: THREE.GreaterDepth,
        toneMapped: false,
        fog: false,
        stencilWrite: true,
        stencilRef: 1,
        stencilFunc: THREE.NotEqualStencilFunc,
      }),
    );
  return xrayMaterials.get(key)!;
}
function Part({
  geometry,
  color,
  position,
  xray,
  shadow = true,
  roughness,
}: {
  geometry: THREE.BufferGeometry;
  color: string;
  position?: [number, number, number];
  xray: THREE.Material | null;
  shadow?: boolean;
  roughness?: number;
}) {
  return (
    <>
      <mesh geometry={geometry} position={position} castShadow={shadow} receiveShadow={shadow}>
        <meshStandardMaterial color={color} roughness={roughness} {...stencilMark} />
      </mesh>
      {xray && <mesh geometry={geometry} position={position} material={xray} renderOrder={20} raycast={() => null} />}
    </>
  );
}
export function AvatarBody({
  color,
  hair = DEFAULT_LOOK.hair,
  hairStyle = DEFAULT_LOOK.hairStyle,
  skin = DEFAULT_LOOK.skin,
  bottoms = DEFAULT_LOOK.bottoms,
  head,
  torso,
  xray = 0,
}: {
  color: string;
  hair?: string;
  hairStyle?: 'short' | 'long';
  skin?: string;
  bottoms?: string;
  head?: RefObject<THREE.Group | null>;
  torso?: RefObject<THREE.Group | null>;
  xray?: number;
}) {
  const ghost = xray > 0 ? xrayMaterial(color, xray) : null;
  return (
    <>
      <group ref={torso} position={[0, 0.35, 0]}>
        <Part geometry={parts.torso} position={[0, 0.3, 0]} color={color} roughness={0.9} xray={ghost} />
      </group>
      <group ref={head} position={[0, 1.17, 0]}>
        <Part geometry={parts.face} color={skin} xray={ghost} />
        <Part geometry={parts.hair} position={[0, 0.12, -0.03]} color={hair} shadow={false} xray={ghost} />
        {hairStyle === 'long' && (
          <Part geometry={parts.longHair} position={[0, -0.1, -0.09]} color={hair} shadow={false} xray={ghost} />
        )}
      </group>
      {[-0.13, 0.13].map(x => (
        <Part key={x} geometry={parts.leg} position={[x, 0.22, 0]} color={bottoms} roughness={0.85} xray={ghost} />
      ))}
    </>
  );
}

// A little camera, held up to take a photo from the deck.
export function PhotoCamera() {
  return (
    <mesh position={[0.08, 1.22, 0.3]} castShadow>
      <boxGeometry args={[0.2, 0.13, 0.09]} />
      <meshStandardMaterial color="#2e3a3d" roughness={0.5} />
    </mesh>
  );
}
// Scuba kit, worn while diving: tank, mask, regulator and fins.
export function DiveGear() {
  const piece = (p: [number, number, number], size: [number, number, number], color: string) => (
    <mesh position={p} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
  return (
    <group name="dive-gear">
      <mesh position={[0, 0.74, -0.21]} castShadow>
        <capsuleGeometry args={[0.085, 0.3, 4, 10]} />
        <meshStandardMaterial color="#f0c63c" roughness={0.45} metalness={0.2} />
      </mesh>
      {piece([0, 0.98, -0.21], [0.07, 0.07, 0.07], '#4a5257')}
      {piece([0, 0.74, -0.12], [0.3, 0.07, 0.06], '#2c3438')}
      {piece([0, 1.2, 0.19], [0.27, 0.11, 0.07], '#22303a')}
      {piece([0, 1.2, 0.225], [0.21, 0.07, 0.02], '#9fe3ee')}
      {piece([0, 1.07, 0.2], [0.08, 0.06, 0.07], '#2c3438')}
      {[-0.13, 0.13].map(x => (
        <group key={x} name="fin" position={[x, 0.02, 0]}>
          {piece([0, -0.2, 0.02], [0.14, 0.44, 0.035], '#2d7fb8')}
        </group>
      ))}
    </group>
  );
}

const SPEED = 2.4,
  NOTICE = 4,
  WAVE = 2.6;

export function Coworker({
  person,
  target,
  greeting,
  player,
  motion,
  task,
  shipped,
  onClick,
}: {
  person: DemoCoworker;
  target: Target | null;
  greeting: string | null;
  player: RefObject<THREE.Vector3>;
  motion: boolean;
  // No `progress` for a real teammate: only what they're on.
  task: { title: string; icon: string; progress?: number } | null;
  shipped: string | null;
  onClick: (id: string) => void;
}) {
  const group = useRef<THREE.Group>(null),
    head = useRef<THREE.Group>(null),
    torso = useRef<THREE.Group>(null),
    gear = useRef<THREE.Group>(null),
    camera = useRef<THREE.Group>(null);
  const pos = useRef(
    new THREE.Vector3(
      ...((target ? [target.point[0], 0, target.point[1]] : [ARRIVAL_DOCK[0], 0, ARRIVAL_DOCK[1]]) as [
        number,
        number,
        number,
      ]),
    ),
  );
  const lastTarget = useRef<Target | null>(null),
    climbing = useRef(false),
    rideOver = useRef(false),
    poseGroup = useRef<THREE.Group>(null);
  const mover = useRef({ speed: 0 }),
    path = useRef<Point[]>([]),
    present = useRef(!!target),
    leaving = useRef(false),
    walk = useRef(0),
    first = useRef(true);
  const clock = useRef(Math.random() * 10),
    near = useRef(false),
    hop = useRef(0);
  // On the Island Queen: how far through the trip they are, and the plan waiting till they're off.
  const voyage = useRef<Voyage | null>(null),
    deferred = useRef<{ target: Target | null } | null>(null),
    seed = useRef(Math.random() * 10),
    [idle, setIdle] = useState<DeckIdle | null>(null);
  const [waving, setWaving] = useState(false),
    [close, setClose] = useState(false);
  useEffect(() => {
    if (shipped) hop.current = 1;
  }, [shipped]);
  // A new plan: head off to it.
  const goTo = (target: Target | null) => {
    voyage.current = deckSpot(target?.seatId) ? { stage: 'pier', sailing: -1 } : null;
    // Seats are solid: get up by stepping out to the seat's free side, then walk from there.
    const previous = lastTarget.current;
    // Off a ride (out on the water or up the bluff): back to its step-in spot first.
    const rode = previous?.seatId ? seats.find(s => s.id === previous.seatId)?.ride : undefined;
    if (rode && previous) {
      delete riders[previous.seatId!];
      pos.current.set(previous.approach[0], 0, previous.approach[1]);
    }
    rideOver.current = false;
    const seated =
      !!rode ||
      (!!previous?.seatId && Math.hypot(pos.current.x - previous.point[0], pos.current.z - previous.point[1]) < 0.3);
    const start: Point = seated ? previous!.approach : [pos.current.x, pos.current.z];
    const from = (route: Point[]) => (seated ? [start, ...route] : route);
    lastTarget.current = target;
    if (target) {
      if (!present.current) {
        pos.current.set(ARRIVAL_DOCK[0], 0, ARRIVAL_DOCK[1]);
        present.current = true;
      }
      leaving.current = false;
      const route = findPath(present.current && !seated ? [pos.current.x, pos.current.z] : start, target.approach);
      path.current = route.length
        ? [
            ...from(route),
            ...(target.route ? target.route.slice(1) : []),
            ...(target.seatId && !target.elevation ? [target.point] : []),
          ]
        : [];
      climbing.current = !!target.elevation;
      if (!route.length) pos.current.set(target.point[0], 0, target.point[1]);
    } else if (present.current) {
      leaving.current = true;
      path.current = from(findPath(start, ARRIVAL_DOCK));
    }
  };
  useEffect(() => {
    if (first.current) {
      // On page load coworkers are already where their routine says, not walking in.
      first.current = false;
      if (group.current && target) group.current.rotation.y = target.angle;
      lastTarget.current = target;
      voyage.current = deckSpot(target?.seatId) ? { stage: 'pier', sailing: -1 } : null;
      return;
    }
    // Aboard the boat (or walking on or off): ride the sailing out, then go.
    const stage = voyage.current?.stage;
    if (stage === 'boarding' || stage === 'aboard' || stage === 'leaving') deferred.current = { target };
    else goTo(target);
  }, [target]);
  useEffect(() => {
    if (waving) {
      const t = setTimeout(() => setWaving(false), WAVE * 1000);
      return () => clearTimeout(t);
    }
  }, [waving]);
  useEffect(
    () => () => {
      delete peopleView[person.id];
      if (lastTarget.current?.seatId) delete riders[lastTarget.current.seatId];
    },
    [person.id],
  );
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    dt = Math.min(dt, 0.05);
    if (motion) clock.current += dt;
    const t = clock.current;
    let moving = false;
    if (path.current.length) {
      const step = stepAlongPath(pos.current, path.current, mover.current, dt, SPEED);
      if (step) {
        pos.current.x += step.dx;
        pos.current.z += step.dz;
        if (Math.hypot(step.dx, step.dz) > 1e-5)
          g.rotation.y = turnToward(g.rotation.y, Math.atan2(step.dx, step.dz), dt, 10);
      }
      moving = true;
      walk.current += dt * 12;
      if (!path.current.length && leaving.current) {
        present.current = false;
        leaving.current = false;
      }
      if (!path.current.length && climbing.current && target) {
        // At the foot of the stair: up to the rooftop seat.
        climbing.current = false;
        pos.current.set(target.point[0], 0, target.point[1]);
      }
    } else if (target)
      // Settle into the seat / spot's facing smoothly after arriving.
      g.rotation.y = turnToward(g.rotation.y, target.angle, dt, 6);
    // The Island Queen: wait on the pier, walk aboard to the deck spot, ride one sailing, walk off.
    const deck = voyage.current && present.current ? deckSpot(lastTarget.current?.seatId) : undefined;
    let aboard = false,
      onBerth = false;
    if (deck && voyage.current) {
      const now = Date.now(),
        before = voyage.current,
        after = voyageStep(before, now, path.current.length > 0);
      voyage.current = after;
      if (after.stage !== before.stage) {
        if (after.stage === 'boarding') path.current = boardingWalk(deck);
        if (after.stage === 'aboard') path.current = [];
        if (after.stage === 'leaving') path.current = leavingWalk(deck, lastTarget.current!.point);
        if (after.stage === 'done' && deferred.current) {
          const next = deferred.current.target;
          deferred.current = null;
          goTo(next);
        }
      }
      aboard = voyage.current?.stage === 'aboard';
      onBerth = voyage.current?.stage === 'boarding' || voyage.current?.stage === 'leaving';
      if (aboard) {
        const pose = boatPose(now, motion),
          [x, z] = toWorld(pose, deck.u, deck.v);
        pos.current.set(x, 0, z);
        g.rotation.y = pose.heading + deck.angle;
        const doing = motion ? deckIdle(seed.current, now / 1000, deck.kind) : 'look';
        if (doing !== idle) setIdle(doing);
        if (doing === 'wave' && hop.current <= 0 && Math.sin(t * 2.2) > 0.98) hop.current = 1;
      }
    }
    if (!aboard && idle) setIdle(null);
    const doing = aboard ? idle : null;
    if (camera.current) camera.current.visible = doing === 'photo';
    // Rides: once aboard, follow the ride on autopilot; afterwards wait at the launch until it's time to go.
    const rideSeat = !moving && target?.seatId ? seats.find(s => s.id === target.seatId) : undefined;
    let view = rideSeat?.ride ? riders[rideSeat.id] : undefined;
    if (
      rideSeat?.ride &&
      !view &&
      !rideOver.current &&
      Math.hypot(pos.current.x - rideSeat.point[0], pos.current.z - rideSeat.point[1]) < 0.3
    )
      view = riders[rideSeat.id] = startRide(rideSeat, riders, seaState.sights);
    if (rideSeat && view) {
      if (stepRide(rideSeat, view, dt)) {
        delete riders[rideSeat.id];
        rideOver.current = true;
        pos.current.set(rideSeat.point[0], 0, rideSeat.point[1]);
        g.rotation.y = rideSeat.angle;
      } else {
        const [x, z] = riderSpot(rideSeat, view);
        pos.current.set(x, 0, z);
        g.rotation.y = view.heading;
      }
    }
    const riding = rideSeat?.ride && riders[rideSeat.id];
    if (gear.current) gear.current.visible = !!riding && riding.kind === 'scuba';
    // Notice the player: look at them when close, wave once as they arrive (if not busy).
    const me = player.current,
      toPlayer = me ? Math.hypot(me.x - pos.current.x, me.z - pos.current.z) : Infinity;
    const isNear = present.current && toPlayer < NOTICE;
    if (isNear && !near.current && !moving && target?.activity.status === 'Available') {
      setWaving(true);
      hop.current = 1;
    }
    if (isNear !== near.current) setClose(isNear);
    near.current = isNear;
    const pose = target?.activity.pose;
    if (head.current) {
      let yaw = 0,
        pitch = 0;
      if (isNear && me)
        yaw = THREE.MathUtils.clamp(
          wrapAngle(Math.atan2(me.x - pos.current.x, me.z - pos.current.z) - g.rotation.y),
          -1.1,
          1.1,
        );
      else if (!moving && motion)
        yaw = pose === 'look' ? Math.sin(t * 0.35) * 0.6 : Math.sin(t * 0.23) * Math.max(0, Math.sin(t * 0.11)) * 0.5;
      if (doing === 'doze') pitch = 0.45;
      else if (doing === 'photo') pitch = -0.12;
      else if (!moving && motion && !isNear)
        pitch =
          pose === 'desk'
            ? 0.22 + Math.sin(t * 9) * 0.02
            : pose === 'talk'
              ? Math.max(0, Math.sin(t * 2.6)) * 0.14
              : pose === 'sip'
                ? Math.max(0, Math.sin(t * 0.5) - 0.7) * 0.6
                : 0;
      head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, yaw, 6, dt);
      head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, -pitch, 6, dt);
    }
    if (torso.current) torso.current.scale.y = motion && !moving ? 1 + Math.sin(t * 2.1) * 0.025 : 1;
    hop.current = Math.max(0, hop.current - dt * 2.5);
    g.visible = present.current;
    g.position.copy(pos.current);
    const seated =
      !moving && !!target?.seatId && Math.hypot(pos.current.x - target.point[0], pos.current.z - target.point[1]) < 0.3;
    const sitting = riding
      ? (r => ({ ...r, y: riding.y + r.y }))(riderPose(riding.kind, clock.current, -riding.y))
      : aboard && deck
        ? (p => ({ ...p, pitch: p.pitch + (doing === 'lean' ? 0.16 : 0) }))(seatPose(deck.kind, 0, 0))
        : rideSeat?.ride && seated
          ? riderPose(rideSeat.ride.kind, 0)
          : seated
            ? seatPose(target!.seatKind, target!.elevation, motion ? performance.now() / 1000 : 0)
            : UPRIGHT;
    const floor = riding
      ? 0
      : aboard
        ? DECK_Y
        : onBerth
          ? berthFloor(pos.current.x, pos.current.z)
          : groundHeight(pos.current.x, pos.current.z);
    g.position.y =
      floor + (moving ? Math.sin(walk.current) * 0.045 : sitting.y + Math.sin(hop.current * Math.PI) * 0.18);
    if (poseGroup.current) {
      poseGroup.current.rotation.x = sitting.pitch;
      poseGroup.current.position.z = sitting.z;
      poseGroup.current.rotation.y = sitting.roll;
    }
    peopleView[person.id] = { x: pos.current.x, z: pos.current.z, present: present.current };
  });
  const status = target?.activity.status;
  return (
    <group
      ref={group}
      name={`coworker-${person.id}`}
      onClick={e => {
        e.stopPropagation();
        onClick(person.id);
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <group ref={poseGroup}>
        <AvatarBody
          color={person.color}
          hair={person.hair}
          hairStyle={person.hairStyle}
          skin={person.skin}
          bottoms={person.bottoms}
          head={head}
          torso={torso}
          xray={0.3}
        />
        <group ref={gear} visible={false}>
          <DiveGear />
        </group>
        <group ref={camera} visible={false}>
          <PhotoCamera />
        </group>
      </group>
      {/* At a desk the tag floats higher so it doesn't cover their glowing monitor from the default camera. */}
      <Label position={[0, target?.activity.pose === 'desk' && target.seatId ? 2.55 : 1.85, 0]} zIndex={20}>
        <div className="avatar-label coworker-label">
          {greeting ? (
            <div className="speech-bubble">{greeting}</div>
          ) : shipped ? (
            <div className="speech-bubble shipped">✅ Shipped: {shipped}</div>
          ) : (
            close &&
            task && (
              <div className="task-card">
                {task.icon} {task.title}
                {task.progress !== undefined && <b>{Math.round(task.progress * 100)}%</b>}
              </div>
            )
          )}
          <em style={{ background: person.color }}>
            {person.name[0]}
            <i className={status === 'Available' ? '' : 'busy'} />
          </em>
          {person.name}
          {target && (
            <b className={waving ? 'activity-icon waving' : 'activity-icon'} title={target.activity.activity}>
              {waving ? '👋' : idle ? DECK_IDLE_ICONS[idle] : target.activity.icon}
            </b>
          )}
          {task?.progress !== undefined && (
            <span className="task-bar" aria-hidden="true">
              <span style={{ width: `${task.progress * 100}%` }} />
            </span>
          )}
        </div>
      </Label>
    </group>
  );
}
