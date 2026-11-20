import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { StaticBatch } from './static-batch';
import { AvatarBody } from './coworkers';
import { Label } from './label';
import { playerState } from './fun-state';
import { deckAction, hoverSpot } from './interact';
import {
  bellRing,
  BOAT_NAME,
  boatPose,
  CAPTAIN,
  clockText,
  DECK_SPOTS,
  DECK_Y,
  gangwayDown,
  GANGWAY,
  HULL_HALF_LENGTH,
  HULL_HALF_WIDTH,
  sailingAt,
  toWorld,
  TRIP_NAMES,
} from './cruise';
import { cruisePier, pierBell, pierBoard, pierPoint } from './world';

// The cruise pier and the Island Queen. The pier is static scenery; the boat follows the timetable
// (cruise.ts) every frame, with her deck furniture, captain and gangway aboard. Passengers are the
// usual avatars, placed by the scene and the coworkers.
type V3 = [number, number, number];
const ignore = () => {};
const WATER = -0.4;
// The boat's own frame: x across (u), z along (v), y up from the water line; the deck is at DECK_Y in the world.
const FLOOR = DECK_Y - (WATER + 0.06);
function Box({ p, s, c, r = [0, 0, 0], rough = 0.8 }: { p: V3; s: V3; c: string; r?: V3; rough?: number }) {
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={rough} />
    </mesh>
  );
}
function Cyl({ p, r, h, c, rot = [0, 0, 0] }: { p: V3; r: number; h: number; c: string; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, h, 10]} />
      <meshStandardMaterial color={c} roughness={0.8} />
    </mesh>
  );
}
// A beam between two points in the horizontal plane (planks, rails).
function Beam({
  a,
  b,
  y,
  w,
  h,
  c,
}: {
  a: [number, number];
  b: [number, number];
  y: number;
  w: number;
  h: number;
  c: string;
}) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return (
    <Box
      p={[(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2]}
      s={[w, h, length]}
      r={[0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0]}
      c={c}
    />
  );
}

const OUTLINE: [number, number][] = [
  [-HULL_HALF_WIDTH, -HULL_HALF_LENGTH],
  [HULL_HALF_WIDTH, -HULL_HALF_LENGTH],
  [HULL_HALF_WIDTH, 2.6],
  [1.5, 4.4],
  [0, HULL_HALF_LENGTH + 0.1],
  [-1.5, 4.4],
  [-HULL_HALF_WIDTH, 2.6],
];
// The hull outline pulled in by `by` (roughly: good enough for a deck and a stripe).
const inset = (by: number) =>
  OUTLINE.map(([u, v]): [number, number] => [u - Math.sign(u) * by, v - Math.sign(v || 1) * by * (v > 0 ? 1.3 : 1)]);
function prism(outline: [number, number][], bottom: number, top: number) {
  const shape = new THREE.Shape(outline.map(([u, v]) => new THREE.Vector2(u, v)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false });
  // Shape (u, v) → x, z; extrusion → down from the top.
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, top, 0);
  return geometry;
}

export function CruiseBoat({
  motion,
  onWalk,
  onPickSeat,
}: {
  motion: boolean;
  onWalk: (point: [number, number], delta: number) => void;
  onPickSeat: (id: string) => void;
}) {
  return (
    <>
      <Pier />
      <Boat motion={motion} onWalk={onWalk} onPickSeat={onPickSeat} />
      <Bell motion={motion} />
      <DepartureBoard />
    </>
  );
}

// The pier: a planked walkway on pilings out to a T-head, with the departure board at the shore end.
function Pier() {
  const { length, w, head, headDepth } = cruisePier,
    angle = Math.atan2(cruisePier.dx, cruisePier.dz);
  const planks = Math.floor(length / 0.45);
  return (
    <StaticBatch name="cruise-pier">
      <group position={[cruisePier.x, 0, cruisePier.z]} rotation={[0, angle, 0]}>
        {/* Walkway (local z out to sea, x across) and the T-head */}
        <Box p={[0, 0.08, length / 2 - 0.5]} s={[w, 0.12, length + 1]} c="#b8946a" />
        {Array.from({ length: planks }, (_, i) => (
          <Box key={i} p={[0, 0.145, -0.3 + i * 0.45]} s={[w, 0.012, 0.04]} c="#9c7a54" />
        ))}
        <Box p={[0, 0.08, length - headDepth / 2]} s={[head, 0.12, headDepth]} c="#b8946a" />
        {Array.from({ length: Math.floor(head / 0.45) }, (_, i) => (
          <Box
            key={i}
            p={[-head / 2 + 0.2 + i * 0.45, 0.145, length - headDepth / 2]}
            s={[0.04, 0.012, headDepth]}
            c="#9c7a54"
          />
        ))}
        {Array.from({ length: 6 }, (_, i) =>
          [-1, 1].map(side => (
            <Cyl
              key={`${i}${side}`}
              p={[side * (w / 2 - 0.08), -0.25, 1.5 + i * ((length - 3) / 5)]}
              r={0.08}
              h={0.9}
              c="#7d6447"
            />
          )),
        )}
        {[-1, -0.33, 0.33, 1].map(f => (
          <Cyl key={f} p={[(f * head) / 2.1, -0.2, length - 0.15]} r={0.11} h={1.1} c="#7d6447" />
        ))}
        {/* Bollards and a coiled rope at the berth */}
        {[-3.4, 2.6].map(x => (
          <Cyl key={x} p={[x, 0.3, length - 0.3]} r={0.12} h={0.3} c="#3d4a4c" />
        ))}
        <mesh position={[3.2, 0.19, length - 0.9]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.2, 0.05, 6, 16]} />
          <meshStandardMaterial color="#d8c8a0" roughness={0.9} />
        </mesh>
        {/* Lamp posts along the walkway */}
        {[3.5, 8].map(z => (
          <group key={z} position={[-w / 2 - 0.05, 0, z]}>
            <Cyl p={[0, 0.8, 0]} r={0.04} h={1.6} c="#3d4a4c" />
            <Box p={[0, 1.65, 0]} s={[0.16, 0.18, 0.16]} c="#f6e7b8" />
          </group>
        ))}
      </group>
      {/* The bell's post (the bell itself swings, below) */}
      <group position={[pierBell[0], 0, pierBell[1]]} rotation={[0, angle, 0]}>
        <Cyl p={[0, 0.75, 0]} r={0.06} h={1.5} c="#3d4a4c" />
        <Box p={[0, 1.5, 0.12]} s={[0.06, 0.06, 0.34]} c="#3d4a4c" />
      </group>
      {/* Departure board, facing people as they walk out */}
      <group position={[pierBoard[0], 0, pierBoard[1]]} rotation={[0, angle + Math.PI, 0]}>
        {[-0.55, 0.55].map(x => (
          <Cyl key={x} p={[x, 0.7, 0]} r={0.05} h={1.4} c="#3d4a4c" />
        ))}
        <Box p={[0, 1.25, 0]} s={[1.4, 0.8, 0.08]} c="#1f3b4d" />
        <Box p={[0, 1.7, 0]} s={[1.5, 0.12, 0.14]} c="#c94f3d" />
      </group>
    </StaticBatch>
  );
}

// Where everyone stands and sits aboard: benches, loungers, and rings to stand in at the rail and the bow.
function DeckFurniture({ onPickSeat }: { onPickSeat: (id: string) => void }) {
  const pick = (id: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta < 6) onPickSeat(id);
  };
  return (
    <>
      {DECK_SPOTS.map(spot => (
        <group
          key={spot.id}
          position={[spot.u, FLOOR, spot.v]}
          rotation={[0, spot.angle, 0]}
          onClick={pick(spot.id)}
          onPointerOver={e => {
            e.stopPropagation();
            const [x, z] = toWorld(boatPose(Date.now()), spot.u, spot.v);
            hoverSpot({ id: spot.id, x, y: DECK_Y, z, label: deckAction(spot) });
          }}
          onPointerOut={() => hoverSpot(null)}
        >
          {spot.kind === 'bench' && (
            <>
              <Box p={[0, 0.42, 0]} s={[0.9, 0.08, 0.45]} c="#c7a57c" />
              <Box p={[0, 0.66, -0.22]} s={[0.9, 0.36, 0.06]} c="#c7a57c" />
              {[-0.36, 0.36].map(x => (
                <Box key={x} p={[x, 0.2, 0]} s={[0.07, 0.4, 0.4]} c="#5d6b6c" />
              ))}
            </>
          )}
          {spot.kind === 'lounger' && (
            <>
              <Box p={[0, 0.3, 0.2]} s={[0.6, 0.08, 1.2]} c="#f3efe3" />
              <Box p={[0, 0.55, -0.45]} s={[0.6, 0.08, 0.6]} c="#3c94b4" r={[0.6, 0, 0]} />
              {[-0.25, 0.25].map(x => (
                <Box key={x} p={[x, 0.14, 0.2]} s={[0.05, 0.28, 1.1]} c="#c39f73" />
              ))}
            </>
          )}
          {spot.kind === 'stand' && (
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={ignore}>
              <ringGeometry args={[0.2, 0.26, 20]} />
              <meshBasicMaterial color="#fffce8" transparent opacity={0.55} />
            </mesh>
          )}
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// The rail round the deck, open at the gangway.
function railRuns(): [number, number][][] {
  const top = inset(0.08),
    gap0 = GANGWAY.v - GANGWAY.half,
    gap1 = GANGWAY.v + GANGWAY.half,
    [sternPort, sternStar, bowStar, ...rest] = top;
  return [
    [rest[rest.length - 1], sternPort, sternStar, [sternStar[0], gap0]],
    [[bowStar[0], gap1], bowStar, ...rest],
  ];
}

function Boat({
  motion,
  onWalk,
  onPickSeat,
}: {
  motion: boolean;
  onWalk: (point: [number, number], delta: number) => void;
  onPickSeat: (id: string) => void;
}) {
  const boat = useRef<THREE.Group>(null),
    gangway = useRef<THREE.Group>(null),
    flag = useRef<THREE.Mesh>(null);
  const hull = useMemo(() => prism(OUTLINE, -0.3, FLOOR), []),
    stripe = useMemo(() => prism(inset(-0.02), FLOOR - 0.36, FLOOR - 0.2), []),
    deck = useMemo(() => prism(inset(0.12), FLOOR, FLOOR + 0.03), []);
  useEffect(() => () => [hull, stripe, deck].forEach(g => g.dispose()), [hull, stripe, deck]);
  const runs = useMemo(railRuns, []);
  useFrame(({ clock }) => {
    const now = Date.now(),
      pose = boatPose(now, motion);
    if (boat.current) {
      boat.current.position.set(pose.x, WATER + 0.06 + pose.heave, pose.z);
      boat.current.rotation.set(pose.pitch, pose.heading, pose.roll, 'YXZ');
    }
    // The gangway swings up against the rail when it's raised.
    if (gangway.current) gangway.current.rotation.z = (1 - gangwayDown(now)) * 1.45;
    if (flag.current && motion) flag.current.rotation.y = Math.sin(clock.elapsedTime * 3) * 0.25;
  });
  const walk = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onWalk([e.point.x, e.point.z], e.delta);
  };
  const cabin = { u: 0.95, v0: 0.4, v1: 2.6, h: 1.5 },
    roof = FLOOR + cabin.h;
  return (
    <group ref={boat} userData={{ dynamic: true }} name="island-queen">
      {/* Hull, a blue stripe, and the deck you walk on */}
      <mesh geometry={hull} castShadow receiveShadow raycast={ignore}>
        <meshStandardMaterial color="#f6f1e4" roughness={0.5} />
      </mesh>
      <mesh geometry={stripe} raycast={ignore}>
        <meshStandardMaterial color="#2f6f9a" roughness={0.6} />
      </mesh>
      <mesh geometry={deck} receiveShadow onClick={walk}>
        <meshStandardMaterial color="#c8a374" roughness={0.85} />
      </mesh>
      {/* Rail */}
      {runs.flatMap((run, r) =>
        run
          .slice(1)
          .map((b, i) => <Beam key={`${r}-${i}`} a={run[i]} b={b} y={FLOOR + 0.62} w={0.05} h={0.05} c="#e8e2d2" />),
      )}
      {runs.flatMap((run, r) =>
        run.map(([u, v], i) => <Cyl key={`p${r}-${i}`} p={[u, FLOOR + 0.31, v]} r={0.03} h={0.62} c="#e8e2d2" />),
      )}
      {/* Wheelhouse: white cabin, glass all round, and the captain at the wheel */}
      <Box p={[0, FLOOR + 0.35, (cabin.v0 + cabin.v1) / 2]} s={[cabin.u * 2, 0.7, cabin.v1 - cabin.v0]} c="#f6f1e4" />
      {[-cabin.u, cabin.u].map(u => (
        <Box
          key={u}
          p={[u, FLOOR + 1.1, (cabin.v0 + cabin.v1) / 2]}
          s={[0.04, 0.8, cabin.v1 - cabin.v0 - 0.2]}
          c="#7fb4c8"
          rough={0.2}
        />
      ))}
      <Box p={[0, FLOOR + 1.1, cabin.v1 - 0.02]} s={[cabin.u * 2 - 0.1, 0.8, 0.04]} c="#7fb4c8" rough={0.2} />
      <Box p={[0, FLOOR + 1.1, cabin.v0 + 0.02]} s={[cabin.u * 2 - 0.1, 0.8, 0.04]} c="#7fb4c8" rough={0.2} />
      {[-1, 1].flatMap(su =>
        [-1, 1].map(sv => (
          <Box
            key={`${su}${sv}`}
            p={[su * (cabin.u - 0.04), FLOOR + 1.1, sv < 0 ? cabin.v0 + 0.04 : cabin.v1 - 0.04]}
            s={[0.08, 0.8, 0.08]}
            c="#f6f1e4"
          />
        )),
      )}
      <Box
        p={[0, roof, (cabin.v0 + cabin.v1) / 2]}
        s={[cabin.u * 2 + 0.3, 0.1, cabin.v1 - cabin.v0 + 0.4]}
        c="#2f6f9a"
      />
      <group position={[CAPTAIN[0], FLOOR, CAPTAIN[1]]}>
        <AvatarBody color="#f6f1e4" hair="#5b4636" skin="#c99a77" bottoms="#263845" />
        <Cyl p={[0, 1.42, 0]} r={0.17} h={0.08} c="#f6f1e4" />
        <Box p={[0, 1.39, 0.15]} s={[0.24, 0.03, 0.12]} c="#1f2c33" />
        <mesh position={[0, 0.95, 0.42]} rotation={[0.4, 0, 0]} castShadow>
          <torusGeometry args={[0.16, 0.025, 6, 14]} />
          <meshStandardMaterial color="#8a5a35" />
        </mesh>
      </group>
      {/* Upper deck on the wheelhouse roof: a rail, the mast and a flag */}
      {(
        [
          [-1, -1, 1, -1],
          [1, -1, 1, 1],
          [1, 1, -1, 1],
          [-1, 1, -1, -1],
        ] as const
      ).map(([ua, va, ub, vb], i) => (
        <Beam
          key={i}
          a={[ua * cabin.u, va < 0 ? cabin.v0 - 0.1 : cabin.v1 + 0.1]}
          b={[ub * cabin.u, vb < 0 ? cabin.v0 - 0.1 : cabin.v1 + 0.1]}
          y={roof + 0.4}
          w={0.04}
          h={0.04}
          c="#e8e2d2"
        />
      ))}
      <Cyl p={[0, roof + 1, cabin.v1 - 0.4]} r={0.05} h={2} c="#e8e2d2" />
      <mesh ref={flag} position={[0, roof + 1.8, cabin.v1 - 0.4]} raycast={ignore}>
        <boxGeometry args={[0.02, 0.3, 0.5]} />
        <meshStandardMaterial color="#e2563b" />
      </mesh>
      <Cyl p={[0, roof + 0.35, 0.9]} r={0.22} h={0.6} c="#e2563b" />
      <Box p={[0, roof + 0.7, 0.9]} s={[0.46, 0.08, 0.46]} c="#2e3a3d" />
      {/* Life rings either side, and the name on the stern */}
      {[-1, 1].map(side => (
        <mesh
          key={side}
          position={[side * (HULL_HALF_WIDTH + 0.02), FLOOR + 0.25, -3.6]}
          rotation={[0, Math.PI / 2, 0]}
          castShadow
        >
          <torusGeometry args={[0.2, 0.06, 8, 18]} />
          <meshStandardMaterial color="#e2563b" />
        </mesh>
      ))}
      <Box p={[0, FLOOR - 0.12, -HULL_HALF_LENGTH - 0.01]} s={[2.2, 0.22, 0.02]} c="#2f6f9a" />
      <DeckFurniture onPickSeat={onPickSeat} />
      {/* Gangway: hinged at the rail on the pier side, lowered onto the T-head while she's boarding */}
      <group ref={gangway} position={[HULL_HALF_WIDTH - 0.3, FLOOR, GANGWAY.v]}>
        <Box p={[0.65, -0.18, 0]} s={[1.4, 0.06, GANGWAY.half * 2 - 0.1]} r={[0, 0, -0.27]} c="#a7b3b4" />
        {[-1, 1].map(side => (
          <Box
            key={side}
            p={[0.65, 0.3, side * (GANGWAY.half - 0.08)]}
            s={[1.4, 0.04, 0.04]}
            r={[0, 0, -0.27]}
            c="#e8e2d2"
          />
        ))}
      </group>
      <Wake motion={motion} />
    </group>
  );
}

// Foam off the stern while she's under way (drawn in the boat's frame: a fan of fading puffs).
function Wake({ motion }: { motion: boolean }) {
  const puffs = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const s = sailingAt(Date.now()),
      under = motion && s.phase !== 'boarding' && s.t > 4 && s.t < 205;
    puffs.current?.children.forEach((puff, i) => {
      puff.visible = under;
      if (!under) return;
      const age = (clock.elapsedTime * 0.6 + i / 8) % 1;
      puff.position.set((i % 2 ? 1 : -1) * age * 1.4, 0.03 - (FLOOR - 0.3), -HULL_HALF_LENGTH - age * 5);
      puff.scale.setScalar(0.5 + age * 1.2);
      ((puff as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - age);
    });
  });
  return (
    <group ref={puffs} position={[0, FLOOR - 0.3, 0]}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} visible={false} rotation={[-Math.PI / 2, 0, 0]} raycast={ignore}>
          <circleGeometry args={[1, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// The bell on the T-head swings and glows as it rings, fifteen seconds before she sails.
function Bell({ motion }: { motion: boolean }) {
  const bell = useRef<THREE.Group>(null),
    glow = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const ring = bellRing(Date.now()),
      on = ring >= 0;
    if (bell.current) bell.current.rotation.x = on && motion ? Math.sin(ring * Math.PI * 9) * 0.5 * (1 - ring) : 0;
    if (glow.current) glow.current.emissiveIntensity = on ? 0.9 * (1 - ring) : 0;
  });
  const angle = Math.atan2(cruisePier.dx, cruisePier.dz);
  return (
    <group position={[pierBell[0], 1.48, pierBell[1]]} rotation={[0, angle, 0]}>
      <group ref={bell} position={[0, 0, 0.26]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.15, 0.24, 14, 1, true]} />
          <meshStandardMaterial
            ref={glow}
            color="#d4a943"
            emissive="#ffd36b"
            emissiveIntensity={0}
            metalness={0.6}
            roughness={0.35}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}

// The departure board: what's next and when, readable as you walk up the pier.
function DepartureBoard() {
  const [text, setText] = useState<{ trip: string; when: string } | null>(null);
  useEffect(() => {
    const tick = () => {
      const near = Math.hypot(playerState.x - pierBoard[0], playerState.z - pierBoard[1]) < 9;
      if (!near) return setText(null);
      const s = sailingAt(Date.now());
      setText(
        s.phase === 'boarding'
          ? { trip: TRIP_NAMES[s.trip], when: `Boarding · departs in ${clockText(s.departsIn)}` }
          : { trip: TRIP_NAMES[s.trip], when: `Out now · back in ${clockText(s.backIn)}` },
      );
    };
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, []);
  const [x, z] = pierPoint(0.4, -1.75);
  return text ? (
    <Label position={[x, 2.25, z]} zIndex={12}>
      <div className="departure-board">
        <b>🛳️ {BOAT_NAME}</b>
        <span>{text.trip}</span>
        <span>{text.when}</span>
      </div>
    </Label>
  ) : null;
}
