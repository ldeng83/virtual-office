import { Label } from './label';
import { seats } from './world';
import type { RideKind } from './rides';

export function Box({
  p,
  s,
  c,
  rotation = 0,
}: {
  p: [number, number, number];
  s: [number, number, number];
  c: string;
  rotation?: number;
}) {
  return (
    <mesh position={p} rotation={[0, rotation, 0]} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={0.85} />
    </mesh>
  );
}
export function Cylinder({
  p,
  r,
  h,
  c,
  r2,
  segments = 12,
}: {
  p: [number, number, number];
  r: number;
  h: number;
  c: string;
  r2?: number;
  segments?: number;
}) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <cylinderGeometry args={[r, r2 ?? r, h, segments]} />
      <meshStandardMaterial color={c} roughness={0.9} />
    </mesh>
  );
}
export function Palm({ x, z, i }: { x: number; z: number; i: number }) {
  return (
    <group name={`palm-${i}`} position={[x, 0, z]} rotation={[0, i * 1.7, 0]}>
      <Cylinder p={[0, 1.25, 0]} r={0.13} r2={0.23} h={2.5} c="#b19972" />
      <group name="palm-crown" position={[0, 2.5, 0]}>
        {[0, 1, 2, 3, 4, 5].map(n => (
          <group key={n} rotation={[0, (n * Math.PI) / 3, 0]}>
            <mesh position={[0.65, 0, 0]} rotation={[0, 0, -0.2]} scale={[1, 0.09, 0.27]} castShadow>
              <sphereGeometry args={[1, 6, 4]} />
              <meshStandardMaterial color={i % 2 ? '#638769' : '#719576'} />
            </mesh>
          </group>
        ))}
      </group>
      <Cylinder p={[0, 0.05, 0]} r={0.55} h={0.1} c="#a5b68a" />
    </group>
  );
}
export function Seat({ seat, onSelect }: { seat: (typeof seats)[number]; onSelect: (id: string) => void }) {
  return (
    <group
      position={[seat.point[0], seat.y ?? 0, seat.point[1]]}
      rotation={[0, seat.angle, 0]}
      onClick={e => {
        e.stopPropagation();
        if (e.delta < 6) onSelect(seat.id);
      }}
      onPointerOver={e => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      {seat.ride ? rideHitArea(seat.ride.kind) : seatModel(seat.kind)}
    </group>
  );
}
// Seat furniture by kind; the avatar sits at the group's origin facing +z.
// Invisible but clickable area, for seats whose furniture is drawn elsewhere (hammocks, kayaks, play spots).
function HitArea({ w, d, h = 0.6 }: { w: number; d: number; h?: number }) {
  return (
    <mesh position={[0, h / 2, 0]}>
      <boxGeometry args={[w, h, d]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
// Rides: the vehicle is drawn elsewhere; the climb and the dive get a step-in ring.
function rideHitArea(kind: RideKind) {
  if (kind === 'kayak') return <HitArea w={0.8} d={2.6} h={0.4} />;
  if (kind === 'jetski') return <HitArea w={0.9} d={2.2} h={0.6} />;
  if (kind === 'sailboat' || kind === 'parasail') return <HitArea w={1.3} d={1.5} h={1} />;
  return (
    <>
      <mesh position={[0, kind === 'scuba' ? -0.3 : 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.3, 24]} />
        <meshBasicMaterial color="#fffce8" transparent opacity={0.75} />
      </mesh>
      <HitArea w={0.9} d={0.9} h={kind === 'climb' ? 2 : 0.6} />
    </>
  );
}
function seatModel(kind: (typeof seats)[number]['kind']) {
  if (kind === 'hammock') return <HitArea w={0.9} d={2} h={1.1} />;
  if (kind === 'stand')
    return (
      <>
        <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.24, 24]} />
          <meshBasicMaterial color="#fffce8" transparent opacity={0.7} />
        </mesh>
        <HitArea w={0.6} d={0.6} h={1.2} />
      </>
    );
  if (kind === 'log')
    return (
      <mesh position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.19, 0.2, 0.9, 10]} />
        <meshStandardMaterial color="#8a6a4b" roughness={0.95} />
      </mesh>
    );
  if (kind === 'crate')
    return (
      <>
        <Box p={[0, 0.34, 0]} s={[0.46, 0.4, 0.46]} c="#b8946a" />
        <Box p={[0, 0.34, 0.235]} s={[0.46, 0.06, 0.01]} c="#9c7a54" />
      </>
    );
  if (kind === 'bench')
    return (
      <>
        <Box p={[0, 0.42, 0]} s={[0.85, 0.1, 0.45]} c="#c7a57c" />
        {[-0.33, 0.33].map(x => (
          <Box key={x} p={[x, 0.2, 0]} s={[0.08, 0.38, 0.38]} c="#8d8473" />
        ))}
      </>
    );
  if (kind === 'stool')
    return (
      <>
        <Cylinder p={[0, 0.62, 0]} r={0.2} h={0.08} c="#c7a57c" />
        <Cylinder p={[0, 0.3, 0]} r={0.04} h={0.6} c="#6f7d6c" />
        <Cylinder p={[0, 0.02, 0]} r={0.16} h={0.04} c="#6f7d6c" />
      </>
    );
  if (kind === 'lounger')
    return (
      <>
        <Box p={[0, 0.3, 0.2]} s={[0.6, 0.08, 1.2]} c="#f3efe3" />
        <Box p={[0, 0.55, -0.45]} s={[0.6, 0.08, 0.6]} c="#f3efe3" rotation={0} />
        {[-0.25, 0.25].map(x => (
          <Box key={x} p={[x, 0.14, 0.2]} s={[0.05, 0.28, 1.1]} c="#c39f73" />
        ))}
      </>
    );
  if (kind === 'armchair')
    return (
      <>
        <Box p={[0, 0.4, 0]} s={[0.8, 0.22, 0.7]} c="#9fb5a8" />
        <Box p={[0, 0.75, -0.3]} s={[0.8, 0.55, 0.14]} c="#9fb5a8" />
        {[-0.36, 0.36].map(x => (
          <Box key={x} p={[x, 0.58, 0]} s={[0.1, 0.25, 0.65]} c="#8ea596" />
        ))}
      </>
    );
  return (
    <>
      <Box p={[0, 0.48, 0]} s={[0.65, 0.13, 0.65]} c="#d9b389" />
      <Box p={[0, 0.86, -0.28]} s={[0.65, 0.65, 0.1]} c="#d9b389" />
      {[-0.23, 0.23].flatMap(x =>
        [-0.23, 0.23].map(z => <Box key={`${x}${z}`} p={[x, 0.22, z]} s={[0.08, 0.45, 0.08]} c="#716c5b" />),
      )}
    </>
  );
}
export function ZoneLabel({ position, title }: { position: [number, number, number]; title: string }) {
  return (
    <Label position={position} zIndex={10}>
      <span className="zone-label">{title}</span>
    </Label>
  );
}
// Zoom multiplier range (30 = default framing). Low values reveal more open sea around the island.
