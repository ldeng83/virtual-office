import { useMemo } from 'react';
import * as THREE from 'three';
import { amphitheater, boardwalk, booths, garden, newsScreen, pads, plaza, ponds, tables, walkways, type Point } from './world';

// The campus ground plan: paving, building floors, furniture, gardens and the boardwalk.
// Building shells (walls, glass, roofs) come in the next phase; seats and desks render in main.tsx.
const ignore = () => {};
type V3 = [number, number, number];
function Box({ p, s, c, r = 0, rough = 0.85, shadow = true }: { p: V3; s: V3; c: string; r?: number; rough?: number; shadow?: boolean }) {
    return <mesh position={p} rotation={[0, r, 0]} castShadow={shadow} receiveShadow><boxGeometry args={s}/><meshStandardMaterial color={c} roughness={rough}/></mesh>;
}
function Cyl({ p, r, h, c, r2, seg = 20 }: { p: V3; r: number; h: number; c: string; r2?: number; seg?: number }) {
    return <mesh position={p} castShadow receiveShadow><cylinderGeometry args={[r, r2 ?? r, h, seg]}/><meshStandardMaterial color={c} roughness={0.85}/></mesh>;
}
function Disc({ x, z, r, c, y = 0.11, sx = 1, sz = 1 }: { x: number; z: number; r: number; c: string; y?: number; sx?: number; sz?: number }) {
    return <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[sx, sz, 1]} receiveShadow raycast={ignore}><circleGeometry args={[r, 48]}/><meshStandardMaterial color={c} roughness={0.9}/></mesh>;
}
const PAVING = '#e2d8bd', PATH = '#e7dcbc', CONCRETE = '#ebe6d8', GLASS_FLOOR = '#dde8e3', TIMBER = '#c7a57c', DARK = '#3d5650';
// Segments drawn as flat ribbons; floors stay below furniture so clicks still reach the ground.
function Ribbon({ a, b, width, color, y }: { a: Point; b: Point; width: number; color: string; y: number }) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    return <mesh position={[(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2]} rotation={[0, Math.atan2(dx, dz), 0]} receiveShadow raycast={ignore}>
        <boxGeometry args={[width, 0.04, Math.hypot(dx, dz) + width * 0.4]}/><meshStandardMaterial color={color} roughness={0.9}/>
    </mesh>;
}
function Screen({ x, z, w, h, y, facing }: { x: number; z: number; w: number; h: number; y: number; facing: number }) {
    return <group position={[x, 0, z]} rotation={[0, facing, 0]}>
        {[-w / 2 + 0.1, w / 2 - 0.1].map(px => <Box key={px} p={[px, y / 2, -0.05]} s={[0.07, y, 0.07]} c="#7f8b75"/>)}
        <Box p={[0, y + h / 2 - 0.2, -0.05]} s={[w, h, 0.08]} c={DARK}/>
        <mesh position={[0, y + h / 2 - 0.2, 0]}><planeGeometry args={[w - 0.2, h - 0.2]}/><meshStandardMaterial color="#5f8a80" emissive="#7fb7a8" emissiveIntensity={0.35}/></mesh>
    </group>;
}

export function Campus() {
    const boardwalkPoints = useMemo(() => new THREE.QuadraticBezierCurve(new THREE.Vector2(...boardwalk.from), new THREE.Vector2(...boardwalk.bend), new THREE.Vector2(...boardwalk.to)).getPoints(12).map(v => [v.x, v.y] as Point), []);
    return <group name="campus">
        {/* Walkways */}
        {walkways.map((path, i) => path.slice(1).map((b, j) => <Ribbon key={`${i}-${j}`} a={path[j]} b={b} width={1.4} color={PATH} y={0.105}/>))}

        {/* Central plaza: paving, fountain, news screen, lamp posts (bulbs glow from atmosphere.tsx) */}
        <Disc x={plaza.x} z={plaza.z} r={plaza.radius + 0.25} c="#d5c9a8" y={0.108}/>
        <Disc x={plaza.x} z={plaza.z} r={plaza.radius} c={PAVING} y={0.112}/>
        <Disc x={plaza.x} z={plaza.z} r={plaza.radius * 0.62} c="#e9e0c8" y={0.114}/>
        <Cyl p={[plaza.x, 0.25, plaza.z]} r={plaza.fountain} h={0.32} c="#d9d2bf" seg={36}/>
        <Disc x={plaza.x} z={plaza.z} r={plaza.fountain - 0.15} c="#8cc3c6" y={0.42}/>
        <Cyl p={[plaza.x, 0.7, plaza.z]} r={0.12} h={0.6} c="#d9d2bf"/>
        <Cyl p={[plaza.x, 1.02, plaza.z]} r={0.45} r2={0.2} h={0.12} c="#d9d2bf"/>
        <mesh position={[plaza.x, 1.2, plaza.z]} raycast={ignore}><sphereGeometry args={[0.22, 12, 8]}/><meshStandardMaterial color="#c9ecef" transparent opacity={0.55}/></mesh>
        <Screen x={newsScreen.x} z={newsScreen.z} w={newsScreen.w} h={1.7} y={1.6} facing={0}/>
        {Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4 + Math.PI / 8; return <Cyl key={i} p={[plaza.x + Math.cos(a) * (plaza.radius + 0.6), 1, plaza.z + Math.sin(a) * (plaza.radius + 0.6)]} r={0.05} h={2} c="#6f7d6c"/>; })}

        {/* Building pads: concrete floors for buildings, pale floors for glass pavilions, a dashed border for the future plot */}
        {pads.map(pad => pad.style === 'plot'
            ? <group key={pad.id} name={`pad-${pad.id}`}>{Array.from({ length: 10 }, (_, i) => { const t = (i + 0.5) / 10; return <group key={i}>
                <Box p={[pad.x - pad.w / 2 + t * pad.w, 0.13, pad.z - pad.d / 2]} s={[pad.w / 20, 0.05, 0.12]} c="#6d8a73" shadow={false}/>
                <Box p={[pad.x - pad.w / 2 + t * pad.w, 0.13, pad.z + pad.d / 2]} s={[pad.w / 20, 0.05, 0.12]} c="#6d8a73" shadow={false}/>
                {i < 6 && <Box p={[pad.x - pad.w / 2, 0.13, pad.z - pad.d / 2 + (i + 0.5) / 6 * pad.d]} s={[0.12, 0.05, pad.d / 12]} c="#6d8a73" shadow={false}/>}
                {i < 6 && <Box p={[pad.x + pad.w / 2, 0.13, pad.z - pad.d / 2 + (i + 0.5) / 6 * pad.d]} s={[0.12, 0.05, pad.d / 12]} c="#6d8a73" shadow={false}/>}
            </group>; })}<Box p={[pad.x - pad.w / 2 + 0.4, 0.45, pad.z + pad.d / 2 + 0.4]} s={[0.06, 0.7, 0.06]} c="#7f8b75"/><Box p={[pad.x - pad.w / 2 + 0.4, 0.85, pad.z + pad.d / 2 + 0.4]} s={[0.9, 0.4, 0.05]} c="#f2efe4"/></group>
            : <group key={pad.id} name={`pad-${pad.id}`}>
                <mesh position={[pad.x, 0.1, pad.z]} receiveShadow raycast={ignore}><boxGeometry args={[pad.w + 0.3, 0.06, pad.d + 0.3]}/><meshStandardMaterial color={pad.style === 'glass' ? '#b9cdc6' : '#cdc4ad'}/></mesh>
                <mesh position={[pad.x, 0.125, pad.z]} receiveShadow raycast={ignore}><boxGeometry args={[pad.w, 0.06, pad.d]}/><meshStandardMaterial color={pad.style === 'glass' ? GLASS_FLOOR : CONCRETE} roughness={0.7}/></mesh>
            </group>)}

        {/* Lobby: reception desk and a planter */}
        <Box p={[tables.reception.x, 0.5, tables.reception.z]} s={[tables.reception.w, 0.9, tables.reception.d]} c="#d9ccb0"/>
        <Box p={[tables.reception.x, 0.97, tables.reception.z]} s={[tables.reception.w + 0.1, 0.06, tables.reception.d + 0.1]} c={TIMBER}/>
        <Cyl p={[-3.4, 0.35, 3.9]} r={0.35} h={0.5} c="#cfc6b0"/><mesh position={[-3.4, 0.95, 3.9]} castShadow><icosahedronGeometry args={[0.5, 1]}/><meshStandardMaterial color="#7b9c79" flatShading/></mesh>

        {/* Main workspace: planted atrium between the two team areas (desks render in main.tsx) */}
        <Box p={[tables.atrium.x, 0.3, tables.atrium.z]} s={[tables.atrium.w, 0.4, tables.atrium.d]} c="#cfc6b0"/>
        <Box p={[tables.atrium.x, 0.52, tables.atrium.z]} s={[tables.atrium.w - 0.2, 0.06, tables.atrium.d - 0.2]} c="#8fae7c"/>
        <Cyl p={[tables.atrium.x, 1.3, tables.atrium.z]} r={0.1} r2={0.16} h={1.6} c="#9c8467"/>
        <mesh position={[tables.atrium.x, 2.35, tables.atrium.z]} castShadow><icosahedronGeometry args={[0.95, 1]}/><meshStandardMaterial color="#6f9471" flatShading/></mesh>

        {/* Pavilion S: two armchairs (seats) around a small round table */}
        <Cyl p={[tables.pavS.x, 0.3, tables.pavS.z]} r={tables.pavS.r} h={0.08} c={TIMBER}/><Cyl p={[tables.pavS.x, 0.15, tables.pavS.z]} r={0.05} h={0.3} c="#7f8b75"/>
        {/* Pavilion M and L: meeting tables and wall screens */}
        {[tables.pavM, tables.pavL].map((t, i) => <group key={i}>
            <Box p={[t.x, 0.75, t.z]} s={[t.w, 0.08, t.d]} c="#e1cda8"/>
            {[-1, 1].map(sx => [-1, 1].map(sz => <Box key={`${sx}${sz}`} p={[t.x + sx * (t.w / 2 - 0.2), 0.37, t.z + sz * (t.d / 2 - 0.15)]} s={[0.07, 0.72, 0.07]} c="#7f8b75"/>))}
        </group>)}
        <Screen x={19} z={-16.4} w={2.6} h={1.4} y={1} facing={0}/>
        <Screen x={17} z={-28.4} w={4} h={1.6} y={1} facing={0}/>

        {/* Focus library: six booths with a desk, side panels and a lamp */}
        {booths.map(b => <group key={b.id} position={[b.x, 0, b.z]}>
            <Box p={[0, 0.75, -0.45]} s={[1.5, 0.07, 0.6]} c="#e1cda8"/>
            <Box p={[0, 0.37, -0.7]} s={[1.4, 0.72, 0.06]} c="#bda98a"/>
            {[-1.1, 1.1].map(x => <Box key={x} p={[x, 0.7, -0.2]} s={[0.08, 1.4, 1.5]} c="#d7cdb4"/>)}
            <Box p={[0, 1.2, -0.95]} s={[2.2, 0.9, 0.08]} c="#d7cdb4"/>
            <Cyl p={[0.5, 0.95, -0.55]} r={0.02} h={0.35} c="#6f7d6c"/>
            <mesh position={[0.5, 1.13, -0.55]}><sphereGeometry args={[0.07, 10, 8]}/><meshStandardMaterial color="#ffe6b0" emissive="#ffcf87" emissiveIntensity={0.5}/></mesh>
        </group>)}

        {/* Café: counter with an espresso machine, terrace tables under umbrellas */}
        <Box p={[tables.counter.x, 0.5, tables.counter.z]} s={[tables.counter.w, 0.95, tables.counter.d]} c="#d9ccb0"/>
        <Box p={[tables.counter.x, 1, tables.counter.z]} s={[tables.counter.w + 0.1, 0.06, tables.counter.d + 0.1]} c={TIMBER}/>
        <Box p={[tables.counter.x + 1.2, 1.25, tables.counter.z - 0.1]} s={[0.55, 0.45, 0.4]} c="#a9b3ad"/>
        {tables.terrace.map(([x, z], i) => <group key={i} position={[x, 0, z]}>
            <Cyl p={[0, 0.72, 0]} r={0.45} h={0.06} c="#e1cda8"/><Cyl p={[0, 0.36, 0]} r={0.05} h={0.72} c="#7f8b75"/>
            <Cyl p={[0, 1.4, 0]} r={0.035} h={1.4} c="#e9e2cc"/>
            <mesh position={[0, 2.15, 0]} castShadow><coneGeometry args={[1.2, 0.45, 10]}/><meshStandardMaterial color={i ? '#e8a27f' : '#f0c39c'}/></mesh>
        </group>)}

        {/* Town hall amphitheater: three stepped tiers around a round stage */}
        <Cyl p={[amphitheater.x, 0.18, amphitheater.z]} r={amphitheater.stage} h={0.16} c="#d2b68d" seg={32}/>
        {amphitheater.tiers.map((r, tier) => { const count = Math.ceil(r * (amphitheater.to - amphitheater.from) / 0.8); return Array.from({ length: count }, (_, i) => {
            const a = amphitheater.from + (i + 0.5) / count * (amphitheater.to - amphitheater.from);
            return <Box key={`${tier}-${i}`} p={[amphitheater.x + Math.cos(a) * r, 0.1 + 0.08 * (tier + 1), amphitheater.z + Math.sin(a) * r]} s={[0.95, 0.16 * (tier + 1), r * (amphitheater.to - amphitheater.from) / count + 0.05]} c={['#ddd2b4', '#d6caa9', '#cfc29f'][tier]} r={-a} shadow={false}/>;
        }); })}

        {/* Wellness garden: walking loop around the pond, yoga deck, flower beds */}
        <mesh position={[garden.x, 0.108, garden.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[garden.loopX, garden.loopZ, 1]} receiveShadow raycast={ignore}><ringGeometry args={[0.88, 1.12, 64]}/><meshStandardMaterial color={PATH}/></mesh>
        {ponds.map((p, i) => <group key={i}>
            <Disc x={p.x} z={p.z} r={1.12} c="#c9bfa3" sx={p.rx} sz={p.rz} y={0.105}/>
            <Disc x={p.x} z={p.z} r={1} c="#83b6ab" sx={p.rx} sz={p.rz} y={0.115}/>
            {[0, 1, 2].map(n => <Disc key={n} x={p.x - 0.8 + n * 0.9} z={p.z + (n - 1) * 0.35} r={0.22} c="#9ebf7b" y={0.125}/>)}
        </group>)}
        <Box p={[-17.6, 0.16, -31.5]} s={[2.6, 0.12, 2.2]} c={TIMBER}/>
        {[-0.6, 0.6].map(x => <Box key={x} p={[-17.6 + x, 0.23, -31.5]} s={[0.6, 0.02, 1.5]} c={x < 0 ? '#9cc0b3' : '#e0a8b4'} shadow={false}/>)}
        {[[garden.x + 5.2, garden.z + 3.2], [garden.x - 4.6, garden.z - 2.8], [garden.x + 4.4, garden.z - 2.8], [garden.x - 4.8, garden.z + 3.4]].map(([x, z], i) => <group key={i} position={[x, 0, z]}><Disc x={0} z={0} r={0.75} c="#8eaa78" y={0.112}/>{[0, 1, 2, 3, 4].map(n => <mesh key={n} position={[Math.sin(n * 2.4) * 0.45, 0.3, Math.cos(n * 2.4) * 0.45]} raycast={ignore}><icosahedronGeometry args={[0.16, 0]}/><meshStandardMaterial color={['#e4a7b8', '#efd27e', '#f2ede0', '#c9a7e0'][(i + n) % 4]}/></mesh>)}</group>)}

        {/* Boardwalk along the east beach (loungers render as seats) */}
        {boardwalkPoints.slice(1).map((b, i) => <group key={i}>
            <Ribbon a={boardwalkPoints[i]} b={b} width={3.4} color="#e8d6a8" y={0.1}/>
            <Ribbon a={boardwalkPoints[i]} b={b} width={1.4} color="#c39f73" y={0.14}/>
        </group>)}
    </group>;
}
