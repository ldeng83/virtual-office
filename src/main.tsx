import React, { Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ArrowUpRight, Check, ChevronDown, Compass, DoorOpen, HelpCircle, MapPin, Maximize2, Minus, Plus, Settings2, Sun, Users, Waves, X, Armchair, Navigation, Leaf, Flame, Coffee, BriefcaseBusiness, LocateFixed, Hand, ListChecks } from 'lucide-react';
import { desks, findPath, locations, seats, trees, walkable, garden, gardenPaths, meetingTables, districts, districtTrails, type Point } from './world';
import { AtmosphereControls, AtmosphereScene, readAtmosphere, useOcean, useIslandTime, type IslandTime, type Atmosphere } from './atmosphere';
import { IslandTerrain } from './terrain';
import { DistrictScenery } from './districts';
import { IslandMap } from './island-map';
import { OVERVIEW_CENTER } from './shoreline';
import { cameraView, clampFocus, type ViewMode } from './camera-view';
import { advanceWork, currentTask, demoCoworkers, nextActivity, peopleView, resolveTarget, WHITEBOARD, WHITEBOARD_FACING, WHITEBOARD_SPOT, type DemoCoworker, type Target, type WorkState } from './people';
import { DeskScreen, Whiteboard } from './work-props';
import { AvatarBody, Coworker } from './coworkers';
import './style.css';
type Profile = {
    name: string;
    color: string;
    status: string;
    checked: boolean;
};
function readProfile(): Profile { try {
    return { ...{ name: 'You', color: '#d9815f', status: 'Available', checked: false }, ...JSON.parse(localStorage.getItem('atoll-profile') || '{}') };
}
catch {
    return { name: 'You', color: '#d9815f', status: 'Available', checked: false };
} }
const colors = ['#d9815f', '#7b9c79', '#7193b5', '#a88bb9', '#d4ae55'];
function Box({ p, s, c, rotation = 0 }: {
    p: [
        number,
        number,
        number
    ];
    s: [
        number,
        number,
        number
    ];
    c: string;
    rotation?: number;
}) { return <mesh position={p} rotation={[0, rotation, 0]} castShadow receiveShadow><boxGeometry args={s}/><meshStandardMaterial color={c} roughness={0.85}/></mesh>; }
function Cylinder({ p, r, h, c, r2, segments = 12 }: {
    p: [
        number,
        number,
        number
    ];
    r: number;
    h: number;
    c: string;
    r2?: number;
    segments?: number;
}) { return <mesh position={p} castShadow receiveShadow><cylinderGeometry args={[r, r2 ?? r, h, segments]}/><meshStandardMaterial color={c} roughness={0.9}/></mesh>; }
function Palm({ x, z, i }: { x: number; z: number; i: number }) {
    return <group name={`palm-${i}`} position={[x, 0, z]} rotation={[0, i * 1.7, 0]}>
        <Cylinder p={[0, 1.25, 0]} r={0.13} r2={0.23} h={2.5} c="#b19972"/>
        <group name="palm-crown" position={[0, 2.5, 0]}>{[0, 1, 2, 3, 4, 5].map(n => <group key={n} rotation={[0, n * Math.PI / 3, 0]}><mesh position={[0.65, 0, 0]} rotation={[0, 0, -0.2]} scale={[1, 0.09, 0.27]} castShadow><sphereGeometry args={[1, 6, 4]}/><meshStandardMaterial color={i % 2 ? '#638769' : '#719576'}/></mesh></group>)}</group>
        <Cylinder p={[0, 0.05, 0]} r={0.55} h={0.1} c="#a5b68a"/>
    </group>;
}
function Seat({ seat, onSelect }: {
    seat: typeof seats[number];
    onSelect: (id: string) => void;
}) { return <group position={[seat.point[0], 0, seat.point[1]]} rotation={[0, seat.angle, 0]} onClick={e => { e.stopPropagation(); if (e.delta < 6) onSelect(seat.id); }} onPointerOver={e => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => document.body.style.cursor = 'auto'}><Box p={[0, 0.48, 0]} s={[0.65, 0.13, 0.65]} c="#d9b389"/><Box p={[0, 0.86, -0.28]} s={[0.65, 0.65, 0.1]} c="#d9b389"/>{[-0.23, 0.23].flatMap(x => [-0.23, 0.23].map(z => <Box key={`${x}${z}`} p={[x, 0.22, z]} s={[0.08, 0.45, 0.08]} c="#716c5b"/>))}</group>; }
function ZoneLabel({ position, title }: {
    position: [
        number,
        number,
        number
    ];
    title: string;
}) { return <Html position={position} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}><span className="zone-label">{title}</span></Html>; }
// Zoom multiplier range (30 = default framing). Low values reveal more open sea around the island.
const MIN_ZOOM = 10, MAX_ZOOM = 65;
const viewCorners = [[-1, -1], [1, -1], [1, 1], [-1, 1]], viewNdc = new THREE.Vector2(), viewRay = new THREE.Raycaster(), viewHit = new THREE.Vector3(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function World({ profile, go, seat, setSeat, onPosition, zoom, reset, atmosphere, time, viewMode, onExplore, onFreeLook, coworkers, greeting, onPickSeat, work, shipped }: {
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
    const freeFocus = useRef(new THREE.Vector3()), dragging = useRef(false), baseMode = useRef<'follow' | 'overview'>('follow');
    if (viewMode !== 'free')
        baseMode.current = viewMode;
    // Free look keeps the zoom framing of whichever mode it was entered from.
    const fitMode = viewMode === 'free' ? baseMode.current : viewMode;
    useEffect(() => {
        // Left-drag pans the camera; a short press is still a click (walk / sit).
        const el = gl.domElement, plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
        const ground = (x: number, y: number) => { const r = el.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, new THREE.Vector3()); };
        let press: { x: number; y: number; id: number } | null = null;
        const down = (e: PointerEvent) => { if (e.button === 0 && e.pointerType !== 'touch')
            press = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
        const move = (e: PointerEvent) => {
            if (!press || e.pointerId !== press.id)
                return;
            if (!dragging.current) {
                if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6)
                    return;
                dragging.current = true;
                if (controls.current)
                    freeFocus.current.copy(controls.current.target);
                el.style.cursor = 'grabbing';
                onFreeLook();
            }
            const from = ground(press.x, press.y), to = ground(e.clientX, e.clientY);
            if (from && to) {
                const [x, z] = clampFocus(freeFocus.current.x + from.x - to.x, freeFocus.current.z + from.z - to.z);
                freeFocus.current.set(x, 0, z);
            }
            press.x = e.clientX;
            press.y = e.clientY;
        };
        const up = (e: PointerEvent) => { if (press && e.pointerId === press.id) {
            press = null;
            if (dragging.current)
                el.style.cursor = '';
            dragging.current = false;
        } };
        el.addEventListener('pointerdown', down);
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
        return () => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    }, [gl, camera, onFreeLook]);
    const avatar = useRef<THREE.Group>(null), controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
    const cameraDelta = useRef(new THREE.Vector3()), desiredFocus = useRef(new THREE.Vector3()), lookPending = useRef(false);
    const pos = useRef(new THREE.Vector3(0, 0, 7)), path = useRef<Point[]>([]), keys = useRef(new Set<string>()), walk = useRef(0), last = useRef(0);
    const [marker, setMarker] = useState<Point | null>(null);
    useEffect(() => { if (go) {
        setSeat(null);
        pos.current.set(...[go.point[0], 0, go.point[1]] as [
            number,
            number,
            number
        ]);
        path.current = [];
        setMarker(null);
    } }, [go]);
    useEffect(() => { if (seat) {
        const s = seats.find(s => s.id === seat)!;
        path.current = [];
        setMarker(null);
        pos.current.set(s.point[0], 0, s.point[1]);
        if (avatar.current)
            avatar.current.rotation.y = s.angle;
    } }, [seat]);
    useEffect(() => { const down = (e: KeyboardEvent) => { if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true],.modal'))
        return; if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        keys.current.add(e.key.toLowerCase());
    } }, up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase()), clear = () => keys.current.clear(); window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear); return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); }; }, []);
    useEffect(() => { if (controls.current) {
        controls.current.reset();
    } }, [reset]);
    useEffect(() => { if (controls.current) {
        const fit = fitMode === 'overview' ? Math.min(16, size.width / 88, size.height / 68) : Math.min(36, size.width / 20, size.height / 17);
        controls.current.object.zoom = fit * zoom / 30;
        controls.current.object.updateProjectionMatrix();
    } }, [zoom, reset, size.width, size.height, viewMode]);
    useFrame((state, dt) => {
        if (!avatar.current)
            return;
        dt = Math.min(dt, 0.05);
        const k = keys.current;
        let dx = 0, dz = 0;
        if (k.size) {
            if (viewMode !== 'follow') onExplore();
            if (seat)
                setSeat(null);
            path.current = [];
            setMarker(null);
            const horizontal = Number(k.has('d') || k.has('arrowright')) - Number(k.has('a') || k.has('arrowleft'));
            const vertical = Number(k.has('s') || k.has('arrowdown')) - Number(k.has('w') || k.has('arrowup'));
            const az = controls.current?.getAzimuthalAngle() ?? Math.PI / 4;
            dx = horizontal * Math.cos(az) + vertical * Math.sin(az);
            dz = -horizontal * Math.sin(az) + vertical * Math.cos(az);
        }
        else if (path.current.length) {
            const target = path.current[0];
            dx = target[0] - pos.current.x;
            dz = target[1] - pos.current.z;
            if (Math.hypot(dx, dz) < 0.12) {
                path.current.shift();
                if (!path.current.length)
                    setMarker(null);
            }
        }
        const moving = Math.hypot(dx, dz) > 0.03;
        if (moving) {
            const length = Math.hypot(dx, dz);
            dx = dx / length * dt * 3;
            dz = dz / length * dt * 3;
            if (walkable(pos.current.x + dx, pos.current.z))
                pos.current.x += dx;
            if (walkable(pos.current.x, pos.current.z + dz))
                pos.current.z += dz;
            avatar.current.rotation.y = Math.atan2(dx, dz);
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
            cameraDelta.current.copy(desiredFocus.current).sub(target).multiplyScalar(1 - Math.exp(-dt * (dragging.current ? 30 : 5)));
            target.add(cameraDelta.current);
            controls.current.object.position.add(cameraDelta.current);
            // Orthographic rays must start above all visible ground, including tall portrait views and zoomed-out follow views.
            const reach = size.height / controls.current.object.zoom * 1.5;
            const distance = viewMode !== 'follow' ? Math.max(100, reach) : Math.max(44, reach);
            cameraDelta.current.copy(controls.current.object.position).sub(target).setLength(distance);
            controls.current.object.position.copy(target).add(cameraDelta.current);
            controls.current.update();
            cameraView.focus = [target.x, target.z];
            cameraView.corners = viewCorners.map(([x, y]) => { viewNdc.set(x, y); viewRay.setFromCamera(viewNdc, camera); const hit = viewRay.ray.intersectPlane(groundPlane, viewHit); return hit ? [hit.x, hit.z] as Point : cameraView.focus; });
        }
        avatar.current.position.copy(pos.current);
        avatar.current.position.y = seat ? -0.2 : moving ? Math.sin(walk.current) * 0.045 : 0;
        if (state.clock.elapsedTime - last.current > 0.4) {
            onPosition([pos.current.x, pos.current.z]);
            last.current = state.clock.elapsedTime;
        }
    });
    return <><AtmosphereScene settings={atmosphere} time={time}/>
 <IslandTerrain onWalk={(target, delta) => { if (delta >= 6) return; onExplore(); const route = findPath([pos.current.x, pos.current.z], target); if (route.length) { setSeat(null); path.current = route; setMarker(target); } }}/>
 {[...gardenPaths, ...districtTrails].flatMap((points, pathIndex) => points.slice(1).map((point, i) => { const start = points[i], dx = point[0] - start[0], dz = point[1] - start[1]; return <Box key={`${pathIndex}-${i}`} p={[(start[0] + point[0]) / 2, 0.115, (start[1] + point[1]) / 2]} s={[1.35, 0.04, Math.hypot(dx, dz) + 0.3]} c="#dfd5b4" rotation={Math.atan2(dx, dz)}/>; }))}
 <DistrictScenery/>
 <Box p={[0, 0.1, 3.5]} s={[1.8, 0.08, 8]} c="#dfd5b4"/><Box p={[-2.5, 0.11, -0.4]} s={[6.5, 0.08, 1.5]} c="#dfd5b4"/><Box p={[3.5, 0.11, -1.2]} s={[7, 0.08, 1.5]} c="#dfd5b4" rotation={0.35}/><Box p={[2.5, 0.1, 4]} s={[5, 0.08, 1.2]} c="#dfd5b4"/>
 <Box p={[-4.2, 0.08, -0.8]} s={[10.5, 0.16, 7]} c="#bdac87"/>{Array.from({ length: 26 }, (_, i) => <Box key={i} p={[-9.2 + i * 0.4, 0.17, -0.8]} s={[0.025, 0.015, 7]} c="#a99a7c"/>)}
 {[-9.1, 0.6].flatMap(x => [-4, 2.3].map(z => <Cylinder key={`${x}${z}`} p={[x, 1.2, z]} r={0.09} h={2.4} c="#e9dfc5"/>))}<Box p={[-4.25, 2.45, -4]} s={[10, 0.17, 0.18]} c="#e9dfc5"/><Box p={[-4.25, 2.45, 2.3]} s={[10, 0.17, 0.18]} c="#e9dfc5"/>{[-8, -6, -4, -2, 0].map(x => <Box key={x} p={[x, 2.5, -0.85]} s={[0.12, 0.12, 6.5]} c="#e9dfc5"/>)}
 {desks.map((d, i) => <group key={d.id} position={[d.x, 0, d.z]}><Box p={[0, 0.85, 0]} s={[1.35, 0.12, 0.8]} c="#e6cda8"/>{[-0.5, 0.5].map(x => <Box key={x} p={[x, 0.43, 0]} s={[0.07, 0.8, 0.6]} c="#7d8271"/>)}<Box p={[0, 1.17, -0.1]} s={[0.55, 0.35, 0.05]} c="#485f5b"/><Box p={[0, 0.96, 0]} s={[0.08, 0.15, 0.08]} c="#485f5b"/><Box p={[0, 0.93, 0.18]} s={[0.4, 0.025, 0.15]} c="#ece9da"/><Cylinder p={[0.46, 0.99, 0]} r={0.09} h={0.18} c={i % 2 ? '#c17c5e' : '#8b9d7b'}/></group>)}
 {seats.map(s => <Seat key={s.id} seat={s} onSelect={onPickSeat}/>)}
 {coworkers.map(({ person, target }) => <Coworker key={person.id} person={person} target={target} greeting={greeting?.id === person.id ? greeting.text : null} player={pos} motion={atmosphere.motion} task={target?.activity.work ? { ...currentTask(person, work[person.id]), progress: work[person.id].progress } : null} shipped={shipped[person.id] ?? null}/>)}
 {coworkers.map(({ person, target }) => { const desk = target?.activity.work ? desks.find(d => d.id === target.seatId) : undefined; return desk && target && <DeskScreen key={`screen-${person.id}`} desk={desk} seat={target.point} work={{ personId: person.id, craft: person.craft, progress: work[person.id].progress, celebrating: !!shipped[person.id] }}/>; })}
 <Whiteboard position={WHITEBOARD} face={WHITEBOARD_FACING} spot={WHITEBOARD_SPOT} active={coworkers.some(c => c.target?.activity.place === 'Meeting grove')}/>
 {meetingTables.map(([x, z], i) => <group key={i} position={[x, 0, z]}><Cylinder p={[0, 0.08, 0]} r={1.8} h={0.15} c="#d7c5a2"/><Cylinder p={[0, 0.75, 0]} r={0.75} h={0.12} c="#e7d4b3"/><Cylinder p={[0, 0.37, 0]} r={0.12} h={0.7} c="#7f8b75"/>{[0, 1, 2].map(n => <Cylinder key={n} p={[Math.cos(n * 2.1) * 1.15, 0.35, Math.sin(n * 2.1) * 1.15]} r={0.3} h={0.6} c="#a0ac8a"/>)}<Cylinder p={[0, 2.8, 0]} r={0.05} r2={2} h={1.1} c={i ? '#cf9b77' : '#8eaa91'}/><Cylinder p={[0, 1.8, 0]} r={0.045} h={2.4} c="#e7d4b3"/></group>)}
 <Cylinder p={[5, 0.13, 4]} r={1} h={0.2} c="#b9ad93"/>{[0, 1, 2].map(i => <Box key={i} p={[5, 0.3 + i * 0.1, 4]} s={[0.7, 0.15, 0.15]} c="#886d56" rotation={i * 1.1}/>)}<mesh position={[5, 0.65, 4]}><coneGeometry args={[0.25, 0.7, 6]}/><meshStandardMaterial color="#eda968" emissive="#e88b47" emissiveIntensity={0.3}/></mesh>
 <Cylinder p={[garden.x, 0.12, garden.z]} r={2.4} h={0.13} c="#b6c79d"/>{[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[garden.x - 1.6 + i * 0.8, 0.2, garden.z + 0.7]} scale={[0.35, 0.2, 0.3]}><dodecahedronGeometry /><meshStandardMaterial color="#a5aaa0"/></mesh>)}
 {trees.map(([x, z], i) => <Palm key={i} x={x} z={z} i={i}/>)}
 <Box p={[0, -0.03, 9.3]} s={[2, 0.2, 3]} c="#b39a78"/>{Array.from({ length: 9 }, (_, i) => <Box key={i} p={[0, 0.08, 8 + i * 0.3]} s={[2.05, 0.04, 0.22]} c="#d5ba92"/>)}
 {[[-2, 5], [3, 7], [-9, 4], [10, 2], [2, -6]].map(([x, z], i) => <group key={i} position={[x, 0, z]}><Cylinder p={[0, 0.13, 0]} r={0.3} h={0.25} c="#8b9e79"/>{[0, 1, 2].map(j => <mesh key={j} position={[Math.cos(j * 2) * 0.22, 0.4, Math.sin(j * 2) * 0.22]}><sphereGeometry args={[0.12, 6, 5]}/><meshStandardMaterial color={i % 2 ? '#d9b07d' : '#e3d9b1'}/></mesh>)}</group>)}
 {fitMode === 'follow' && <><ZoneLabel position={[-4.4, 3.3, -3.2]} title="THE STUDIO"/><ZoneLabel position={[9, 3.8, -5]} title="MEETING GROVE"/><ZoneLabel position={[5, 1.2, 6.3]} title="CAMPFIRE"/><ZoneLabel position={[garden.x, 1.3, garden.z - 2.2]} title="QUIET GARDEN"/></>}
 {districts.filter(d => fitMode === 'overview' || d.id !== 'village').map(d => <ZoneLabel key={d.id} position={[d.point[0], 2.4, d.point[1] - 2]} title={d.name.toUpperCase()}/>)}
 {marker && <mesh position={[marker[0], 0.22, marker[1]]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.18, 0.24, 24]}/><meshBasicMaterial color="#fffce8"/></mesh>}
 <group ref={avatar} name="player-avatar"><AvatarBody color={profile.color}/><Html position={[0, 1.85, 0]} center zIndexRange={[20, 0]}><div className="avatar-label"><i />{profile.name} <span>you</span></div></Html></group>
 <ContactShadows position={[0, 0.02, 0]} opacity={0.18} scale={35} blur={2} far={8}/><OrbitControls ref={controls} makeDefault target={[0, 0, 7]} minZoom={2} maxZoom={75} minPolarAngle={0.3} maxPolarAngle={Math.PI / 2.7} enablePan={false} enableZoom={false} mouseButtons={{ LEFT: undefined, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.ROTATE }}/>
 </>;
}
class SceneBoundary extends React.Component<{
    children: React.ReactNode;
}, {
    failed: boolean;
}> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? <div className="scene-error"><Waves size={40}/><h2>The island couldn’t load</h2><p>Try a browser with WebGL enabled, then reload.</p><button onClick={() => window.location.reload()}>Reload island</button></div> : this.props.children; }
}
function App() {
    const [viewMode, setViewMode] = useState<ViewMode>('follow');
    const freeLook = React.useCallback(() => setViewMode('free'), []);
    const [atmosphere, setAtmosphere] = useState(readAtmosphere);
    const sound = useOcean(atmosphere.volume);
    const mood = useIslandTime(atmosphere);
    const updateAtmosphere = (patch: Partial<Atmosphere>) => setAtmosphere(current => ({ ...current, ...patch }));
    useEffect(() => { try { localStorage.setItem('atoll-atmosphere', JSON.stringify(atmosphere)); } catch { /* Storage may be disabled. */ } }, [atmosphere]);
    const [profile, setProfile] = useState(readProfile), [tab, setTab] = useState('places'), [modal, setModal] = useState<'help' | 'settings' | 'atmosphere' | null>(null), [seat, setSeat] = useState<string | null>(null), [go, setGo] = useState<{
        point: Point;
        seq: number;
    } | null>(null), [position, setPosition] = useState<Point>([0, 7]), [zoom, setZoom] = useState(30), [reset, setReset] = useState(0), [toast, setToast] = useState(''), [loaded, setLoaded] = useState(false);
    const [showDemo, setShowDemo] = useState(() => { try {
        return localStorage.getItem('atoll-demo-people') !== 'off';
    }
    catch {
        return true;
    } });
    useEffect(() => { try {
        localStorage.setItem('atoll-demo-people', showDemo ? 'on' : 'off');
    }
    catch { /* Storage may be disabled. */ } }, [showDemo]);
    // Demo coworkers: each part of the day has a home activity plus short errands. A small planner
    // picks what's next when the current activity's time is up; the scene just walks them there.
    const seatRef = useRef(seat);
    seatRef.current = seat;
    const planHome = (period: typeof mood.period) => { const taken = new Set(seatRef.current ? [seatRef.current] : []), plans: Record<string, Target | null> = {};
        for (const person of demoCoworkers) {
            const target = resolveTarget(person.schedule[period]?.home ?? null, taken);
            if (target?.seatId)
                taken.add(target.seatId);
            plans[person.id] = target;
        }
        return plans; };
    // On page load they're already partway through their current activity, so the first move comes soon.
    const [plans, setPlans] = useState(() => { const initial = planHome(mood.period);
        for (const target of Object.values(initial))
            if (target)
                target.dwell *= 0.1 + Math.random() * 0.25;
        return initial; });
    const planPeriod = useRef(mood.period);
    const deadlines = useRef(new WeakMap<Target, number>());
    useEffect(() => { if (planPeriod.current !== mood.period) {
        planPeriod.current = mood.period;
        setPlans(planHome(mood.period));
    } }, [mood.period]);
    useEffect(() => {
        const timers = demoCoworkers.map(person => {
            const current = plans[person.id], block = person.schedule[planPeriod.current];
            if (!current || !block || !block.errands.length)
                return 0;
            // Time up = walking there (estimated from where they are when it starts) + dwelling.
            // Deadlines are fixed per activity so one coworker's change doesn't reset the other's clock.
            if (!deadlines.current.has(current)) {
                const at = peopleView[person.id], walkSeconds = at ? Math.hypot(at.x - current.point[0], at.z - current.point[1]) * 1.4 / 2.4 : 0;
                deadlines.current.set(current, Date.now() + (walkSeconds + current.dwell) * 1000);
            }
            return window.setTimeout(() => setPlans(all => {
                if (all[person.id] !== current)
                    return all;
                const taken = new Set([...(seatRef.current ? [seatRef.current] : []), ...Object.entries(all).flatMap(([id, t]) => id !== person.id && t?.seatId ? [t.seatId] : [])]);
                return { ...all, [person.id]: resolveTarget(nextActivity(block, current.activity), taken) };
            }), Math.max(0, deadlines.current.get(current)! - Date.now()));
        });
        return () => timers.forEach(clearTimeout);
    }, [plans]);
    const coworkers = React.useMemo(() => showDemo ? demoCoworkers.map(person => ({ person, target: plans[person.id] ?? null })) : [], [plans, showDemo]);
    // Work: time spent at a work spot moves their current task forward; finishing posts to the feed.
    const plansRef = useRef(plans);
    plansRef.current = plans;
    const [work, setWork] = useState<Record<string, WorkState>>(() => Object.fromEntries(demoCoworkers.map(p => [p.id, { task: Math.floor(Math.random() * p.tasks.length), progress: 0.3 + Math.random() * 0.4 }])));
    const workRef = useRef(work);
    const [shipped, setShipped] = useState<Record<string, string>>({});
    type FeedItem = { id: number; at: Date; personId: string; who: string; icon: string; text: string };
    const feedId = useRef(0);
    const [feed, setFeed] = useState<FeedItem[]>(() => demoCoworkers.flatMap(person => { const target = plans[person.id], task = currentTask(person, work[person.id]);
        return target ? [{ id: ++feedId.current, at: new Date(), personId: person.id, who: person.name, icon: target.activity.work ? task.icon : target.activity.icon, text: target.activity.work ? `is working on ${task.title}` : `is ${target.activity.activity.toLowerCase()}` }] : []; }));
    const post = (person: DemoCoworker, icon: string, text: string) => setFeed(items => [{ id: ++feedId.current, at: new Date(), personId: person.id, who: person.name, icon, text }, ...items].slice(0, 40));
    useEffect(() => { if (!showDemo)
        return; const clock = window.setInterval(() => {
        const next = { ...workRef.current };
        let changed = false;
        for (const person of demoCoworkers) {
            const target = plansRef.current[person.id], at = peopleView[person.id];
            if (!target?.activity.work || !at?.present || Math.hypot(at.x - target.point[0], at.z - target.point[1]) > 0.3)
                continue;
            const result = advanceWork(person, next[person.id], 1);
            next[person.id] = result.state;
            changed = true;
            if (result.finished) {
                const title = result.finished.title, upcoming = currentTask(person, result.state);
                post(person, '✅', `shipped ${title}`);
                post(person, upcoming.icon, `started ${upcoming.title}`);
                setShipped(all => ({ ...all, [person.id]: title }));
                window.setTimeout(() => setShipped(all => { const rest = { ...all }; delete rest[person.id]; return rest; }), 4000);
            }
        }
        if (changed) {
            workRef.current = next;
            setWork(next);
        }
    }, 1000); return () => clearInterval(clock); }, [showDemo]);
    const previousPlans = useRef(plans);
    useEffect(() => { const before = previousPlans.current;
        previousPlans.current = plans;
        if (before === plans || !showDemo)
            return;
        for (const person of demoCoworkers) {
            const a = before[person.id], b = plans[person.id];
            if (a === b)
                continue;
            if (!a && b)
                post(person, '🚤', 'arrived on the island');
            else if (a && !b)
                post(person, '🌙', 'headed home for the day');
            else if (b?.activity.place === 'Meeting grove' && a?.activity.place !== 'Meeting grove')
                post(person, '💬', `joined the ${b.activity.activity.toLowerCase()}`);
            else if (b?.activity.icon === '☕')
                post(person, '☕', 'took a coffee break');
            else if (b?.activity.work && !a?.activity.work) {
                const task = currentTask(person, workRef.current[person.id]);
                post(person, task.icon, `is back on ${task.title}`);
            }
        } }, [plans]);
    const [seenFeed, setSeenFeed] = useState(0);
    const unseen = showDemo ? feed.filter(item => item.id > seenFeed).length : 0;
    const occupied = new Map(coworkers.flatMap(c => c.target?.seatId ? [[c.target.seatId, c.person.name] as const] : []));
    const pickSeat = (id: string) => { const owner = occupied.get(id); if (owner)
        setToast(`${owner} is sitting there. Try another seat.`);
    else
        setSeat(id); };
    const [greeting, setGreeting] = useState<{ id: string; text: string } | null>(null);
    useEffect(() => { if (greeting) {
        const t = setTimeout(() => setGreeting(null), 4500);
        return () => clearTimeout(t);
    } }, [greeting]);
    const nearby = coworkers.find(c => { const p = peopleView[c.person.id]; return !!c.target && !!p?.present && Math.hypot(p.x - position[0], p.z - position[1]) < 2.5; });
    const greet = ({ person, target }: typeof coworkers[number]) => setGreeting({ id: person.id, text: target?.activity.status === 'Focused' ? person.focusReply : person.greetings[Math.floor(Math.random() * person.greetings.length)] });
    const findPerson = (id: string) => { const p = peopleView[id]; if (p?.present) {
        cameraView.look = [p.x, p.z];
        freeLook();
    } };
    const panel = useRef<HTMLElement>(null);
    // Mouse wheel / trackpad scroll zooms the island; the mini-map keeps its own scroll.
    useEffect(() => { const el = panel.current; if (!el)
        return; const wheel = (e: WheelEvent) => { if ((e.target as HTMLElement).closest('.island-map'))
        return; e.preventDefault(); const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1); setZoom(v => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v * Math.exp(-delta * 0.0015)))); }; el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel); }, []);
    useEffect(() => { try {
        localStorage.setItem('atoll-profile', JSON.stringify(profile));
    }
    catch { /* Storage may be disabled. */ } }, [profile]);
    useEffect(() => { if (tab === 'activity' && feed[0])
        setSeenFeed(feed[0].id); }, [tab, feed]);
    useEffect(() => { if (!modal)
        return; const handle = (e: KeyboardEvent) => { if (e.key === 'Escape')
        setModal(null); if (e.key === 'Tab') {
        const elements = Array.from(document.querySelectorAll<HTMLElement>('.modal button,.modal input,.modal select'));
        const first = elements[0], last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
        }
    } }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle); }, [modal]);
    useEffect(() => { if (toast) {
        const t = setTimeout(() => setToast(''), 3500);
        return () => clearTimeout(t);
    } }, [toast]);
    const travel = (point: Point) => { setViewMode('follow'); setGo({ point, seq: Date.now() }); }, update = (p: Partial<Profile>) => setProfile(v => ({ ...v, ...p })), nearest = locations.reduce((a, b) => Math.hypot(position[0] - a.point[0], position[1] - a.point[1]) < Math.hypot(position[0] - b.point[0], position[1] - b.point[1]) ? a : b);
    const icons = [Navigation, BriefcaseBusiness, Coffee, Flame, Leaf];
    return <div className="app"><header className="header"><a className="brand" href="/" aria-label="Atoll home"><span className="brand-icon"><Waves size={23}/></span>atoll<span className="brand-divider"/><span className="workspace-name">Our island office<ChevronDown size={13}/></span></a><div className="header-right"><span className="prototype">LOCAL PROTOTYPE</span><span className="weather"><mood.Icon size={17}/> {mood.name}</span><button className="icon-button" aria-label="Help" onClick={() => setModal('help')}><HelpCircle size={19}/></button><button className="profile-button" aria-label="Edit profile" style={{ background: profile.color }} onClick={() => setModal('settings')}>{profile.name.slice(0, 1).toUpperCase()}</button></div></header>
 <main><aside className="sidebar"><div className="intro"><span className="eyebrow">A LITTLE SPACE TOGETHER</span><h1>Welcome to<br />your workday<span>.</span></h1><p>Your desk, your people.<br />A little closer, wherever you are.</p></div><div className="checkin-card"><div className="checkin-title"><span className={profile.checked ? 'online-dot' : 'offline-dot'}/><strong>{profile.checked ? 'You’re checked in' : 'Make yourself at home'}</strong></div><p>{profile.checked ? 'Enjoy your time on the island.' : 'Ready when you are. Settle in.'}</p><button className={profile.checked ? 'checked-button' : 'primary-button'} onClick={() => { update({ checked: !profile.checked }); setToast(profile.checked ? 'Checked out. See you soon!' : 'Checked in. Welcome to the island!'); }}>{profile.checked ? <Check size={16}/> : <DoorOpen size={16}/>} {profile.checked ? 'Check out' : 'Check in to the island'}{!profile.checked && <ArrowUpRight size={16}/>}</button></div>
 <div className="tabs"><button className={tab === 'places' ? 'active' : ''} onClick={() => setTab('places')}><Compass size={16}/> Places</button><button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}><Users size={16}/> People <span>{(profile.checked ? 1 : 0) + coworkers.filter(c => c.target).length}</span></button><button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}><ListChecks size={16}/> Activity {unseen > 0 && <span className="unseen">{unseen}</span>}</button></div>
 {tab === 'activity' ? <div className="feed" aria-live="polite">{showDemo && feed.length ? feed.map(item => <button key={item.id} className="feed-item" onClick={() => findPerson(item.personId)}><span className="feed-icon">{item.icon}</span><span><strong>{item.who}</strong> {item.text}<small>{item.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></span></button>) : <p className="feed-empty">Team updates will appear here as people work.</p>}</div> : tab === 'places' ? <nav className="places" aria-label="Island locations">{locations.map((l, i) => { const Icon = icons[i] ?? Compass; return <button key={l.id} className={nearest.id === l.id ? 'place selected' : 'place'} onClick={() => travel(l.point)}><span className={`place-icon place-${i}`}><Icon size={19}/></span><span><strong>{l.name}</strong><small>{l.detail}</small></span><ArrowUpRight className="place-arrow" size={16}/></button>; })}</nav> : <div className="people"><div className="person"><span className="person-avatar" style={{ background: profile.color }}>{profile.name.slice(0, 1)}</span><div><strong>{profile.name} <small>(you)</small></strong><p>{profile.checked ? profile.status : 'Not checked in'}</p></div><span className={profile.checked ? 'online-dot' : 'offline-dot'}/></div>{coworkers.map(({ person, target }) => <div key={person.id} className="person"><span className="person-avatar" style={{ background: person.color }}>{person.name.slice(0, 1)}</span><div><strong>{person.name} <small className="demo-tag">demo</small></strong><p>{target ? `${target.activity.status} · ${target.activity.activity}` : 'Off the island'}</p>{target && (() => { const task = currentTask(person, work[person.id]); return <p className="person-task" title={`${Math.round(work[person.id].progress * 100)}% done`}>{task.icon} {task.title}<span className="mini-bar"><span style={{ width: `${work[person.id].progress * 100}%` }}/></span></p>; })()}</div>{target && <button className="icon-button find-person" aria-label={`Find ${person.name}`} title={`Find ${person.name}`} onClick={() => findPerson(person.id)}><LocateFixed size={15}/></button>}<span className={!target ? 'offline-dot' : target.activity.status === 'Available' ? 'online-dot' : 'busy-dot'}/></div>)}<div className="empty-people"><Users size={25}/><strong>A space for the whole team</strong><p>{showDemo ? 'Maya and Theo are demo coworkers on a daily routine. Real teammates arrive with shared presence.' : 'This first prototype runs locally. Shared employee presence is the next milestone.'}</p></div></div>}
 <div className="sidebar-footer"><div><span className="tiny-island">✦</span><strong>A little island. A better workday.</strong></div><p>Built for a team of 10.</p></div></aside>
 <section ref={panel} data-view-mode={viewMode} data-mood={mood.period} className="island-panel" aria-label="Interactive 3D island"><div className="scene-top"><div className="location-chip"><span className="online-dot"/>{mood.name}<span className="chip-divider"/><time dateTime={mood.now.toISOString()} title={`${mood.timezone}${atmosphere.mode === 'manual' ? ' · Manual atmosphere' : ' · Following real time'}`}>{mood.time}</time>{atmosphere.mode === 'manual' && <span className="manual-chip">Manual</span>}</div><button className="scene-settings" aria-label="Island atmosphere" onClick={() => setModal('atmosphere')}><Settings2 size={18}/></button></div>
 <SceneBoundary><Suspense fallback={<div className="loading">Finding your little corner of the world…</div>}><Canvas shadows orthographic camera={{ position: [21, 25, 36], zoom: 30, near: 0.1, far: 1000 }} dpr={[1, 1.7]} onCreated={() => setLoaded(true)}><World profile={profile} go={go} seat={seat} setSeat={setSeat} onPosition={setPosition} zoom={zoom} reset={reset} atmosphere={atmosphere} time={mood} viewMode={viewMode} onExplore={() => setViewMode('follow')} onFreeLook={freeLook} coworkers={coworkers} greeting={greeting} onPickSeat={pickSeat} work={work} shipped={shipped}/></Canvas></Suspense></SceneBoundary>
 <IslandMap position={position} travel={travel} onLook={freeLook} people={coworkers.map(c => ({ id: c.person.id, name: c.person.name, color: c.person.color }))}/>
 <div className="view-modes" role="group" aria-label="Camera mode"><button aria-pressed={viewMode === 'follow'} onClick={() => setViewMode('follow')}><Navigation size={14}/> {viewMode === 'free' ? 'Back to me' : 'Follow me'}</button><button aria-pressed={viewMode === 'overview'} onClick={() => setViewMode('overview')}><Compass size={14}/> Island overview</button></div>
 {loaded && viewMode === 'overview' && <div className="island-caption"><span>YOUR EVERYDAY GETAWAY</span><h2>Good work happens here.</h2><p>Find your spot. Make a connection.</p></div>}
 <div className="map-controls"><button aria-label="Zoom in" onClick={() => setZoom(v => Math.min(MAX_ZOOM, v + 5))}><Plus size={18}/></button><button aria-label="Zoom out" onClick={() => setZoom(v => Math.max(MIN_ZOOM, v - 5))}><Minus size={18}/></button><div /><button aria-label="Reset view" onClick={() => { setReset(v => v + 1); setZoom(30); setViewMode(v => v === 'free' ? 'follow' : v); }}><Maximize2 size={17}/></button></div>
 <div className="scene-bottom"><span className="current-location"><MapPin size={15}/>{nearest.name}</span><span className="movement-hint"><span>W A S D</span> to move <i /> Click to walk <i /> Drag to pan <i /> Right-drag to orbit <i /> Scroll to zoom</span></div>
 {seat && <div className="seat-message"><Armchair size={17}/><span>Settled into {seats.find(s => s.id === seat)?.name}</span><button onClick={() => setSeat(null)}>Stand up</button></div>}
 {nearby && !greeting && <div className="nearby-prompt"><span className="person-avatar" style={{ background: nearby.person.color }}>{nearby.person.name.slice(0, 1)}</span><span><strong>{nearby.person.name}</strong> is nearby · {nearby.target?.activity.activity}</span><button onClick={() => greet(nearby)}><Hand size={14}/> Say hi</button></div>}
 {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
 </section></main>
 <footer className="bottom-bar"><div className="self"><span className="self-avatar" style={{ background: profile.color }}>{profile.name.slice(0, 1)}</span><div><strong>{profile.name}</strong><span>{profile.checked ? 'Checked in' : 'Exploring the island'}</span></div><span className="bottom-divider"/><label className="status-select"><span className={profile.status === 'Available' ? 'online-dot' : 'busy-dot'}/><select aria-label="Your availability" value={profile.status} onChange={e => update({ status: e.target.value })}><option>Available</option><option>Focused</option><option>In a meeting</option><option>Away</option></select></label></div><div className="footer-note"><Leaf size={15}/> A little room to focus. A little room to connect.</div><button className="help-button" onClick={() => setModal('help')}><HelpCircle size={16}/> How to explore</button></footer>
 {modal && <div className="modal-overlay" onClick={() => setModal(null)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape')
        setModal(null); }}><button autoFocus className="modal-close icon-button" aria-label="Close dialog" onClick={() => setModal(null)}><X size={20}/></button><span className="eyebrow">MAKE YOURSELF AT HOME</span><h2 id="modal-title">{modal === 'help' ? 'Your island field guide' : modal === 'atmosphere' ? 'A change of atmosphere' : 'Your little corner'}</h2>{modal === 'atmosphere' ? <AtmosphereControls settings={atmosphere} update={updateAtmosphere} sound={sound} time={mood}/> : modal === 'help' ? <><p>There’s no wrong way to settle in.</p><ul className="instructions"><li><Navigation /><div><strong>Take a walk</strong><p>Click the ground or use WASD / arrow keys. Paths go around desks and trees.</p></div></li><li><Armchair /><div><strong>Find your seat</strong><p>Click a chair to sit. Start walking or choose “Stand up” to leave.</p></div></li><li><Compass /><div><strong>Look around</strong><p>Drag to pan, right-drag to orbit, and scroll or use + / − to zoom. Panning frees the camera; walk or choose Back to me to return. Follow me keeps you in view; Island overview shows every district. Use the map or sidebar to travel.</p></div></li><li><Sun /><div><strong>Set the mood</strong><p>Open the island settings to change the sky, pause gentle motion, or listen to ocean sounds.</p></div></li><li><Users /><div><strong>A first little island</strong><p>Check-in and preferences are saved in this browser. Multiplayer, chat, and voice will arrive in later milestones.</p></div></li></ul></> : <><p>A few things to make this place yours.</p><label className="form-label">Your name<input maxLength={24} value={profile.name === 'You' ? '' : profile.name} placeholder="Your name" onChange={e => update({ name: e.target.value || 'You' })}/></label><span className="form-label">Avatar color</span><div className="color-options">{colors.map(c => <button key={c} style={{ background: c }} aria-label={`Choose avatar color ${c}`} aria-pressed={profile.color === c} onClick={() => update({ color: c })}>{profile.color === c && <Check size={20}/>}</button>)}</div><label className="atmosphere-toggle"><span><strong>Demo coworkers</strong><small>Show Maya and Theo until real teammates join</small></span><input type="checkbox" role="switch" checked={showDemo} onChange={e => setShowDemo(e.target.checked)}/></label><p className="settings-note">Saved automatically on this device.</p></>}<button className="primary-button" onClick={() => setModal(null)}>{modal === 'help' ? 'Let’s explore' : 'Back to the island'}<ArrowUpRight size={16}/></button></section></div>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
