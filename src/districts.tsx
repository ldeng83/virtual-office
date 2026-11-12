import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { coastRocks, forestTrees, ponds, beach } from './world';

function Trunk({ p, scale = 1 }: { p: [number, number, number]; scale?: number }) {
    return <mesh position={p} scale={scale}><cylinderGeometry args={[0.12, 0.22, 2.4, 7]}/><meshStandardMaterial color="#947f61"/></mesh>;
}
function ForestTree({ x, z, index }: { x: number; z: number; index: number }) {
    const leaves = useRef<THREE.Group>(null), detailed = useRef<THREE.Group>(null), simple = useRef<THREE.Group>(null);
    const scale = 1 + (index % 4) * 0.13;
    useFrame(({ camera, controls }, dt) => {
        const focus = (controls as unknown as { target?: THREE.Vector3 })?.target;
        const near = camera.zoom > 18 && !!focus && Math.hypot(x - focus.x, z - focus.z) < 23;
        if (detailed.current) detailed.current.visible = near;
        if (simple.current) simple.current.visible = !near;
        if (focus && leaves.current) {
            const dx = focus.x - camera.position.x, dy = 1.2 - camera.position.y, dz = focus.z - camera.position.z;
            const along = ((x - camera.position.x) * dx + (2.8 * scale - camera.position.y) * dy + (z - camera.position.z) * dz) / (dx * dx + dy * dy + dz * dz);
            const gap = Math.hypot(x - camera.position.x - dx * along, 2.8 * scale - camera.position.y - dy * along, z - camera.position.z - dz * along);
            const opacity = near && along > 0.1 && along < 1 && gap < 2.1 * scale ? 0.22 : 1;
            leaves.current.children.forEach(leaf => {
                const material = (leaf as THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>).material;
                material.opacity = THREE.MathUtils.damp(material.opacity, opacity, 8, Math.min(dt, 0.1));
            });
        }
    });
    return <group name="forest-tree" position={[x, 0.08, z]} scale={scale}>
        <group ref={detailed} name="scenery-detail"><Trunk p={[0, 1.2, 0]}/><group ref={leaves}>{[0, 1, 2].map(n => <mesh key={n} castShadow position={[Math.sin(n * 2.1) * 0.45, 2.6 + n * 0.35, Math.cos(n * 2.1) * 0.4]} scale={[1.05, 0.85, 1]}><icosahedronGeometry args={[1, 1]}/><meshStandardMaterial color={index % 2 ? '#6d8b65' : '#7d9974'} flatShading transparent depthWrite={false}/></mesh>)}</group></group>
        <group ref={simple} name="scenery-simple"><Trunk p={[0, 1.2, 0]}/><mesh position={[0, 2.8, 0]} scale={[1.4, 1.3, 1.4]}><icosahedronGeometry args={[1, 0]}/><meshStandardMaterial color="#74916b" flatShading/></mesh></group>
    </group>;
}
function Disc({ x, z, radius, color, y = 0.1 }: { x: number; z: number; radius: number; color: string; y?: number }) {
    return <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[radius, 40]}/><meshStandardMaterial color={color} roughness={0.8}/></mesh>;
}
function FlowerPatch({ x, z, color }: { x: number; z: number; color: string }) {
    return <group position={[x, 0, z]}><Disc x={0} z={0} radius={0.8} color="#8eaa78"/>{[0, 1, 2, 3, 4].map(n => <mesh key={n} position={[Math.sin(n * 2.4) * 0.5, 0.32, Math.cos(n * 2.4) * 0.5]}><icosahedronGeometry args={[0.15, 0]}/><meshStandardMaterial color={color}/></mesh>)}</group>;
}
export function DistrictScenery() {
    return <group name="district-scenery">
        {forestTrees.map(([x, z], i) => <ForestTree key={i} x={x} z={z} index={i}/>)}
        {ponds.map((pond, i) => <group key={i} position={[pond.x, 0, pond.z]}><mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[pond.rx, pond.rz, 1]}><circleGeometry args={[1.1, 48]}/><meshStandardMaterial color="#b6b997"/></mesh><mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[pond.rx, pond.rz, 1]}><circleGeometry args={[1, 48]}/><meshStandardMaterial color="#83b6ab" metalness={0.15} roughness={0.3}/></mesh>{[0, 1, 2, 3, 4].map(n => <Disc key={n} x={Math.sin(n * 2) * 1.8} z={Math.cos(n * 2) * 1.3} radius={0.28} color="#9cb77a" y={0.14}/>)}</group>)}
        <mesh position={[beach.x, 0.095, beach.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.2, 1, 1]} receiveShadow><circleGeometry args={[beach.radius, 48]}/><meshStandardMaterial color="#e1c99f"/></mesh>
        <Disc x={beach.x} z={beach.z} radius={1.15} color="#b4a38b" y={0.115}/>
        {[0, 1, 2].map(n => <mesh key={n} position={[beach.x, 0.23 + n * 0.1, beach.z]} rotation={[0, n * 1.1, 0]}><boxGeometry args={[1.1, 0.2, 0.2]}/><meshStandardMaterial color="#927555"/></mesh>)}
        <mesh position={[beach.x, 0.72, beach.z]}><coneGeometry args={[0.35, 1, 7]}/><meshStandardMaterial color="#efb96c" emissive="#ed9e4f" emissiveIntensity={0.6}/></mesh>
        {[0, 1].map(n => <group key={n} position={[22 + n * 2, 0, -8]}><Trunk p={[0, 0.85, 0]} scale={0.7}/></group>)}
        <mesh position={[23, 0.9, -8]} rotation={[0, 0, -0.1]}><boxGeometry args={[2.1, 0.08, 0.7]}/><meshStandardMaterial color="#c9ab7c"/></mesh>
        <Disc x={7} z={-30} radius={4.6} color="#b4c799"/>
        {Array.from({ length: 12 }, (_, i) => <FlowerPatch key={i} x={7 + Math.cos(i * Math.PI / 6) * 4} z={-30 + Math.sin(i * Math.PI / 6) * 4} color={['#dfb276', '#d8b7bd', '#ebe3b5'][i % 3]}/>)}
        <group position={[10, 0.16, -35]}>
            <mesh receiveShadow><boxGeometry args={[4.5, 0.17, 3]}/><meshStandardMaterial color="#bda27e"/></mesh>
            {Array.from({ length: 11 }, (_, i) => <mesh key={i} position={[-2 + i * 0.4, 0.1, 0]}><boxGeometry args={[0.025, 0.02, 3]}/><meshStandardMaterial color="#9c896c"/></mesh>)}
            {[-2, 2].map(x => <mesh key={x} position={[x, 0.6, -1.3]}><boxGeometry args={[0.1, 1.2, 0.1]}/><meshStandardMaterial color="#ac9370"/></mesh>)}
            <mesh position={[0, 1.1, -1.3]}><boxGeometry args={[4.2, 0.1, 0.1]}/><meshStandardMaterial color="#ac9370"/></mesh>
        </group>
        {coastRocks.map(([x, z, r], i) => <mesh key={i} position={[x, r * 0.35, z]} scale={[r, r * 0.7, r * 0.85]} castShadow><dodecahedronGeometry args={[1, 0]}/><meshStandardMaterial color={i % 2 ? '#a4aaa1' : '#939d99'} flatShading/></mesh>)}
        <Disc x={-24} z={-5.5} radius={1.1} color="#a3c0b2" y={0.105}/>
    </group>;
}
