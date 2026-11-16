import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraView } from './camera-view';
import { doorways, pads, walls, WALL_HEIGHT, type Pad, type Wall } from './world';

// Building shells on top of the campus floors. Buildings have a solid base, a glass window band
// and a header; pavilions are glass between timber posts. The roof and the camera-facing walls
// (south and east, since the default camera looks from the south-east) fade when you're inside
// or looking into the building, so people at their desks stay visible.
const BASE = 0.95, HEADER = 2.1, FLOOR = 0.155;
const front = (w: Wall) => w.side === 'south' || w.side === 'east';
type Mats = { solid: THREE.MeshStandardMaterial; glass: THREE.MeshStandardMaterial; frame: THREE.MeshStandardMaterial; roof: THREE.MeshStandardMaterial; roofTop: THREE.MeshStandardMaterial };
function materials(pad: Pad, fading: boolean): Mats {
    const fade = { transparent: true, opacity: 1 };
    const glassy = pad.style === 'glass';
    return {
        solid: new THREE.MeshStandardMaterial({ color: '#efebe0', roughness: 0.8, ...(fading ? fade : {}) }),
        glass: new THREE.MeshStandardMaterial({ color: glassy ? '#cfe8e6' : '#c6dedb', roughness: 0.15, metalness: 0.1, transparent: true, opacity: glassy ? 0.26 : 0.38, depthWrite: false }),
        frame: new THREE.MeshStandardMaterial({ color: glassy ? '#b8956b' : '#d9d2c0', roughness: 0.75, ...(fading ? fade : {}) }),
        roof: new THREE.MeshStandardMaterial({ color: pad.id === 'cafe' ? '#c39f73' : glassy ? '#f4f1e8' : '#e3ddcb', roughness: 0.85, transparent: true, opacity: 1 }),
        roofTop: new THREE.MeshStandardMaterial({ color: pad.id === 'hq' ? '#8fae7c' : '#d6cfbb', roughness: 0.9, transparent: true, opacity: 1 }),
    };
}
function Piece({ x, y, z, w, h, d, material, shadow = true }: { x: number; y: number; z: number; w: number; h: number; d: number; material: THREE.Material; shadow?: boolean }) {
    return <mesh position={[x, y, z]} material={material} castShadow={shadow} receiveShadow><boxGeometry args={[w, h, d]}/></mesh>;
}
function WallPiece({ wall, pad, m }: { wall: Wall; pad: Pad; m: Mats }) {
    const { x, z, w, d } = wall;
    if (pad.style === 'glass')
        return <>
            <Piece x={x} y={FLOOR + HEADER / 2} z={z} w={w} h={HEADER} d={d * 0.5} material={m.glass} shadow={false}/>
            <Piece x={x} y={FLOOR + HEADER + (WALL_HEIGHT - HEADER) / 2} z={z} w={w + 0.04} h={WALL_HEIGHT - HEADER} d={d} material={m.frame}/>
            <Piece x={x} y={FLOOR + 0.06} z={z} w={w + 0.04} h={0.12} d={d} material={m.frame}/>
        </>;
    return <>
        <Piece x={x} y={FLOOR + BASE / 2} z={z} w={w} h={BASE} d={d} material={m.solid}/>
        <Piece x={x} y={FLOOR + (BASE + HEADER) / 2} z={z} w={w} h={HEADER - BASE} d={d * 0.4} material={m.glass} shadow={false}/>
        <Piece x={x} y={FLOOR + HEADER + (WALL_HEIGHT - HEADER) / 2} z={z} w={w} h={WALL_HEIGHT - HEADER} d={d} material={m.solid}/>
    </>;
}
// Posts at every wall end and doorway edge.
function posts(pad: Pad) {
    const out: [number, number][] = [[pad.x - pad.w / 2, pad.z - pad.d / 2], [pad.x + pad.w / 2, pad.z - pad.d / 2], [pad.x - pad.w / 2, pad.z + pad.d / 2], [pad.x + pad.w / 2, pad.z + pad.d / 2]];
    for (const w of [...walls, ...doorways].filter(w => w.pad === pad.id)) {
        if (w.w > w.d)
            out.push([w.x - w.w / 2, w.z], [w.x + w.w / 2, w.z]);
        else
            out.push([w.x, w.z - w.d / 2], [w.x, w.z + w.d / 2]);
    }
    return out.filter((p, i) => out.findIndex(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.05) === i);
}

function Shell({ pad, player }: { pad: Pad; player: RefObject<THREE.Vector3> }) {
    const back = useMemo(() => materials(pad, false), [pad]), frontMats = useMemo(() => materials(pad, true), [pad]);
    const roof = useRef<THREE.Group>(null), opacity = useRef(1);
    const own = walls.filter(w => w.pad === pad.id), doors = doorways.filter(w => w.pad === pad.id);
    useFrame((_, dt) => {
        const p = player.current, [fx, fz] = cameraView.focus;
        const inside = (x: number, z: number, margin: number) => Math.abs(x - pad.x) < pad.w / 2 + margin && Math.abs(z - pad.z) < pad.d / 2 + margin;
        const open = (!!p && inside(p.x, p.z, 0.4)) || inside(fx, fz, 0.8);
        opacity.current = THREE.MathUtils.damp(opacity.current, open ? 0.08 : 1, 7, Math.min(dt, 0.1));
        const o = opacity.current;
        // Glass pavilions keep a translucent roof so meetings inside stay visible from outside.
        frontMats.roof.opacity = frontMats.roofTop.opacity = pad.style === 'glass' ? o * 0.45 : o;
        frontMats.solid.opacity = frontMats.frame.opacity = 0.25 + o * 0.75;
        frontMats.glass.opacity = back.glass.opacity * (0.4 + o * 0.6);
        frontMats.solid.depthWrite = frontMats.frame.depthWrite = o > 0.95;
        if (roof.current) {
            roof.current.visible = o > 0.1;
            frontMats.roof.depthWrite = pad.style !== 'glass' && o > 0.95;
            roof.current.traverse(child => { child.castShadow = o > 0.6; });
        }
    });
    const glassy = pad.style === 'glass', top = FLOOR + WALL_HEIGHT;
    return <group name={`shell-${pad.id}`}>
        {own.map((w, i) => <WallPiece key={i} wall={w} pad={pad} m={front(w) ? frontMats : back}/>)}
        {/* Header beam over each doorway */}
        {doors.map((w, i) => <Piece key={`d${i}`} x={w.x} y={FLOOR + HEADER + (WALL_HEIGHT - HEADER) / 2} z={w.z} w={w.w} h={WALL_HEIGHT - HEADER} d={w.d} material={front(w) ? (glassy ? frontMats.frame : frontMats.solid) : (glassy ? back.frame : back.solid)}/>)}
        {posts(pad).map(([x, z], i) => { const isFront = z > pad.z + pad.d / 2 - 0.1 || x > pad.x + pad.w / 2 - 0.1; return <Piece key={`p${i}`} x={x} y={FLOOR + WALL_HEIGHT / 2} z={z} w={0.14} h={WALL_HEIGHT} d={0.14} material={isFront ? frontMats.frame : back.frame}/>; })}
        <group ref={roof}>
            <Piece x={pad.x} y={top + 0.08} z={pad.z} w={pad.w + (glassy ? 0.3 : 0.6)} h={glassy ? 0.1 : 0.16} d={pad.d + (glassy ? 0.3 : 0.6)} material={frontMats.roof}/>
            {!glassy && <Piece x={pad.x} y={top + 0.19} z={pad.z} w={pad.w - 0.8} h={0.06} d={pad.d - 0.8} material={frontMats.roofTop} shadow={false}/>}
        </group>
    </group>;
}

export function Buildings({ player }: { player: RefObject<THREE.Vector3> }) {
    return <group name="buildings">{pads.filter(p => p.style !== 'plot').map(pad => <Shell key={pad.id} pad={pad} player={player}/>)}</group>;
}
