import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { riders } from './fun-state';
import { groundHeight, JUMP_LEDGES } from './highlands';
import { JUMP_ROUTES, type JumpKind } from './jumps';

// Sky jumps off the summit: a ledge for each, the wingsuit while you fly and the canopy once it opens.
// Like the boats at the marina, the gear follows your entry in `riders` (jumps.ts plans the route).
type V3 = [number, number, number];
const ignore = () => {};
const KINDS: { kind: JumpKind; seat: string; colors: [string, string] }[] = [
  { kind: 'wingsuit', seat: 'ws-0', colors: ['#e2563b', '#2f3b45'] },
  { kind: 'parachute', seat: 'pc-0', colors: ['#3c94b4', '#f2c14e'] },
];
function Box({ p, s, c, r = [0, 0, 0] }: { p: V3; s: V3; c: string; r?: V3 }) {
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow raycast={ignore}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={0.8} />
    </mesh>
  );
}
// A thin line between two points in the group's own frame (the canopy's lines).
function Line({ a, b }: { a: V3; b: V3 }) {
  const { position, quaternion, length } = useMemo(() => {
    const from = new THREE.Vector3(...a),
      span = new THREE.Vector3(...b).sub(from);
    return {
      position: from.clone().addScaledVector(span, 0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.clone().normalize()),
      length: span.length(),
    };
  }, [a, b]);
  return (
    <mesh position={position} quaternion={quaternion} raycast={ignore}>
      <cylinderGeometry args={[0.012, 0.012, length, 3]} />
      <meshBasicMaterial color="#f2efe6" />
    </mesh>
  );
}

export function SkyJumps({ motion }: { motion: boolean }) {
  return (
    <>
      {KINDS.map(k => (
        <Jump key={k.kind} {...k} motion={motion} />
      ))}
    </>
  );
}

function Jump({
  kind,
  seat,
  colors: [main, trim],
  motion,
}: {
  kind: JumpKind;
  seat: string;
  colors: [string, string];
  motion: boolean;
}) {
  const suit = useRef<THREE.Group>(null),
    bank = useRef<THREE.Group>(null),
    canopy = useRef<THREE.Group>(null),
    sock = useRef<THREE.Group>(null);
  // The wingsuit's outline round the body (head forward), lying flat.
  const wing = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 1.7);
    shape.lineTo(0.82, 1.25);
    shape.lineTo(0.3, 0.05);
    shape.lineTo(0, 0.25);
    shape.lineTo(-0.3, 0.05);
    shape.lineTo(-0.82, 1.25);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);
  useFrame(({ clock }) => {
    const ride = riders[seat],
      phase = ride?.phase;
    if (suit.current && bank.current) {
      suit.current.visible = !!ride && phase === 'fly';
      if (ride && phase === 'fly') {
        suit.current.position.set(ride.x, ride.y + 0.22, ride.z);
        suit.current.rotation.set(0, ride.heading, 0);
        bank.current.rotation.z = ride.roll;
      }
    }
    if (canopy.current) {
      canopy.current.visible = !!ride && phase === 'canopy';
      if (ride && phase === 'canopy') {
        // The canopy blooms open over half a second (straight away with gentle motion).
        const opened = ride.cut ? ride.cut.t : ride.gentle ? 0 : JUMP_ROUTES[kind][ride.trip].open,
          grow = motion && !ride.gentle ? Math.min(1, 0.25 + (ride.t - opened) / 0.6) : 1;
        canopy.current.position.set(ride.x, ride.y, ride.z);
        canopy.current.rotation.set(0, ride.heading, ride.roll);
        canopy.current.scale.setScalar(grow);
      }
    }
    if (sock.current)
      sock.current.rotation.y = motion ? Math.sin(clock.elapsedTime * 0.7 + (kind === 'wingsuit' ? 0 : 2)) * 0.35 : 0;
  });
  const { point, angle } = JUMP_LEDGES[kind],
    floor = groundHeight(...point);
  return (
    <>
      {/* The ledge: a timber launch plank over the lip, and a windsock on a pole beside it. */}
      <group position={[point[0], floor, point[1]]} rotation={[0, angle, 0]}>
        <Box p={[0, 0.06, -0.2]} s={[0.9, 0.1, 1.5]} c="#9a7650" />
        {[-0.42, 0.42].map(x => (
          <Box key={x} p={[x, 0.11, 0.48]} s={[0.08, 0.1, 0.08]} c={main} />
        ))}
        <group position={[0.75, 0, -0.5]}>
          <Box p={[0, 0.8, 0]} s={[0.07, 1.6, 0.07]} c="#d8d2c4" />
          <group ref={sock} position={[0, 1.5, 0]}>
            <mesh position={[0, 0, 0.32]} rotation={[Math.PI / 2, 0, 0]} raycast={ignore}>
              <coneGeometry args={[0.12, 0.6, 8, 1, true]} />
              <meshStandardMaterial color={main} side={THREE.DoubleSide} roughness={0.8} />
            </mesh>
          </group>
        </group>
      </group>
      {/* The wingsuit: webbing between arms and legs, banking with you. */}
      <group ref={suit} userData={{ dynamic: true }} visible={false}>
        <group ref={bank}>
          <mesh geometry={wing} rotation={[Math.PI / 2, 0, 0]} raycast={ignore}>
            <meshStandardMaterial color={main} side={THREE.DoubleSide} roughness={0.7} />
          </mesh>
          <Box p={[0, 0.02, 1.2]} s={[1.3, 0.03, 0.08]} c={trim} />
        </group>
      </group>
      {/* The canopy: a long, shallow arc of cells over your head, on its lines. */}
      <group ref={canopy} userData={{ dynamic: true }} visible={false}>
        <mesh position={[0, 2.75, 0]} scale={[1.7, 0.42, 0.65]} raycast={ignore}>
          <sphereGeometry args={[1, 18, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={main} side={THREE.DoubleSide} roughness={0.7} />
        </mesh>
        <mesh position={[0, 2.76, 0]} scale={[1.72, 0.43, 0.66]} raycast={ignore}>
          <sphereGeometry args={[1, 18, 6, 0, Math.PI * 2, 0, Math.PI / 5]} />
          <meshStandardMaterial color={trim} side={THREE.DoubleSide} roughness={0.7} />
        </mesh>
        {[-1, 1].map(side => (
          <group key={side}>
            <Line a={[side * 1.55, 2.72, 0.2]} b={[side * 0.18, 1.25, 0]} />
            <Line a={[side * 1.55, 2.72, -0.2]} b={[side * 0.18, 1.25, 0]} />
            <Line a={[side * 0.7, 2.75, 0]} b={[side * 0.18, 1.25, 0]} />
          </group>
        ))}
      </group>
    </>
  );
}
