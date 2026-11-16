import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { riders } from './fun-state';
import { climbFaceZ, type RideView } from './rides';
import { bluff, jetSkiMoorings, jetty, marina, reef, sailboatMooring, towBoatMooring, waterSportsHut } from './world';

// Water sports dock (jet skis, sailboat, parasail tow boat), the climbing bluff and the dive reef.
// Every vehicle sits at its mooring until someone rides it, then follows its rider (in `riders`).
type V3 = [number, number, number];
const ignore = () => {};
const WATER = -0.4;
function Box({ p, s, c, r = [0, 0, 0] }: { p: V3; s: V3; c: string; r?: V3 }) {
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={0.8} />
    </mesh>
  );
}
function Cyl({ p, r, h, c, r2, rot = [0, 0, 0] }: { p: V3; r: number; h: number; c: string; r2?: number; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[r, r2 ?? r, h, 12]} />
      <meshStandardMaterial color={c} roughness={0.8} />
    </mesh>
  );
}
function Blob({ p, s, c, rough = 0.8 }: { p: V3; s: V3; c: string; rough?: number }) {
  return (
    <mesh position={p} scale={s} castShadow receiveShadow raycast={ignore}>
      <sphereGeometry args={[1, 14, 10]} />
      <meshStandardMaterial color={c} roughness={rough} />
    </mesh>
  );
}
// A thin line between two points, updated every frame (tow line, climbing rope).
const up = new THREE.Vector3(0, 1, 0),
  span = new THREE.Vector3();
function placeLine(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  span.subVectors(b, a);
  mesh.position.copy(a).addScaledVector(span, 0.5);
  mesh.scale.set(1, span.length(), 1);
  mesh.quaternion.setFromUnitVectors(up, span.normalize());
}
// Where a moored boat sits, bobbing a little.
function moor(object: THREE.Object3D, x: number, z: number, heading: number, t: number, seed: number) {
  object.position.set(x, WATER + 0.06 + Math.sin(t * 1.2 + seed) * 0.03, z);
  object.rotation.set(0, heading, Math.sin(t * 1.1 + seed) * 0.03);
}
function follow(object: THREE.Object3D, ride: RideView, lift = 0) {
  object.position.set(ride.x, WATER + 0.06 + lift, ride.z);
  object.rotation.set(0, ride.heading, ride.roll);
}
const sailor = () => riders['sb-0'] ?? riders['sb-1'];

export function WaterSports({ motion }: { motion: boolean }) {
  return (
    <>
      <Marina motion={motion} />
      <ClimbingBluff motion={motion} />
      <DiveSite motion={motion} />
    </>
  );
}

function Marina({ motion }: { motion: boolean }) {
  const skis = useRef<THREE.Group>(null),
    sailboat = useRef<THREE.Group>(null),
    boom = useRef<THREE.Group>(null),
    towBoat = useRef<THREE.Group>(null),
    chute = useRef<THREE.Group>(null),
    towLine = useRef<THREE.Mesh>(null);
  const a = useMemo(() => new THREE.Vector3(), []),
    b = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = motion ? clock.elapsedTime : 0;
    skis.current?.children.forEach((ski, i) => {
      const ride = riders[`js-${i}`];
      if (ride) follow(ski, ride, ride.y);
      else moor(ski, ...jetSkiMoorings[i], 0, t, i);
    });
    if (sailboat.current) {
      const ride = sailor();
      if (ride) follow(sailboat.current, ride);
      else moor(sailboat.current, ...sailboatMooring, 0, t, 3);
      // The boom swings out to catch a westerly breeze.
      const heading = sailboat.current.rotation.y,
        wind = Math.sin(heading + Math.PI / 2);
      if (boom.current)
        boom.current.rotation.y = THREE.MathUtils.damp(
          boom.current.rotation.y,
          ride ? 0.55 * Math.sign(wind || 1) : 0,
          2,
          1 / 60,
        );
    }
    const ride = riders['pa-0'],
      towing = ride?.boat;
    if (towBoat.current) {
      if (towing) {
        towBoat.current.position.set(towing.x, WATER + 0.06, towing.z);
        towBoat.current.rotation.set(0, towing.heading, Math.sin(t * 1.3) * 0.03);
      } else moor(towBoat.current, ...towBoatMooring, 0, t, 5);
    }
    if (chute.current && towLine.current) {
      chute.current.visible = towLine.current.visible = !!ride && ride.y > 0.4;
      if (ride && towing) {
        chute.current.position.set(ride.x, ride.y + 2.2, ride.z);
        chute.current.rotation.set(0, ride.heading, ride.roll);
        const boat = towBoat.current!;
        a.set(boat.position.x - Math.sin(ride.heading) * 1.3, 0.6, boat.position.z - Math.cos(ride.heading) * 1.3);
        b.set(ride.x, ride.y + 0.9, ride.z);
        placeLine(towLine.current, a, b);
      }
    }
  });
  const length = marina.z1 - marina.z0,
    mid = (marina.z0 + marina.z1) / 2;
  return (
    <group name="water-sports">
      {/* Dock */}
      <Box p={[marina.x, 0.08, mid]} s={[marina.w, 0.12, length]} c="#b8946a" />
      {Array.from({ length: Math.floor(length / 0.45) }, (_, i) => (
        <Box key={i} p={[marina.x, 0.145, marina.z0 + 0.2 + i * 0.45]} s={[marina.w, 0.012, 0.04]} c="#9c7a54" />
      ))}
      {Array.from({ length: 5 }, (_, i) =>
        [-1, 1].map(side => (
          <Cyl
            key={`${i}${side}`}
            p={[marina.x + side * (marina.w / 2 - 0.08), -0.25, marina.z0 + 3 + i * ((length - 3) / 4)]}
            r={0.08}
            h={0.9}
            c="#7d6447"
          />
        )),
      )}
      {/* Rental hut with a striped awning, life rings and a board rack */}
      <group position={[waterSportsHut.x, 0, waterSportsHut.z]}>
        <Box p={[0, 0.6, 0]} s={[waterSportsHut.w, 1.2, waterSportsHut.d]} c="#f1e6cf" />
        <Box p={[0, 0.95, waterSportsHut.d / 2 + 0.01]} s={[1.6, 0.5, 0.04]} c="#3d5a62" />
        {Array.from({ length: 6 }, (_, i) => (
          <Box
            key={i}
            p={[-waterSportsHut.w / 2 + 0.22 + i * 0.43, 1.42, 0.2]}
            s={[0.43, 0.06, waterSportsHut.d + 0.5]}
            r={[0.25, 0, 0]}
            c={i % 2 ? '#f6f1e4' : '#3c94b4'}
          />
        ))}
        {[-0.85, 0.85].map(x => (
          <mesh key={x} position={[x, 0.7, waterSportsHut.d / 2 + 0.04]} castShadow>
            <torusGeometry args={[0.2, 0.06, 8, 18]} />
            <meshStandardMaterial color={x < 0 ? '#e2563b' : '#f2efe6'} />
          </mesh>
        ))}
        {['#f0b84a', '#4fb3a6', '#e2785b'].map((c, i) => (
          <Box
            key={c}
            p={[waterSportsHut.w / 2 + 0.25, 0.75, -0.5 + i * 0.4]}
            s={[0.08, 1.4, 0.3]}
            r={[0, 0, -0.12]}
            c={c}
          />
        ))}
      </group>
      {/* Jet skis */}
      <group ref={skis}>
        {jetSkiMoorings.map((_, i) => (
          <group key={i}>
            <Blob p={[0, 0.05, 0]} s={[0.42, 0.2, 1.05]} c={i ? '#f2c14e' : '#e2563b'} rough={0.4} />
            <Blob p={[0, 0.18, -0.15]} s={[0.24, 0.1, 0.5]} c="#2e3a3d" />
            <Box p={[0, 0.38, 0.38]} s={[0.12, 0.3, 0.12]} r={[-0.4, 0, 0]} c="#2e3a3d" />
            <Box p={[0, 0.52, 0.45]} s={[0.6, 0.05, 0.06]} c="#2e3a3d" />
            <Blob p={[0, 0.15, 0.62]} s={[0.25, 0.08, 0.3]} c="#f6f1e4" rough={0.4} />
          </group>
        ))}
      </group>
      {/* Sailboat */}
      <group ref={sailboat}>
        <Blob p={[0, 0, 0]} s={[0.75, 0.3, 1.9]} c="#f6f1e4" rough={0.5} />
        <Box p={[0, 0.2, -0.1]} s={[1.05, 0.06, 2.6]} c="#c8a374" />
        <Box p={[0, 0.32, -0.9]} s={[0.9, 0.18, 0.12]} c="#3c94b4" />
        <Cyl p={[0, 2.1, 0.45]} r={0.05} h={3.8} c="#e8e2d2" />
        <group ref={boom} position={[0, 0.85, 0.45]}>
          <Cyl p={[0, 0, -0.85]} r={0.04} h={1.7} c="#c8a374" rot={[Math.PI / 2, 0, 0]} />
          <Sail />
        </group>
        <Sail jib />
      </group>
      {/* Parasail tow boat, its chute and line */}
      <group ref={towBoat}>
        <Blob p={[0, 0, 0]} s={[0.7, 0.28, 1.6]} c="#f6f1e4" rough={0.5} />
        <Box p={[0, 0.2, -0.2]} s={[1, 0.06, 2.2]} c="#e9e4d6" />
        <Box p={[0, 0.5, 0.3]} s={[0.8, 0.5, 0.5]} c="#3d5a62" />
        <Box p={[0, 0.82, 0.3]} s={[0.9, 0.05, 0.7]} c="#f6f1e4" />
        <Cyl p={[0, 0.55, -1.25]} r={0.05} h={0.7} c="#8d8473" />
        <Box p={[0, 0.25, 1.1]} s={[0.5, 0.06, 0.3]} c="#e2563b" />
      </group>
      <group ref={chute} visible={false}>
        <mesh position={[0, 0.35, 0]} scale={[1.8, 0.85, 1.3]} raycast={ignore}>
          <sphereGeometry args={[1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#e2563b" side={THREE.DoubleSide} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.36, 0]} scale={[1.82, 0.86, 1.32]} raycast={ignore}>
          <sphereGeometry args={[1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 4]} />
          <meshStandardMaterial color="#f2c14e" side={THREE.DoubleSide} roughness={0.7} />
        </mesh>
        {[-1, 1].map(side => (
          <mesh key={side} position={[side * 0.85, -0.65, 0]} rotation={[0, 0, side * 0.55]} raycast={ignore}>
            <cylinderGeometry args={[0.01, 0.01, 2.2, 3]} />
            <meshBasicMaterial color="#f2efe6" />
          </mesh>
        ))}
      </group>
      <mesh ref={towLine} visible={false} raycast={ignore}>
        <cylinderGeometry args={[0.015, 0.015, 1, 4]} />
        <meshBasicMaterial color="#f2efe6" />
      </mesh>
      {['ky-0', 'ky-1', 'js-0', 'js-1', 'sb', 'pa-0'].map(id => (
        <Wake key={id} motion={motion} rider={() => (id === 'sb' ? sailor() : riders[id])} />
      ))}
    </group>
  );
}
// Foam trail behind a boat while someone rides it: puffs dropped at the stern spread and fade.
const PUFFS = 18;
function Wake({ motion, rider }: { motion: boolean; rider: () => RideView | undefined }) {
  const kind = useRef<RideView['kind']>('kayak');
  const puffs = useRef<THREE.Group>(null),
    trail = useRef(Array.from({ length: PUFFS }, () => ({ x: 0, z: 0, born: -10 }))),
    next = useRef(0),
    lastDrop = useRef(0);
  useFrame(({ clock }) => {
    const now = clock.elapsedTime,
      ride = rider();
    if (ride) kind.current = ride.kind;
    if (
      ride &&
      ride.t > 1.5 &&
      ride.y < 0.3 &&
      motion &&
      now - lastDrop.current > (ride.kind === 'jetski' ? 0.07 : 0.14)
    ) {
      lastDrop.current = now;
      const [x, z, heading] = ride.boat
        ? [ride.boat.x, ride.boat.z, ride.boat.heading]
        : [ride.x, ride.z, ride.heading];
      const back = ride.kind === 'kayak' ? 1.1 : 1.4;
      trail.current[next.current] = { x: x - Math.sin(heading) * back, z: z - Math.cos(heading) * back, born: now };
      next.current = (next.current + 1) % PUFFS;
    }
    puffs.current?.children.forEach((puff, i) => {
      const p = trail.current[i],
        age = now - p.born,
        life = kind.current === 'jetski' ? 1.3 : 2;
      puff.visible = age < life;
      if (!puff.visible) return;
      puff.position.set(p.x, WATER + 0.04, p.z);
      puff.scale.setScalar(0.25 + age * (kind.current === 'kayak' ? 0.3 : 0.65));
      ((puff as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - age / life);
    });
  });
  return (
    <group ref={puffs}>
      {Array.from({ length: PUFFS }, (_, i) => (
        <mesh key={i} visible={false} rotation={[-Math.PI / 2, 0, 0]} raycast={ignore}>
          <circleGeometry args={[1, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
function Sail({ jib = false }: { jib?: boolean }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape
      .moveTo(0, 0)
      .lineTo(0, jib ? 2.6 : 3.1)
      .lineTo(jib ? 1.05 : -1.6, 0)
      .closePath();
    return new THREE.ShapeGeometry(shape);
  }, [jib]);
  return (
    <mesh
      geometry={geometry}
      position={jib ? [0, 0.85, 0.5] : [0, 0.08, 0]}
      rotation={[0, -Math.PI / 2, 0]}
      castShadow
      raycast={ignore}
    >
      <meshStandardMaterial color={jib ? '#f2c14e' : '#fbf8ef'} side={THREE.DoubleSide} roughness={0.7} />
    </mesh>
  );
}

// A rock outcrop on the north shore: a leaning climbing face on the south side, a lookout on top.
function ClimbingBluff({ motion }: { motion: boolean }) {
  const rope = useRef<THREE.Mesh>(null);
  const a = useMemo(() => new THREE.Vector3(), []),
    b = useMemo(() => new THREE.Vector3(), []);
  const top = climbFaceZ(bluff.h);
  useFrame(() => {
    if (!rope.current) return;
    // The belay rope runs from the anchor at the top to whoever is climbing (or hangs down the face).
    a.set(bluff.x + 0.5, bluff.h + 0.4, top - 0.2);
    const ride = riders['cl-0'];
    if (ride && ride.y < bluff.h - 0.2) b.set(ride.x, ride.y + 0.9, ride.z - 0.15);
    else b.set(bluff.x + 0.55, 0.3, bluff.faceZ + 0.15);
    placeLine(rope.current, a, b);
    void motion;
  });
  const holds = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => {
        const y = 0.3 + (i / 34) * (bluff.h - 0.4);
        return {
          p: [bluff.x + Math.sin(i * 2.4) * 1.2, y, climbFaceZ(y) + 0.06] as V3,
          c: ['#e2563b', '#f2c14e', '#3c94b4', '#7cbf6a', '#b06ab3'][i % 5],
        };
      }),
    [],
  );
  const lean = Math.atan2(bluff.lean, bluff.h);
  return (
    <group name="climbing-bluff">
      {/* Rock mass */}
      {(
        [
          [0, 2.4, -0.4, 3.4, 3.4, 2.6],
          [-2.2, 1.5, 0.2, 1.9, 2.4, 2.2],
          [2.3, 1.8, 0, 1.8, 2.9, 2.2],
          [0.6, 4.8, -0.9, 2.6, 2.4, 2],
          [-1.6, 4.1, -0.6, 1.7, 2.1, 1.7],
          [1.2, -0.2, 1.4, 2.6, 1.1, 1.2],
        ] as const
      ).map(([x, y, z, sx, sy, sz], i) => (
        <mesh key={i} position={[bluff.x + x, y, bluff.z + z]} scale={[sx, sy, sz]} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={i % 2 ? '#a08c78' : '#b59a82'} roughness={0.95} flatShading />
        </mesh>
      ))}
      {/* Climbing face */}
      <mesh
        position={[bluff.x, bluff.h / 2, (bluff.faceZ + top) / 2 - 0.3]}
        rotation={[-lean, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[3.4, Math.hypot(bluff.h, bluff.lean) + 0.3, 0.6]} />
        <meshStandardMaterial color="#c4ab92" roughness={0.95} flatShading />
      </mesh>
      {holds.map((h, i) => (
        <mesh key={i} position={h.p} scale={[1.2, 0.8, 0.7]} raycast={ignore}>
          <dodecahedronGeometry args={[0.09, 0]} />
          <meshStandardMaterial color={h.c} roughness={0.6} />
        </mesh>
      ))}
      {/* Lookout on top: a deck, a rail and a bench */}
      <Box p={[bluff.x, bluff.h + 0.05, top - 1.2]} s={[3, 0.12, 2.2]} c="#b8946a" />
      {[-1.45, 1.45].map(x => (
        <Box key={x} p={[bluff.x + x, bluff.h + 0.45, top - 1.2]} s={[0.06, 0.7, 2.2]} c="#7d6447" />
      ))}
      <Box p={[bluff.x, bluff.h + 0.78, top - 2.28]} s={[3, 0.06, 0.06]} c="#7d6447" />
      <Box p={[bluff.x - 0.9, bluff.h + 0.4, top - 1.9]} s={[0.9, 0.08, 0.35]} c="#c7a57c" />
      <Cyl p={[bluff.x + 0.5, bluff.h + 0.25, top - 0.2]} r={0.06} h={0.4} c="#4a4a44" />
      <mesh ref={rope} raycast={ignore}>
        <cylinderGeometry args={[0.02, 0.02, 1, 4]} />
        <meshStandardMaterial color="#e2785b" />
      </mesh>
      {/* Crash mat at the foot of the wall */}
      <Box p={[bluff.x, 0.12, bluff.faceZ + 0.75]} s={[2.6, 0.12, 1]} c="#3c94b4" />
    </group>
  );
}

// The reef off the jetty: always faintly visible through the water, clear while you're diving.
function DiveSite({ motion }: { motion: boolean }) {
  const fish = useRef<THREE.Group>(null),
    turtle = useRef<THREE.Group>(null),
    bubbles = useRef<THREE.Group>(null),
    rays = useRef<THREE.Group>(null),
    buoy = useRef<THREE.Group>(null);
  const floor = -3.45;
  const corals = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const a = i * 2.39996,
          r = 1.2 + ((i * 37) % 11) * 0.42;
        return {
          x: reef.x + Math.cos(a) * r * 1.4,
          z: reef.z + Math.sin(a) * r,
          kind: i % 4,
          s: 0.5 + ((i * 13) % 7) * 0.12,
          c: ['#ef8a7a', '#f2c14e', '#b06ab3', '#f6a35c', '#7fd3c2'][i % 5],
        };
      }),
    [],
  );
  useFrame(({ clock }, dt) => {
    const t = motion ? clock.elapsedTime : 0;
    // A school of fish swirling round the reef, and a turtle on a slow lap.
    fish.current?.children.forEach((f, i) => {
      const a = t * 0.5 + (i / 14) * Math.PI * 2,
        r = 3 + Math.sin(i * 1.7) * 0.6;
      f.position.set(reef.x + Math.cos(a) * r * 1.3, -2.1 + Math.sin(a * 2 + i) * 0.25, reef.z + Math.sin(a) * r);
      f.rotation.y = -a;
    });
    if (turtle.current) {
      const a = -t * 0.12;
      turtle.current.position.set(
        reef.x + Math.cos(a) * 5.5,
        -2.6 + Math.sin(t * 0.5) * 0.15,
        reef.z + Math.sin(a) * 3.2,
      );
      turtle.current.rotation.y = -a + Math.PI;
    }
    const ride = riders['dv-0'],
      diving = !!ride && ride.y < -0.3;
    if (bubbles.current) {
      bubbles.current.visible = diving;
      bubbles.current.children.forEach((bubble, i) => {
        const age = (t * 0.7 + i / 6) % 1;
        if (!ride) return;
        bubble.position.set(ride.x + Math.sin(i * 3 + t) * 0.1, ride.y + 0.6 + age * Math.max(0.5, -ride.y), ride.z);
        bubble.scale.setScalar(0.6 + age * 0.8);
      });
    }
    rays.current?.children.forEach((r, i) => {
      const m = (r as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = THREE.MathUtils.damp(m.opacity, diving ? 0.12 + Math.sin(t * 0.8 + i) * 0.04 : 0, 2, dt);
      r.visible = m.opacity > 0.005;
    });
    if (buoy.current) buoy.current.position.y = WATER + Math.sin(t * 1.4) * 0.05;
  });
  return (
    <group name="dive-site">
      {/* Dive ladder off the jetty */}
      <group position={[jetty.x0 + 2, 0, jetty.z + 0.95]}>
        {[-0.25, 0.25].map(x => (
          <Cyl key={x} p={[x, -0.4, 0]} r={0.03} h={1.6} c="#c9c9c0" />
        ))}
        {[0, 0.3, 0.6].map(y => (
          <Cyl key={y} p={[0, -0.95 + y, 0]} r={0.025} h={0.5} c="#c9c9c0" rot={[0, 0, Math.PI / 2]} />
        ))}
      </group>
      {/* Dive buoy with a diver-down flag over the reef */}
      <group ref={buoy} position={[reef.x + 2.5, WATER, reef.z - 2.5]}>
        <Cyl p={[0, 0.1, 0]} r={0.3} h={0.3} c="#e2563b" r2={0.36} />
        <Cyl p={[0, 0.65, 0]} r={0.03} h={1} c="#e8e2d2" />
        <Box p={[0.22, 0.95, 0]} s={[0.42, 0.3, 0.02]} c="#d63a2f" />
        <Box p={[0.22, 0.95, 0.012]} s={[0.46, 0.05, 0.005]} r={[0, 0, -0.62]} c="#ffffff" />
      </group>
      {/* Reef: sand, rocks and coral */}
      <mesh
        position={[reef.x, floor + 0.02, reef.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[1.4, 1, 1]}
        raycast={ignore}
      >
        <circleGeometry args={[6.5, 32]} />
        <meshStandardMaterial color="#d9c79c" roughness={1} />
      </mesh>
      {corals.map((c, i) =>
        c.kind === 0 ? (
          <Blob key={i} p={[c.x, floor + 0.2 * c.s, c.z]} s={[0.45 * c.s, 0.3 * c.s, 0.4 * c.s]} c={c.c} />
        ) : c.kind === 1 ? (
          <group key={i} position={[c.x, floor, c.z]} scale={c.s}>
            {[-0.3, 0, 0.3].map(r => (
              <Cyl key={r} p={[r * 0.5, 0.35, 0]} r={0.05} r2={0.08} h={0.7} c={c.c} rot={[0, 0, r]} />
            ))}
          </group>
        ) : c.kind === 2 ? (
          <mesh key={i} position={[c.x, floor + 0.4 * c.s, c.z]} rotation={[0, i, 0]} raycast={ignore}>
            <circleGeometry args={[0.45 * c.s, 10, 0, Math.PI]} />
            <meshStandardMaterial color={c.c} side={THREE.DoubleSide} />
          </mesh>
        ) : (
          <mesh key={i} position={[c.x, floor + 0.25, c.z]} scale={[c.s, c.s * 0.6, c.s]} raycast={ignore}>
            <dodecahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial color="#8a8578" flatShading roughness={1} />
          </mesh>
        ),
      )}
      {/* A small sunken wreck */}
      <group position={[reef.x - 3.6, floor + 0.35, reef.z + 2]} rotation={[0.15, 0.7, 0.35]}>
        <Blob p={[0, 0, 0]} s={[0.8, 0.4, 2]} c="#6c5847" />
        <Box p={[0, 0.3, 0]} s={[1.3, 0.06, 3]} c="#7f6a55" />
        <Cyl p={[0, 1, 0.3]} r={0.06} h={1.6} c="#5b4a3b" rot={[0.4, 0, 0]} />
      </group>
      {/* Treasure chest by the wreck */}
      <group position={[reef.x - 2.2, floor + 0.15, reef.z + 3]} rotation={[0, 0.5, 0.1]}>
        <Box p={[0, 0, 0]} s={[0.5, 0.3, 0.35]} c="#8b5a2b" />
        <Box p={[0, 0.18, -0.06]} s={[0.5, 0.08, 0.3]} r={[-0.5, 0, 0]} c="#9c6a35" />
        <Blob p={[0, 0.12, 0.02]} s={[0.18, 0.06, 0.1]} c="#f2c14e" rough={0.3} />
      </group>
      <group ref={fish}>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i} rotation={[0, 0, 0]} raycast={ignore}>
            <coneGeometry args={[0.07, 0.28, 6]} />
            <meshStandardMaterial color={i % 3 ? '#f6a35c' : '#7fd3c2'} />
          </mesh>
        ))}
      </group>
      <group ref={turtle} scale={0.9}>
        <Blob p={[0, 0, 0]} s={[0.43, 0.2, 0.57]} c="#718a50" />
        <Blob p={[0, 0.1, 0]} s={[0.33, 0.16, 0.45]} c="#a2ad69" />
        <Blob p={[0, 0, 0.67]} s={[0.17, 0.12, 0.21]} c="#8ba878" />
        {[-1, 1].map(side => (
          <Blob key={side} p={[side * 0.5, -0.06, 0.15]} s={[0.36, 0.045, 0.17]} c="#8ba878" />
        ))}
      </group>
      <group ref={bubbles} visible={false}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} raycast={ignore}>
            <sphereGeometry args={[0.06, 8, 6]} />
            <meshBasicMaterial color="#e8fbff" transparent opacity={0.7} />
          </mesh>
        ))}
      </group>
      {/* Shafts of sunlight while you're down there */}
      <group ref={rays}>
        {[-3, -1, 1.5, 3.5].map((dx, i) => (
          <mesh
            key={i}
            visible={false}
            position={[reef.x + dx, -1.9, reef.z + (i % 2 ? 1 : -1)]}
            rotation={[0, 0.6, 0.25]}
            raycast={ignore}
          >
            <planeGeometry args={[0.8, 3.4]} />
            <meshBasicMaterial
              color="#fff8d8"
              transparent
              opacity={0}
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
