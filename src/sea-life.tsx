import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { animalRoute, type SeaAnimal } from './sea-life-motion';

const ignorePointer = () => {};
function Blob({ position = [0, 0, 0], scale = [1, 1, 1], color }: { position?: [number, number, number]; scale?: [number, number, number]; color: string }) {
    return <mesh raycast={ignorePointer} position={position} scale={scale}><sphereGeometry args={[1, 10, 7]}/><meshStandardMaterial color={color} roughness={0.8} flatShading/></mesh>;
}
function Fin({ side = 1, color, length = 0.7, width = 0.4 }: { side?: number; color: string; length?: number; width?: number }) {
    const geometry = useMemo(() => {
        const result = new THREE.BufferGeometry();
        result.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, side * length, -0.03, -width, 0, 0, -0.45], 3));
        result.computeVertexNormals(); return result;
    }, [side, length, width]);
    return <mesh raycast={ignorePointer} geometry={geometry}><meshStandardMaterial color={color} side={THREE.DoubleSide} flatShading/></mesh>;
}
function Turtle() {
    return <><Blob scale={[0.43, 0.2, 0.57]} color="#718a50"/><Blob position={[0, 0.1, 0]} scale={[0.33, 0.16, 0.45]} color="#a2ad69"/><Blob position={[0, 0.015, 0.67]} scale={[0.17, 0.12, 0.21]} color="#8ba878"/>{[-1, 1].map(side => <group key={side} name="flipper" position={[side * 0.32, -0.08, 0.15]}><Blob position={[side * 0.2, 0, -0.04]} scale={[0.36, 0.045, 0.17]} color="#8ba878"/></group>)}{[-1, 1].map(side => <Blob key={side} position={[side * 0.28, -0.07, -0.45]} scale={[0.19, 0.04, 0.13]} color="#8ba878"/>)}{[-1, 1].map(side => <Blob key={side} position={[side * 0.12, 0.08, 0.75]} scale={[0.025, 0.025, 0.025]} color="#354d43"/>)}</>;
}
function Fish({ index }: { index: number }) {
    const color = ['#e6b15d', '#ed9978', '#bad5bd'][index % 3];
    return <group position={[(index % 3 - 1) * 0.42, (index % 2) * 0.06, -Math.floor(index / 3) * 0.6]}><Blob scale={[0.085, 0.08, 0.24]} color={color}/><group name="fish-tail" position={[0, 0, -0.23]}><Blob scale={[0.16, 0.025, 0.11]} color={color}/></group></group>;
}
function Dolphin() {
    return <><Blob scale={[0.25, 0.23, 0.88]} color="#799da8"/><Blob position={[0, -0.08, 0.18]} scale={[0.19, 0.14, 0.67]} color="#c5d7d0"/><Blob position={[0, 0, 0.88]} scale={[0.11, 0.09, 0.3]} color="#799da8"/><group rotation={[0, 0, Math.PI / 2]} position={[0, 0.16, -0.16]}><Fin color="#648b99" length={0.38} width={0.2}/></group>{[-1, 1].map(side => <Fin key={side} side={side} color="#648b99" length={0.5}/>)}<group name="dolphin-tail" position={[0, 0, -0.85]}><Blob scale={[0.46, 0.045, 0.18]} color="#648b99"/></group>{[-1, 1].map(side => <Blob key={side} position={[side * 0.19, 0.07, 0.63]} scale={[0.025, 0.025, 0.025]} color="#294957"/>)}</>;
}
function Manta() {
    return <><Blob scale={[0.32, 0.09, 0.6]} color="#527d85"/>{[-1, 1].map(side => <group name="manta-wing" key={side}><Fin side={side} length={1.15} width={0.7} color="#688e94"/></group>)}<Blob position={[0, 0, -0.97]} scale={[0.025, 0.025, 0.65]} color="#527d85"/>{[-1, 1].map(side => <Blob key={side} position={[side * 0.2, 0, 0.5]} scale={[0.08, 0.05, 0.22]} color="#688e94"/>)}</>;
}
function Crab() {
    return <><Blob scale={[0.22, 0.12, 0.16]} color="#c9815e"/>{[-1, 1].flatMap(side => [0, 1, 2].map(n => <group name="crab-leg" key={`${side}-${n}`} position={[side * 0.14, 0, -0.1 + n * 0.1]}><Blob position={[side * 0.13, -0.045, 0]} scale={[0.19, 0.025, 0.035]} color="#b97758"/></group>))}{[-1, 1].map(side => <group key={side}><Blob position={[side * 0.26, 0.05, 0.19]} scale={[0.1, 0.07, 0.13]} color="#db9970"/><Blob position={[side * 0.085, 0.15, 0.1]} scale={[0.035, 0.035, 0.035]} color="#354d43"/></group>)}</>;
}
const inhabitants: { kind: SeaAnimal; index: number }[] = [
    ...[0, 1].map(index => ({ kind: 'turtle' as const, index })),
    ...[0, 1, 2].map(index => ({ kind: 'school' as const, index })),
    ...[0, 1].map(index => ({ kind: 'dolphin' as const, index })),
    ...[0, 1].map(index => ({ kind: 'ray' as const, index })),
    ...[0, 1, 2].map(index => ({ kind: 'crab' as const, index })),
];
export function SeaLife({ motion }: { motion: boolean }) {
    const group = useRef<THREE.Group>(null), elapsed = useRef(0);
    useFrame((_, dt) => {
        if (motion) elapsed.current += Math.min(dt, 0.05);
        const t = elapsed.current;
        group.current?.children.forEach((animal, i) => {
            const { kind, index } = inhabitants[i], route = animalRoute(kind, index, t);
            animal.position.set(route.x, route.y, route.z);
            animal.rotation.set(route.pitch, route.heading, 0, 'YXZ');
            animal.traverse(part => {
                if (part.name === 'flipper') part.rotation.z = Math.sin(t * 2.2 + index) * 0.3 * Math.sign(part.position.x);
                if (part.name === 'manta-wing') part.rotation.z = Math.sin(t * 1.5 + index) * 0.24 * ((part.children[0] as THREE.Mesh).geometry.attributes.position.getX(1) > 0 ? 1 : -1);
                if (part.name === 'fish-tail') part.rotation.y = Math.sin(t * 7 + i) * 0.35;
                if (part.name === 'dolphin-tail') part.rotation.x = Math.sin(t * 4 + index) * 0.25;
                if (part.name === 'crab-leg') part.rotation.y = Math.sin(t * 9 + part.position.z * 15) * route.activity * 0.25;
            });
        });
    });
    return <group ref={group} name="sea-life">{inhabitants.map(({ kind, index }) => <group key={`${kind}-${index}`} name={`${kind}-${index}`}>
        {kind === 'turtle' ? <Turtle/> : kind === 'school' ? Array.from({ length: 7 }, (_, n) => <Fish key={n} index={n}/>) : kind === 'dolphin' ? <Dolphin/> : kind === 'ray' ? <Manta/> : <Crab/>}
    </group>)}</group>;
}
