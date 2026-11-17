import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { chest, DIVE_AREA, SEABED, wreck } from './dive';
import { diveState, spot } from './fun-state';
import { Manta } from './sea-life';
import { StaticBatch } from './static-batch';
import { jetty, reef } from './world';

// Scuba diving: the underwater view (what the sea looks like once you're under), the shipwreck
// beyond the reef with its residents, and the dive shop on the jetty.
type V3 = [number, number, number];
const ignore = () => {};
const SURFACE = -0.4;
const WOOD = '#5f4b3a',
  WOOD_LIGHT = '#74604a',
  WOOD_MOSSY = '#55634a',
  IRON = '#3a4044';
function Box({ p, s, c, r = [0, 0, 0] }: { p: V3; s: V3; c: string; r?: V3 }) {
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow raycast={ignore}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={0.9} />
    </mesh>
  );
}
function Cyl({ p, r, h, c, r2, rot = [0, 0, 0] }: { p: V3; r: number; h: number; c: string; r2?: number; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow raycast={ignore}>
      <cylinderGeometry args={[r, r2 ?? r, h, 10]} />
      <meshStandardMaterial color={c} roughness={0.85} />
    </mesh>
  );
}
function Ball({ p, s, c, glow = 0 }: { p: V3; s: V3; c: string; glow?: number }) {
  return (
    <mesh position={p} scale={s} castShadow raycast={ignore}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshStandardMaterial color={c} roughness={0.5} emissive={c} emissiveIntensity={glow} />
    </mesh>
  );
}
const rand = (i: number, salt: number) => {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

export function DiveScene({ motion, night }: { motion: boolean; night: number }) {
  return (
    <>
      <UnderwaterView motion={motion} night={night} />
      <Wreck motion={motion} />
      <DiveShop />
    </>
  );
}

// Once you're under: the surface and everything above it drop away, and you get the seabed,
// shafts of sunlight and drifting specks instead.
const SHAFTS = 12,
  SPECKS = 320,
  DRIFT = 22;
function UnderwaterView({ motion, night }: { motion: boolean; night: number }) {
  const { gl, scene } = useThree();
  const group = useRef<THREE.Group>(null),
    shafts = useRef<THREE.Group>(null),
    specks = useRef<THREE.Points>(null),
    ripples = useRef<THREE.Group>(null),
    shown = useRef(false),
    elapsed = useRef(0);
  const cut = useMemo(() => [new THREE.Plane(new THREE.Vector3(0, -1, 0), SURFACE - 0.02)], []);
  const sand = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(96, 96, 72, 72).rotateX(-Math.PI / 2),
      position = geometry.attributes.position,
      colors = new Float32Array(position.count * 3),
      pale = new THREE.Color('#dccb9f'),
      dark = new THREE.Color('#b9a67c'),
      shade = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i),
        z = position.getZ(i),
        dune = Math.sin(x * 0.5 + Math.sin(z * 0.23) * 1.6) * 0.5 + Math.sin(z * 0.37 + x * 0.11) * 0.5;
      position.setY(i, dune * 0.045);
      shade.copy(dark).lerp(pale, 0.5 + dune * 0.35 + (rand(i, 1) - 0.5) * 0.25);
      shade.toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  // A net of light on the sand, like the sun through ripples.
  const light = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.filter = 'blur(1.6px)';
    // Wobbly cells, drawn so that the tile repeats.
    for (let i = 0; i < 46; i++) {
      const x = rand(i, 2) * 256,
        y = rand(i, 3) * 256,
        r = 14 + rand(i, 4) * 22;
      ctx.lineWidth = 1.4 + rand(i, 5) * 2;
      ctx.globalAlpha = 0.35 + rand(i, 6) * 0.4;
      for (const ox of [-256, 0, 256])
        for (const oy of [-256, 0, 256]) {
          ctx.beginPath();
          ctx.ellipse(x + ox, y + oy, r, r * (0.55 + rand(i, 7) * 0.5), rand(i, 8) * Math.PI, 0, Math.PI * 2);
          ctx.stroke();
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(11, 11);
    const second = texture.clone();
    second.needsUpdate = true;
    return [texture, second];
  }, []);
  const snow = useMemo(() => {
    const points = new Float32Array(SPECKS * 3);
    for (let i = 0; i < SPECKS; i++) points.set([rand(i, 9) * DRIFT, rand(i, 10), rand(i, 11) * DRIFT], i * 3);
    return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(points.slice(), 3));
  }, []);
  const seeds = useMemo(() => Float32Array.from({ length: SPECKS * 3 }, (_, i) => rand(i, 12)), []);
  useEffect(
    () => () => {
      gl.clippingPlanes = [];
      for (const name of ['ocean', 'ocean-far', 'ocean-floor']) {
        const water = scene.getObjectByName(name);
        if (water) water.visible = true;
      }
    },
    [gl, scene],
  );
  useFrame((_, dt) => {
    if (motion) elapsed.current += Math.min(dt, 0.05);
    const t = elapsed.current,
      under = diveState.under;
    if (under !== shown.current) {
      shown.current = under;
      gl.clippingPlanes = under ? cut : [];
      for (const name of ['ocean', 'ocean-far', 'ocean-floor']) {
        const water = scene.getObjectByName(name);
        if (water) water.visible = !under;
      }
      if (group.current) group.current.visible = under;
    }
    if (!under) return;
    const day = 1 - night,
      { x, z } = diveState;
    light[0].offset.set(t * 0.012, t * 0.008);
    light[1].offset.set(-t * 0.009 + 0.37, t * 0.011 + 0.61);
    ripples.current?.children.forEach(layer => {
      ((layer as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.05 + day * 0.2;
    });
    // Sunbeams stand in the water round you; each one stays put until you leave it behind.
    shafts.current?.children.forEach((shaft, i) => {
      const cell = 6.5,
        column = Math.round((x + ((i % 4) - 1.5) * cell) / cell),
        row = Math.round((z + (Math.floor(i / 4) - 1) * cell) / cell),
        seed = column * 12.9898 + row * 78.233,
        sx = (column + rand(seed, 13) - 0.5) * cell,
        sz = (row + rand(seed, 14) - 0.5) * cell,
        edge = Math.max(0, 1 - Math.hypot(sx - x, sz - z) / 13);
      shaft.position.set(sx, (SURFACE + SEABED) / 2, sz);
      shaft.rotation.set(0, rand(seed, 15) * Math.PI, 0.22);
      shaft.scale.x = 0.4 + rand(seed, 16) * 0.8;
      ((shaft as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
        day * edge * (0.05 + 0.03 * Math.sin(t * 0.7 + seed));
    });
    // Specks drift past and wrap round, so there are always some about you.
    if (specks.current) {
      const points = specks.current.geometry.attributes.position as THREE.BufferAttribute,
        wrap = (v: number, centre: number) =>
          centre + ((((v - centre + DRIFT / 2) % DRIFT) + DRIFT) % DRIFT) - DRIFT / 2;
      for (let i = 0; i < SPECKS; i++) {
        const sway = t * 0.12 + seeds[i * 3] * 6;
        points.setXYZ(
          i,
          wrap(seeds[i * 3] * DRIFT + Math.sin(sway) * 0.6 + t * 0.09, x),
          SEABED + 0.1 + ((seeds[i * 3 + 1] * 3 + t * 0.03 * (0.5 + seeds[i * 3 + 2])) % 3),
          wrap(seeds[i * 3 + 2] * DRIFT + Math.cos(sway * 0.8) * 0.6, z),
        );
      }
      points.needsUpdate = true;
      (specks.current.material as THREE.PointsMaterial).opacity = 0.25 + day * 0.4;
    }
  });
  return (
    <group ref={group} name="underwater" visible={false}>
      <mesh geometry={sand} position={[DIVE_AREA.x, SEABED - 0.06, DIVE_AREA.z]} receiveShadow raycast={ignore}>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <group ref={ripples}>
        {light.map((map, i) => (
          <mesh
            key={i}
            position={[DIVE_AREA.x, SEABED + 0.03 + i * 0.01, DIVE_AREA.z]}
            rotation={[-Math.PI / 2, 0, i * 0.6]}
            raycast={ignore}
          >
            <planeGeometry args={[96, 96]} />
            <meshBasicMaterial
              map={map}
              transparent
              opacity={0.2}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              color="#eaffe9"
            />
          </mesh>
        ))}
      </group>
      <group ref={shafts}>
        {Array.from({ length: SHAFTS }, (_, i) => (
          <mesh key={i} raycast={ignore}>
            <planeGeometry args={[1, SURFACE - SEABED + 0.4]} />
            <meshBasicMaterial
              color="#f4ffe4"
              transparent
              opacity={0}
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </group>
      <points ref={specks} geometry={snow} frustumCulled={false} raycast={ignore}>
        <pointsMaterial
          color="#e9fbff"
          size={2.2}
          sizeAttenuation={false}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

// The shipwreck: an old sailing ship on her side, ribs showing, with a school of silversides in
// the hold, a manta that patrols between here and the reef, and a chest that spilled out nearby.
const HULL = { length: 8.4, beam: 1.3, height: 1.25 };
const beamAt = (u: number) => Math.max(0.3, HULL.beam * Math.sqrt(1 - Math.abs(2 * u - 1) ** 2.6));
const SCHOOL = 18;
function Wreck({ motion }: { motion: boolean }) {
  const school = useRef<THREE.Group>(null),
    manta = useRef<THREE.Group>(null),
    kelp = useRef<THREE.Group>(null),
    buoy = useRef<THREE.Group>(null),
    gold = useRef<THREE.Mesh>(null),
    elapsed = useRef(0);
  const ribs = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const u = i / 9;
        return { z: (u - 0.5) * HULL.length, w: beamAt(u), broken: i === 3 || i === 6 };
      }),
    [],
  );
  const fronds = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const a = rand(i, 20) * Math.PI * 2,
          r = 3.4 + rand(i, 21) * 3.6;
        return { x: wreck.x + Math.cos(a) * r, z: wreck.z + Math.sin(a) * r * 0.8, h: 0.8 + rand(i, 22) * 0.8 };
      }),
    [],
  );
  useFrame((_, dt) => {
    if (motion) elapsed.current += Math.min(dt, 0.05);
    const t = elapsed.current;
    // Silversides mill about the hold, tightening up when you swim in close.
    const tight = diveState.under && Math.hypot(diveState.x - wreck.x, diveState.z - wreck.z) < 3.5 ? 0.7 : 1;
    school.current?.children.forEach((fish, i) => {
      const a = t * (0.45 + (i % 3) * 0.06) + (i / SCHOOL) * Math.PI * 2,
        r = (1.5 + (i % 4) * 0.35) * tight;
      fish.position.set(
        wreck.x + Math.cos(a) * r * 1.5,
        SEABED + 1.5 + Math.sin(a * 2 + i) * 0.35 + (i % 5) * 0.12,
        wreck.z + Math.sin(a) * r,
      );
      fish.rotation.y = Math.atan2(-Math.sin(a) * 1.5, Math.cos(a));
    });
    spot('school', wreck.x, wreck.z);
    spot('wreck', wreck.x, wreck.z);
    spot('reef', reef.x, reef.z);
    spot('chest', chest[0], chest[1]);
    // The manta glides a long figure of eight that takes in both the reef and the wreck.
    if (manta.current) {
      const at = (time: number): [number, number] => {
        const a = time * 0.085;
        return [DIVE_AREA.x + 1.5 + Math.cos(a) * 12.5, DIVE_AREA.z + Math.sin(a * 2) * 5];
      };
      const [x, z] = at(t),
        [nx, nz] = at(t + 0.4);
      manta.current.position.set(x, SEABED + 1.9 + Math.sin(t * 0.3) * 0.35, z);
      manta.current.rotation.y = Math.atan2(nx - x, nz - z);
      manta.current.traverse(part => {
        if (part.name === 'manta-wing')
          part.rotation.z =
            Math.sin(t * 1.5) *
            0.26 *
            ((part.children[0] as THREE.Mesh).geometry.attributes.position.getX(1) > 0 ? 1 : -1);
      });
      spot('ray', x, z);
    }
    kelp.current?.children.forEach((frond, i) => {
      frond.rotation.z = Math.sin(t * 0.7 + i) * 0.16;
      frond.rotation.x = Math.cos(t * 0.5 + i * 2) * 0.1;
    });
    if (buoy.current) buoy.current.position.y = SURFACE + Math.sin(t * 1.3 + 1) * 0.05;
    if (gold.current)
      (gold.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.sin(t * 2.2) * 0.25;
  });
  return (
    <>
      <StaticBatch name="wreck">
        <group position={[wreck.x, SEABED, wreck.z]} rotation={[0, wreck.heading, 0]}>
          {/* The hull lies over on her starboard side. */}
          <group rotation={[0.04, 0, -0.3]}>
            <Box p={[0, 0.06, 0]} s={[0.18, 0.16, HULL.length + 0.3]} c={WOOD} />
            {ribs.map((rib, i) => (
              <mesh
                key={i}
                position={[0, HULL.height + 0.06, rib.z]}
                rotation={[0, 0, Math.PI]}
                scale={[1, HULL.height / rib.w, 1]}
                castShadow
                raycast={ignore}
              >
                <torusGeometry args={[rib.w, 0.065, 5, 12, rib.broken ? Math.PI * 0.62 : Math.PI]} />
                <meshStandardMaterial color={i % 3 ? WOOD : WOOD_MOSSY} roughness={0.95} />
              </mesh>
            ))}
            {/* Stem and stern posts */}
            <Box p={[0, 0.95, HULL.length / 2 + 0.25]} s={[0.16, 2, 0.16]} r={[0.4, 0, 0]} c={WOOD} />
            <Box p={[0, 0.85, -HULL.length / 2 - 0.1]} s={[0.16, 1.7, 0.16]} r={[-0.12, 0, 0]} c={WOOD} />
            {/* What's left of the planking: most of the port side, a little of the starboard quarter. */}
            {[0.42, 0.72, 1.02].map((y, i) => (
              <Box
                key={y}
                p={[-(0.82 + i * 0.22), y, -0.3 + i * 0.3]}
                s={[0.05, 0.24, 5.4 - i * 0.7]}
                r={[0, 0, 0.45 - i * 0.16]}
                c={i === 1 ? WOOD_MOSSY : WOOD_LIGHT}
              />
            ))}
            <Box p={[1.2, 0.95, -2.1]} s={[0.05, 0.5, 2.6]} r={[0, 0, -0.12]} c={WOOD_LIGHT} />
            <Box p={[1.05, 0.5, 1.6]} s={[0.05, 0.24, 2.2]} r={[0, 0, -0.4]} c={WOOD_MOSSY} />
            {/* Deck beams, and the bit of deck that's still there aft */}
            {[1, 4, 5, 8].map(i => (
              <Box key={i} p={[0, HULL.height, ribs[i].z]} s={[ribs[i].w * 2, 0.09, 0.14]} c={WOOD_LIGHT} />
            ))}
            <Box p={[0, HULL.height + 0.06, -2.7]} s={[2.1, 0.06, 2.3]} c={WOOD_LIGHT} />
            {/* The stern cabin, half gone */}
            <Box p={[0, HULL.height + 0.5, -3.8]} s={[1.9, 0.85, 0.08]} c={WOOD} />
            <Box p={[-0.95, HULL.height + 0.45, -3.1]} s={[0.08, 0.75, 1.4]} c={WOOD} />
            <Box p={[-0.3, HULL.height + 0.95, -3.2]} s={[1.3, 0.06, 1.3]} r={[0, 0, 0.14]} c={WOOD_MOSSY} />
            {/* Mast stump, a cannon and its shot */}
            <Cyl p={[0, HULL.height + 0.6, 0.7]} r={0.1} r2={0.13} h={1.3} c={WOOD} rot={[0.1, 0, 0.08]} />
            <Cyl p={[-0.45, HULL.height + 0.22, -2.3]} r={0.1} r2={0.14} h={1.1} c={IRON} rot={[0, 0, Math.PI / 2]} />
            {[0, 1, 2].map(i => (
              <Ball
                key={i}
                p={[0.35 + i * 0.2, HULL.height + 0.17, -1.9 - (i % 2) * 0.18]}
                s={[0.08, 0.08, 0.08]}
                c={IRON}
              />
            ))}
          </group>
          {/* The top of the mast came down alongside, crow's nest and yard and all. */}
          <group position={[-2.6, 0.14, 1.4]} rotation={[0, 0.5, 0]}>
            <Cyl p={[0, 0, 0]} r={0.075} r2={0.1} h={4.6} c={WOOD} rot={[Math.PI / 2, 0, 0]} />
            <Cyl p={[0, 0.02, 1.2]} r={0.045} h={2.6} c={WOOD_LIGHT} rot={[0, 0, Math.PI / 2 - 0.1]} />
            <Cyl p={[0, 0.1, -1.5]} r={0.3} r2={0.24} h={0.34} c={WOOD_LIGHT} rot={[Math.PI / 2, 0, 0]} />
          </group>
          {/* Anchor off the bow */}
          <group position={[1.9, 0.12, 5]} rotation={[Math.PI / 2 - 0.2, 0, 0.6]}>
            <Cyl p={[0, 0, 0]} r={0.05} h={1.3} c={IRON} />
            <Cyl p={[0, 0.6, 0]} r={0.04} h={0.8} c={IRON} rot={[Math.PI / 2, 0, 0]} />
            <mesh position={[0, -0.33, 0]} rotation={[0, 0, Math.PI]} raycast={ignore}>
              <torusGeometry args={[0.36, 0.05, 5, 10, Math.PI]} />
              <meshStandardMaterial color={IRON} roughness={0.85} />
            </mesh>
          </group>
          {/* Barrels that rolled out of the hold */}
          <Cyl p={[2.5, 0.26, -1.2]} r={0.24} h={0.52} c={WOOD_LIGHT} />
          <Cyl p={[3, 0.22, -0.5]} r={0.22} h={0.5} c={WOOD} rot={[Math.PI / 2, 0.4, 0]} />
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1.5, 1]} raycast={ignore}>
            <circleGeometry args={[4.6, 28]} />
            <meshStandardMaterial color="#cdbb90" roughness={1} />
          </mesh>
        </group>
        {/* The chest, lid open */}
        <group position={[chest[0], SEABED + 0.17, chest[1]]} rotation={[0, -0.6, 0.06]}>
          <Box p={[0, 0, 0]} s={[0.62, 0.34, 0.42]} c="#8b5a2b" />
          <Box p={[0, 0.3, -0.24]} s={[0.62, 0.08, 0.4]} r={[-1.1, 0, 0]} c="#9c6a35" />
          {[-0.24, 0.24].map(x => (
            <Box key={x} p={[x, 0, 0]} s={[0.05, 0.36, 0.44]} c="#c9a24a" />
          ))}
          {[0, 1, 2, 3].map(i => (
            <Ball
              key={i}
              p={[0.4 + i * 0.13, -0.14, 0.2 - (i % 2) * 0.22]}
              s={[0.05, 0.015, 0.05]}
              c="#f2c14e"
              glow={0.4}
            />
          ))}
        </group>
      </StaticBatch>
      <mesh ref={gold} position={[chest[0], SEABED + 0.33, chest[1]]} scale={[0.24, 0.08, 0.15]} raycast={ignore}>
        <sphereGeometry args={[1, 10, 6]} />
        <meshStandardMaterial color="#f2c14e" roughness={0.3} emissive="#f2a81e" emissiveIntensity={0.5} />
      </mesh>
      <group ref={kelp}>
        {fronds.map((frond, i) => (
          <group key={i} position={[frond.x, SEABED, frond.z]}>
            {[0, 1, 2].map(n => (
              <mesh
                key={n}
                position={[(n - 1) * 0.14, frond.h * (0.5 - n * 0.06), 0]}
                rotation={[0, n, 0]}
                raycast={ignore}
              >
                <planeGeometry args={[0.09, frond.h * (1 - n * 0.12), 1, 3]} />
                <meshStandardMaterial color={n % 2 ? '#4f8a4a' : '#3f7a52'} side={THREE.DoubleSide} roughness={0.9} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      <group ref={school}>
        {Array.from({ length: SCHOOL }, (_, i) => (
          <mesh key={i} scale={[0.07, 0.11, 0.3]} raycast={ignore}>
            <sphereGeometry args={[1, 7, 5]} />
            <meshStandardMaterial color={i % 4 ? '#c8dde2' : '#eef7f4'} roughness={0.35} metalness={0.3} />
          </mesh>
        ))}
      </group>
      <group ref={manta} scale={1.7}>
        <Manta />
      </group>
      {/* A second marker buoy over the wreck */}
      <group ref={buoy} position={[wreck.x + 1.5, SURFACE, wreck.z - 3]}>
        <Cyl p={[0, 0.1, 0]} r={0.3} h={0.3} c="#f0b53a" r2={0.36} />
        <Cyl p={[0, 0.65, 0]} r={0.03} h={1} c="#e8e2d2" />
        <Box p={[0.22, 0.95, 0]} s={[0.42, 0.3, 0.02]} c="#d63a2f" />
        <Box p={[0.22, 0.95, 0.012]} s={[0.46, 0.05, 0.005]} r={[0, 0, -0.62]} c="#ffffff" />
      </group>
    </>
  );
}

// The dive shop: a little deck off the side of the jetty by the ladder, with tanks, wetsuits and fins.
function DiveShop() {
  const x = jetty.x0 + 4.1,
    z = jetty.z + jetty.w / 2 + 0.6;
  const sign = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1f6f8f';
    ctx.fillRect(0, 0, 256, 80);
    ctx.fillStyle = '#d63a2f';
    ctx.fillRect(12, 16, 62, 48);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(12, 16);
    ctx.lineTo(74, 64);
    ctx.stroke();
    ctx.fillStyle = '#fdf6e3';
    ctx.font = '700 34px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('DIVE SHOP', 86, 42);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
  return (
    <StaticBatch name="dive-shop">
      <group position={[x, 0, z]}>
        <Box p={[0, 0.08, 0]} s={[2.2, 0.12, 1.2]} c="#b8946a" />
        {[-0.95, 0.95].map(dx => (
          <Cyl key={dx} p={[dx, -0.3, 0.5]} r={0.07} h={1} c="#8a6c4a" />
        ))}
        {/* Awning */}
        {[-1, 1].flatMap(dx =>
          [-0.5, 0.5].map(dz => <Cyl key={`${dx}${dz}`} p={[dx, 0.95, dz]} r={0.04} h={1.7} c="#e8e2d2" />),
        )}
        {[-0.8, -0.4, 0, 0.4, 0.8].map((dx, i) => (
          <Box key={dx} p={[dx, 1.84, 0]} s={[0.4, 0.05, 1.3]} r={[0.12, 0, 0]} c={i % 2 ? '#f4efe2' : '#2a86a8'} />
        ))}
        {/* Tank rack */}
        <Box p={[-0.45, 0.36, 0.42]} s={[1.1, 0.05, 0.26]} c="#8a6c4a" />
        {['#f0c63c', '#f0c63c', '#3f9ec4', '#e2563b'].map((c, i) => (
          <mesh key={i} position={[-0.84 + i * 0.26, 0.45, 0.42]} castShadow raycast={ignore}>
            <capsuleGeometry args={[0.085, 0.36, 4, 10]} />
            <meshStandardMaterial color={c} roughness={0.45} metalness={0.2} />
          </mesh>
        ))}
        {/* Wetsuits on a rail, fins against the post */}
        <Cyl p={[0.55, 1.35, 0.42]} r={0.02} h={0.9} c="#c9c9c0" rot={[0, 0, Math.PI / 2]} />
        {[0.3, 0.6, 0.86].map((dx, i) => (
          <group key={dx} position={[dx, 0.95, 0.42]}>
            <Box p={[0, 0, 0]} s={[0.2, 0.7, 0.07]} c={['#22303a', '#2d4a5c', '#22303a'][i]} />
            <Box p={[0, 0.2, 0.01]} s={[0.21, 0.08, 0.075]} c={['#e2563b', '#f0c63c', '#3f9ec4'][i]} />
          </group>
        ))}
        {[0, 1].map(i => (
          <Box
            key={i}
            p={[0.72 + i * 0.14, 0.35, -0.44]}
            s={[0.12, 0.5, 0.03]}
            r={[0.2, 0, 0.1 - i * 0.2]}
            c="#2d7fb8"
          />
        ))}
        <mesh position={[0, 1.55, -0.55]} rotation={[0, Math.PI, 0]} raycast={ignore}>
          <planeGeometry args={[1.5, 0.47]} />
          <meshStandardMaterial map={sign} side={THREE.DoubleSide} roughness={0.8} />
        </mesh>
      </group>
    </StaticBatch>
  );
}
