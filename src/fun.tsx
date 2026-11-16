import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Period } from './daylight';
import { cameraView } from './camera-view';
import { kayakRide } from './fun-state';
import { Label } from './label';
import { peopleView } from './people';
import { hammockSway } from './poses';
import {
  cornhole,
  firepit,
  gamesLawn,
  hammocks,
  jetty,
  kayakMoorings,
  piano,
  pingPong,
  radio,
  ROOF_Y,
  roofStair,
  seats,
  telescope,
  townhallScreen,
  type Point,
} from './world';

// Props for the fun and relaxing spots: games lawn, firepit and hammocks, fishing jetty and kayaks,
// piano and café radio, telescope, rooftop terrace and the town hall screen.
type V3 = [number, number, number];
const ignore = () => {};
function Box({ p, s, c, r = 0, shadow = true }: { p: V3; s: V3; c: string; r?: number; shadow?: boolean }) {
  return (
    <mesh position={p} rotation={[0, r, 0]} castShadow={shadow} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={0.85} />
    </mesh>
  );
}
function Cyl({ p, r, h, c, r2, seg = 14 }: { p: V3; r: number; h: number; c: string; r2?: number; seg?: number }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <cylinderGeometry args={[r, r2 ?? r, h, seg]} />
      <meshStandardMaterial color={c} roughness={0.85} />
    </mesh>
  );
}
const seatPoint = (id: string) => seats.find(s => s.id === id)!.point;
// Someone (you, or a coworker who has arrived) is using this seat.
function occupied(id: string, playerSeat: string | null) {
  if (playerSeat === id) return true;
  const [x, z] = seatPoint(id);
  return Object.values(peopleView).some(p => p.present && Math.hypot(p.x - x, p.z - z) < 0.3);
}

function GamesLawn({ playerSeat, motion }: { playerSeat: string | null; motion: boolean }) {
  const ball = useRef<THREE.Mesh>(null),
    clock = useRef(0);
  useFrame((_, dt) => {
    if (!ball.current) return;
    const playing = occupied('pp-0', playerSeat) || occupied('pp-1', playerSeat);
    ball.current.visible = playing;
    if (!playing) return;
    if (motion) clock.current += Math.min(dt, 0.05);
    // Rally back and forth with a bounce on each half of the table.
    const t = (clock.current * 0.9) % 2,
      leg = t < 1 ? t : 2 - t,
      x = pingPong.x - pingPong.w / 2 - 0.3 + leg * (pingPong.w + 0.6),
      hop = Math.abs(Math.sin(leg * Math.PI * 2));
    ball.current.position.set(x, 0.83 + hop * 0.35, pingPong.z + Math.sin(clock.current * 1.7) * 0.25);
  });
  return (
    <group name="games-lawn">
      <mesh position={[gamesLawn.x, 0.112, gamesLawn.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={ignore}>
        <planeGeometry args={[gamesLawn.w, gamesLawn.d]} />
        <meshStandardMaterial color="#9cc27f" roughness={0.95} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh
          key={i}
          position={[gamesLawn.x - gamesLawn.w / 2 + (i + 0.5) * (gamesLawn.w / 6), 0.114, gamesLawn.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={ignore}
        >
          <planeGeometry args={[gamesLawn.w / 12, gamesLawn.d]} />
          <meshStandardMaterial color="#a8cc8b" roughness={0.95} />
        </mesh>
      ))}
      {/* Ping-pong table */}
      <Box p={[pingPong.x, 0.76, pingPong.z]} s={[pingPong.w, 0.06, pingPong.d]} c="#3f7d6c" />
      <Box p={[pingPong.x, 0.795, pingPong.z]} s={[pingPong.w, 0.012, 0.03]} c="#f2f2ea" shadow={false} />
      <Box p={[pingPong.x, 0.86, pingPong.z]} s={[0.03, 0.15, pingPong.d + 0.1]} c="#f2f2ea" shadow={false} />
      {[-1, 1].map(sx =>
        [-1, 1].map(sz => (
          <Box
            key={`${sx}${sz}`}
            p={[pingPong.x + sx * (pingPong.w / 2 - 0.15), 0.37, pingPong.z + sz * (pingPong.d / 2 - 0.1)]}
            s={[0.06, 0.74, 0.06]}
            c="#5d6b63"
          />
        )),
      )}
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshStandardMaterial color="#fff6e0" emissive="#ffb24d" emissiveIntensity={0.2} />
      </mesh>
      {/* Cornhole boards, facing each other, with bean bags */}
      {cornhole.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, i ? Math.PI : 0, 0]}>
          <mesh position={[0, 0.28, 0]} rotation={[-0.3, 0, 0]} castShadow>
            <boxGeometry args={[0.7, 0.06, 1.3]} />
            <meshStandardMaterial color="#d9b389" />
          </mesh>
          <mesh position={[0, 0.39, -0.32]} rotation={[-0.3 - Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.12, 16]} />
            <meshBasicMaterial color="#2a2a24" />
          </mesh>
          {[0, 1].map(n => (
            <Box
              key={n}
              p={[-0.15 + n * 0.32, 0.36 - n * 0.08, 0.1 + n * 0.25]}
              s={[0.16, 0.05, 0.16]}
              c={n ? '#d9815f' : '#5b8fb0'}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

function Firepit({ night, motion }: { night: number; motion: boolean }) {
  const flames = useRef<THREE.Group>(null),
    glow = useMemo(
      () => new THREE.MeshStandardMaterial({ color: '#ffb35c', emissive: '#ff8a3d', emissiveIntensity: 1 }),
      [],
    );
  useFrame(({ clock }) => {
    const t = motion ? clock.elapsedTime : 0;
    glow.emissiveIntensity = 0.8 + night * 2 + Math.sin(t * 9) * 0.15;
    flames.current?.children.forEach((flame, i) => {
      flame.scale.y = 1 + Math.sin(t * (6 + i) + i) * 0.18;
      flame.rotation.y = t * 0.6 + i;
    });
  });
  return (
    <group name="firepit" position={[firepit.x, 0, firepit.z]}>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.62, 0.17, Math.sin(a) * 0.62]} scale={[0.2, 0.15, 0.2]} castShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#9a9488" flatShading />
          </mesh>
        );
      })}
      {[0, 1, 2].map(i => (
        <Box key={i} p={[0, 0.2 + i * 0.05, 0]} s={[0.75, 0.11, 0.11]} c="#7a5c42" r={i * 1.05} />
      ))}
      <group ref={flames} position={[0, 0.32, 0]}>
        {[0, 1, 2].map(i => (
          <mesh
            key={i}
            position={[Math.cos(i * 2.1) * 0.08, 0.2, Math.sin(i * 2.1) * 0.08]}
            material={glow}
            raycast={ignore}
          >
            <coneGeometry args={[0.16 - i * 0.03, 0.55 - i * 0.08, 7]} />
          </mesh>
        ))}
      </group>
      {/* Marshmallow sticks leaning on the stones */}
      {[0.6, 2.4].map(a => (
        <group key={a} position={[Math.cos(a) * 0.75, 0.32, Math.sin(a) * 0.75]} rotation={[0, -a, 0.9]}>
          <Cyl p={[0, 0.3, 0]} r={0.012} h={0.7} c="#b5966b" seg={5} />
          <Box p={[0, 0.68, 0]} s={[0.06, 0.08, 0.06]} c="#fff7ec" shadow={false} />
        </group>
      ))}
    </group>
  );
}

function Hammock({ x, z, motion }: { x: number; z: number; motion: boolean }) {
  const swing = useRef<THREE.Group>(null);
  // Fabric sags between the posts: short slats along a gentle curve.
  const slats = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const t = i / 8 - 0.5;
        return { z: t * 2, y: 0.95 - (1 - (2 * t) ** 2) * 0.3 };
      }),
    [],
  );
  useFrame(() => {
    if (swing.current) swing.current.rotation.z = motion ? hammockSway(performance.now() / 1000) : 0;
  });
  return (
    <group position={[x, 0, z]} name="hammock">
      {[-1.15, 1.15].map(dz => (
        <Cyl key={dz} p={[0, 0.65, dz]} r={0.06} h={1.3} c="#9c7f5c" />
      ))}
      <group ref={swing} position={[0, 1.25, 0]}>
        {slats.map((s, i) => (
          <mesh key={i} position={[0, s.y - 1.25, s.z]} castShadow>
            <boxGeometry args={[0.75, 0.03, 0.26]} />
            <meshStandardMaterial color={i % 2 ? '#e7a98f' : '#f3dcc3'} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Jetty({ playerSeat, motion }: { playerSeat: string | null; motion: boolean }) {
  const bobbers = useRef<THREE.Group>(null),
    kayaks = useRef<THREE.Group>(null);
  const length = jetty.x1 - jetty.x0,
    mid = (jetty.x0 + jetty.x1) / 2;
  useFrame(({ clock }) => {
    const t = motion ? clock.elapsedTime : 0;
    bobbers.current?.children.forEach((rod, i) => {
      rod.visible = occupied(`fs-${i}`, playerSeat);
      const bob = rod.children.at(-1);
      if (bob) bob.position.y = -0.52 + Math.sin(t * 2.2 + i) * 0.04 + (Math.sin(t * 0.7 + i * 3) > 0.96 ? -0.08 : 0);
    });
    kayaks.current?.children.forEach((kayak, i) => {
      if (kayakRide.index === i) {
        kayak.position.set(kayakRide.x, -0.32, kayakRide.z);
        kayak.rotation.set(0, kayakRide.heading, Math.sin(t * 1.4) * 0.05);
      } else {
        const [mx, mz] = kayakMoorings[i];
        kayak.position.set(mx, -0.32 + Math.sin(t * 1.2 + i) * 0.02, mz);
        kayak.rotation.set(0, -Math.PI / 2, Math.sin(t * 1.3 + i) * 0.03);
      }
    });
  });
  return (
    <group name="jetty">
      <Box p={[mid, 0.08, jetty.z]} s={[length, 0.12, jetty.w]} c="#b8946a" />
      {Array.from({ length: Math.floor(length / 0.45) }, (_, i) => (
        <Box
          key={i}
          p={[jetty.x0 + 0.2 + i * 0.45, 0.145, jetty.z]}
          s={[0.04, 0.012, jetty.w]}
          c="#9c7a54"
          shadow={false}
        />
      ))}
      {Array.from({ length: 5 }, (_, i) =>
        [-1, 1].map(side => (
          <Cyl
            key={`${i}${side}`}
            p={[jetty.x0 + 0.2 + i * (length / 4.3), -0.25, jetty.z + side * (jetty.w / 2 - 0.08)]}
            r={0.08}
            h={0.9}
            c="#7d6447"
          />
        )),
      )}
      <group ref={bobbers}>
        {[-0.45, 0.45].map((dz, i) => (
          <group key={i} position={[jetty.x0 + 0.35, 0.55, jetty.z + dz]} rotation={[0, 0, 0.5]}>
            <Cyl p={[-0.6, 0.35, 0]} r={0.015} h={1.6} c="#5a4632" seg={5} />
            <mesh position={[-1.35, -0.05, 0]} raycast={ignore}>
              <cylinderGeometry args={[0.004, 0.004, 1.1, 3]} />
              <meshBasicMaterial color="#e8e8e0" />
            </mesh>
            <mesh position={[-1.4, -0.52, 0]} raycast={ignore}>
              <sphereGeometry args={[0.05, 8, 6]} />
              <meshStandardMaterial color="#e2563b" />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={kayaks}>
        {kayakMoorings.map((_, i) => (
          <group key={i}>
            <mesh scale={[0.32, 0.16, 1.25]} castShadow>
              <sphereGeometry args={[1, 16, 10]} />
              <meshStandardMaterial color={i ? '#e8a23d' : '#d9644a'} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.1, 0.05]} scale={[0.17, 0.05, 0.3]}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color="#2f3b3a" />
            </mesh>
            <group position={[0, 0.2, -0.2]} rotation={[0, 0, Math.PI / 2 - 0.3]}>
              <Cyl p={[0, 0, 0]} r={0.02} h={1.6} c="#3a3a33" seg={5} />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

function Piano({ playing }: { playing: boolean }) {
  return (
    <group name="piano" position={[piano.x, 0, piano.z]}>
      <Box p={[0, 0.65, -0.1]} s={[piano.w, 1.3, 0.4]} c="#3b2f2b" />
      <Box p={[0, 0.78, 0.18]} s={[piano.w, 0.06, 0.32]} c="#3b2f2b" />
      <Box p={[0, 0.82, 0.2]} s={[piano.w - 0.12, 0.025, 0.22]} c="#f7f3ea" shadow={false} />
      {Array.from({ length: 10 }, (_, i) =>
        i % 7 === 2 || i % 7 === 6 ? null : (
          <Box key={i} p={[-0.6 + i * 0.135, 0.84, 0.15]} s={[0.06, 0.02, 0.12]} c="#1f1b19" shadow={false} />
        ),
      )}
      <Box p={[0, 1.15, 0.12]} s={[0.6, 0.35, 0.03]} c="#f2ead8" shadow={false} />
      {[-0.68, 0.68].map(x => (
        <Box key={x} p={[x, 0.3, 0.22]} s={[0.06, 0.6, 0.06]} c="#3b2f2b" />
      ))}
      {playing && (
        <Label position={[0, 1.7, 0]} zIndex={12}>
          <div className="music-notes" aria-hidden="true">
            <span>♪</span>
            <span>♫</span>
            <span>♪</span>
          </div>
        </Label>
      )}
    </group>
  );
}

function Radio({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  // The label only shows when the camera is near the café (or the radio is playing).
  const [near, setNear] = useState(false);
  useFrame(() => {
    const [fx, fz] = cameraView.focus,
      close = Math.hypot(fx - radio[0], fz - radio[1]) < 8;
    if (close !== near) setNear(close);
  });
  return (
    <group
      name="radio"
      position={[radio[0], 1.03, radio[1]]}
      onClick={e => {
        e.stopPropagation();
        if (e.delta < 6) onToggle();
      }}
      onPointerOver={e => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <Box p={[0, 0.14, 0]} s={[0.5, 0.28, 0.2]} c="#c97d5d" />
      <mesh position={[-0.1, 0.14, 0.105]}>
        <circleGeometry args={[0.08, 16]} />
        <meshStandardMaterial color="#3a2f2a" emissive="#ffcf87" emissiveIntensity={on ? 0.6 : 0} />
      </mesh>
      <Box p={[0.14, 0.18, 0.105]} s={[0.12, 0.04, 0.01]} c={on ? '#ffe6a8' : '#e8dccb'} shadow={false} />
      <Cyl p={[0.18, 0.4, -0.05]} r={0.008} h={0.3} c="#8a8a80" seg={4} />
      {(near || on) && (
        <Label position={[0, 0.65, 0]} zIndex={12}>
          <div className={on ? 'radio-tag on' : 'radio-tag'}>
            {on ? '♫ Lo-fi on · click to stop' : '📻 Click for lo-fi'}
          </div>
        </Label>
      )}
    </group>
  );
}

function Telescope({ onLook }: { onLook: () => void }) {
  return (
    <group
      name="telescope"
      position={[telescope[0], 0.22, telescope[1]]}
      onClick={e => {
        e.stopPropagation();
        if (e.delta < 6) onLook();
      }}
      onPointerOver={e => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      {[0, 1, 2].map(i => (
        <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0.28]}>
          <Cyl p={[0, 0.55, 0]} r={0.025} h={1.1} c="#5d6b63" seg={6} />
        </group>
      ))}
      <group position={[0, 1.15, 0]} rotation={[0.9, 0.5, 0]}>
        <Cyl p={[0, 0.2, 0]} r={0.09} r2={0.11} h={0.9} c="#e9e3d2" />
        <Cyl p={[0, 0.67, 0]} r={0.12} h={0.06} c="#3d5650" />
      </group>
    </group>
  );
}

// Deck, railing, planters and an umbrella on the west half of the workspace's green roof,
// with an outdoor stair down its west wall.
function RoofTerrace() {
  const top = ROOF_Y;
  const steps = 12,
    rise = top / steps,
    run = (roofStair.z1 - roofStair.z0) / steps;
  return (
    <group name="roof-terrace">
      <Box p={[-6.4, top - 0.02, -28.43]} s={[6.6, 0.06, 5.6]} c="#c9a87e" />
      {[-9.7, -3.1].map(x => (
        <Box key={x} p={[x, top + 0.45, -28.43]} s={[0.05, 0.9, 5.6]} c="#d9d2c0" />
      ))}
      <Box p={[-6.4, top + 0.45, -31.23]} s={[6.6, 0.9, 0.05]} c="#d9d2c0" />
      <Box p={[-6.4, top + 0.88, -25.63]} s={[6.6, 0.05, 0.05]} c="#d9d2c0" />
      {[
        [-9.2, -26.13],
        [-3.6, -26.13],
      ].map(([x, z]) => (
        <group key={x} position={[x, top, z]}>
          <Box p={[0, 0.25, 0]} s={[0.6, 0.5, 0.6]} c="#cfc6b0" />
          <mesh position={[0, 0.85, 0]} castShadow>
            <icosahedronGeometry args={[0.45, 1]} />
            <meshStandardMaterial color="#7b9c79" flatShading />
          </mesh>
        </group>
      ))}
      <Cyl p={[-6.4, top + 1, -26.83]} r={0.03} h={2} c="#e9e2cc" seg={6} />
      <mesh position={[-6.4, top + 2.05, -26.83]} castShadow>
        <coneGeometry args={[1.3, 0.45, 10]} />
        <meshStandardMaterial color="#e8a27f" />
      </mesh>
      {/* Stair: steps rise from the foot (south) to the roof (north) */}
      {Array.from({ length: steps }, (_, i) => (
        <Box
          key={i}
          p={[roofStair.x, rise * (i + 0.5), roofStair.z1 - run * (i + 0.5)]}
          s={[roofStair.w, rise, run + 0.02]}
          c={i % 2 ? '#d9d2c0' : '#e3ddcb'}
        />
      ))}
      <Box
        p={[roofStair.x - roofStair.w / 2 - 0.03, top / 2 + 0.45, (roofStair.z0 + roofStair.z1) / 2]}
        s={[0.04, 0.05, roofStair.z1 - roofStair.z0]}
        c="#8a8a80"
        r={0}
      />
    </group>
  );
}

// Town hall screen: a team quiz at golden hour, movie night at dusk and night, the schedule otherwise.
const quiz: [string, string[], number][] = [
  ['How many hearts does an octopus have?', ['One', 'Two', 'Three'], 2],
  ['What is a group of flamingos called?', ['A flamboyance', 'A flock', 'A pod'], 0],
  ['Which planet has the longest day?', ['Mars', 'Venus', 'Jupiter'], 1],
  ['Which animal sleeps holding hands?', ['Sea otters', 'Penguins', 'Dolphins'], 0],
  ['How long does light from the Sun take to reach us?', ['8 seconds', '8 minutes', '8 hours'], 1],
];
function TownHallScreen({ period, motion }: { period: Period; motion: boolean }) {
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { canvas, texture };
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const last = useRef(-1);
  const mode = period === 'golden' ? 'quiz' : period === 'dusk' || period === 'night' ? 'movie' : 'idle';
  useFrame(({ clock }) => {
    const t = motion ? clock.elapsedTime : 0;
    if (clock.elapsedTime - last.current < (mode === 'movie' ? 0.06 : 0.5)) return;
    last.current = clock.elapsedTime;
    const ctx = canvas.getContext('2d')!,
      W = 640,
      H = 360;
    if (mode === 'movie') {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0e1a33');
      sky.addColorStop(0.65, '#2b3f63');
      sky.addColorStop(1, '#1b2c44');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(255,255,240,${0.4 + 0.4 * Math.sin(t * 2 + i * 7)})`;
        ctx.fillRect((i * 137) % W, (i * 71) % 200, 2, 2);
      }
      ctx.fillStyle = '#f6efd6';
      ctx.beginPath();
      ctx.arc(520, 70, 26, 0, Math.PI * 2);
      ctx.fill();
      // Lighthouse and its sweeping beam.
      ctx.fillStyle = '#e8e2d0';
      ctx.fillRect(70, 170, 26, 90);
      ctx.fillStyle = '#ffd98a';
      ctx.fillRect(68, 160, 30, 12);
      const beam = Math.sin(t * 0.8) * 0.6;
      ctx.fillStyle = 'rgba(255,230,160,0.18)';
      ctx.beginPath();
      ctx.moveTo(83, 166);
      ctx.lineTo(640, 166 + Math.tan(beam) * 400 - 60);
      ctx.lineTo(640, 166 + Math.tan(beam) * 400 + 60);
      ctx.fill();
      // Waves and a little ferry crossing.
      for (let row = 0; row < 5; row++) {
        ctx.strokeStyle = `rgba(160,200,230,${0.25 + row * 0.08})`;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 270 + row * 18 + Math.sin(x / 40 + t * 1.5 + row) * 4);
        ctx.stroke();
      }
      const bx = ((t * 30) % (W + 200)) - 100;
      ctx.fillStyle = '#f3e9d6';
      ctx.fillRect(bx, 252, 70, 14);
      ctx.fillRect(bx + 15, 238, 34, 14);
      ctx.fillStyle = '#ffd98a';
      ctx.fillRect(bx + 20, 242, 6, 6);
      ctx.fillRect(bx + 34, 242, 6, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '600 22px Manrope, "DM Sans", system-ui, sans-serif';
      ctx.fillText('Island Shorts · The Night Ferry', 24, 36);
    } else if (mode === 'quiz') {
      const [question, answers, right] = quiz[Math.floor(t / 10) % quiz.length],
        reveal = t % 10 > 6;
      ctx.fillStyle = '#20364f';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#9fd3ff';
      ctx.font = '700 22px Manrope, "DM Sans", system-ui, sans-serif';
      ctx.fillText('TEAM QUIZ', 28, 42);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 28px "DM Sans", system-ui, sans-serif';
      ctx.fillText(question, 28, 104, W - 56);
      answers.forEach((answer, i) => {
        ctx.fillStyle = reveal && i === right ? '#5c9a6d' : '#33507a';
        ctx.fillRect(28, 140 + i * 66, W - 56, 52);
        ctx.fillStyle = '#ffffff';
        ctx.font = '500 26px "DM Sans", system-ui, sans-serif';
        ctx.fillText(`${'ABC'[i]}  ${answer}${reveal && i === right ? '  ✓' : ''}`, 48, 175 + i * 66);
      });
    } else {
      ctx.fillStyle = '#2b3d36';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#cfe6d8';
      ctx.font = '700 30px Manrope, "DM Sans", system-ui, sans-serif';
      ctx.fillText('TOWN HALL · TODAY', 32, 64);
      ctx.font = '500 28px "DM Sans", system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('🧠  Team quiz · golden hour', 32, 150);
      ctx.fillText('🎬  Movie night · dusk', 32, 210);
      ctx.fillStyle = '#9db8ab';
      ctx.font = '500 22px "DM Sans", system-ui, sans-serif';
      ctx.fillText('Grab a seat on the steps', 32, 290);
    }
    texture.needsUpdate = true;
  });
  return (
    <group
      name="townhall-screen"
      position={[townhallScreen.x, 0, townhallScreen.z]}
      rotation={[0, townhallScreen.facing, 0]}
    >
      {[-1.4, 1.4].map(x => (
        <Box key={x} p={[x, 1.1, -0.05]} s={[0.08, 2.2, 0.08]} c="#5d6b63" />
      ))}
      <Box p={[0, 1.95, -0.06]} s={[3.1, 1.85, 0.08]} c="#26302c" />
      <mesh position={[0, 1.95, 0]}>
        <planeGeometry args={[2.9, 1.65]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* The back faces the default camera: a simple sign instead of mirrored content */}
      {mode !== 'idle' && (
        <Label position={[0, 3.15, -0.2]} zIndex={11}>
          <div className="zone-label">{mode === 'quiz' ? '🧠 TEAM QUIZ ON NOW' : '🎬 MOVIE NIGHT'}</div>
        </Label>
      )}
    </group>
  );
}

export function FunSpots({
  playerSeat,
  radioOn,
  onRadio,
  onTelescope,
  period,
  night,
  motion,
}: {
  playerSeat: string | null;
  radioOn: boolean;
  onRadio: () => void;
  onTelescope: () => void;
  period: Period;
  night: number;
  motion: boolean;
}) {
  const pianoPlaying =
    playerSeat === 'pn-0' ||
    Object.values(peopleView).some(
      p => p.present && Math.hypot(p.x - seatPoint('pn-0')[0], p.z - seatPoint('pn-0')[1]) < 0.3,
    );
  return (
    <group name="fun-spots">
      <GamesLawn playerSeat={playerSeat} motion={motion} />
      <Firepit night={night} motion={motion} />
      {hammocks.map(([x, z]: Point) => (
        <Hammock key={`${x}${z}`} x={x} z={z} motion={motion} />
      ))}
      <Jetty playerSeat={playerSeat} motion={motion} />
      <Piano playing={pianoPlaying} />
      <Radio on={radioOn} onToggle={onRadio} />
      <Telescope onLook={onTelescope} />
      <RoofTerrace />
      <TownHallScreen period={period} motion={motion} />
    </group>
  );
}
