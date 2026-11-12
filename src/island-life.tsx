import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shoreDistance } from './shoreline';
import { garden } from './world';

// Decorations never take pointer hits away from walking or selecting a chair.
const ignorePointer = () => {};
const clouds = [
    { x: -13, z: 6, height: 5.4, scale: 0.8, speed: 0.11 },
    { x: -1, z: -7, height: 5.8, scale: 0.9, speed: 0.08 },
    { x: 13, z: 2, height: 5.2, scale: 0.7, speed: 0.095 },
    { x: -22, z: -21, height: 6.5, scale: 1.2, speed: 0.08 },
    { x: 9, z: -32, height: 7, scale: 1.1, speed: 0.1 },
];
const puffs = [[-1.15, 0, 0, 1.1], [-0.3, 0.25, 0.1, 1.4], [0.8, 0.12, 0, 1.2], [1.55, -0.05, 0.05, 0.8]];
const fireflies = Array.from({ length: 22 }, (_, i) => ({
    x: garden.x + Math.sin(i * 2.4) * (0.6 + (i % 4) * 0.5),
    z: garden.z + Math.cos(i * 2.4) * (0.6 + (i % 5) * 0.32),
    y: 0.5 + (i % 6) * 0.18,
    phase: i * 2.399,
}));
const shadowFragment = `
    varying vec2 vUv;
    uniform float strength;
    void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float shade = exp(-dot(p * vec2(1.0, 1.5), p * vec2(1.0, 1.5)) * 3.5);
        gl_FragColor = vec4(0.18, 0.25, 0.29, shade * strength);
    }
`;
const shadowVertex = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export function IslandLife({ motion, darkness }: { motion: boolean; darkness: number }) {
    const cloudGroup = useRef<THREE.Group>(null), shadowGroup = useRef<THREE.Group>(null), flyGroup = useRef<THREE.Group>(null);
    const elapsed = useRef(0), night = useRef(darkness);
    const cloudColor = useMemo(() => new THREE.Color(), []);
    const nightCloudColor = useMemo(() => new THREE.Color('#647b97'), []);
    useFrame((_, dt) => {
        // An independent clock freezes each effect in place when motion is paused.
        if (motion) elapsed.current += Math.min(dt, 0.05);
        const t = elapsed.current;
        night.current = THREE.MathUtils.damp(night.current, darkness, 2, Math.min(dt, 0.1));
        const evening = THREE.MathUtils.smoothstep(night.current, 0.4, 0.85);
        cloudColor.set('#fff9ed').lerp(nightCloudColor, night.current);
        cloudGroup.current?.children.forEach((cloud, i) => {
            const config = clouds[i];
            // Wrap outside the island, where a cloud cannot pop across the scene.
            cloud.position.set(((config.x + t * config.speed + 44) % 88) - 44, config.height, config.z + Math.sin(t * 0.035 + i) * 0.5);
            cloud.children.forEach(puff => {
                const material = (puff as THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>).material;
                material.color.copy(cloudColor); material.opacity = 0.76 - night.current * 0.25;
            });
            const shadow = shadowGroup.current?.children[i] as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | undefined;
            if (shadow) {
                shadow.position.set(cloud.position.x, 0.205, cloud.position.z);
                const edge = shoreDistance(cloud.position.x, cloud.position.z);
                shadow.material.uniforms.strength.value = 0.12 * (1 - night.current * 0.8) * (1 - THREE.MathUtils.smoothstep(edge, -2, -0.2));
            }
        });
        flyGroup.current?.children.forEach((fly, i) => {
            const seed = fireflies[i];
            fly.position.set(seed.x + Math.sin(t * 0.32 + seed.phase) * 0.4, seed.y + Math.sin(t * 0.55 + seed.phase) * 0.18, seed.z + Math.cos(t * 0.28 + seed.phase) * 0.35);
            const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.4 + seed.phase)) ** 2;
            fly.children.forEach((child, j) => {
                (child as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>).material.opacity = evening * pulse * (j === 0 ? 1 : 0.1);
            });
            fly.visible = evening > 0.005;
        });
    });
    return <group name="island-life">
        <group ref={cloudGroup} name="drifting-clouds">{clouds.map((cloud, i) => <group key={i} scale={cloud.scale}>{puffs.map(([x, y, z, size], j) => <mesh key={j} raycast={ignorePointer} position={[x, y, z]} scale={[size, size * 0.37, size * 0.65]}><sphereGeometry args={[1, 10, 7]}/><meshStandardMaterial transparent depthWrite={false} roughness={1} flatShading/></mesh>)}</group>)}</group>
        <group ref={shadowGroup} name="cloud-shadows">{clouds.map((cloud, i) => <mesh key={i} raycast={ignorePointer} rotation={[-Math.PI / 2, 0, 0]} scale={[cloud.scale, cloud.scale, 1]}><planeGeometry args={[7, 4.5]}/><shaderMaterial vertexShader={shadowVertex} fragmentShader={shadowFragment} uniforms={{ strength: { value: 0.12 } }} transparent depthWrite={false}/></mesh>)}</group>
        <group ref={flyGroup} name="garden-fireflies">{fireflies.map((_, i) => <group key={i}>
            <mesh raycast={ignorePointer}><sphereGeometry args={[0.027, 6, 4]}/><meshBasicMaterial color="#fff2a1" transparent depthWrite={false} toneMapped={false}/></mesh>
            <mesh raycast={ignorePointer}><sphereGeometry args={[0.105, 8, 6]}/><meshBasicMaterial color="#d8e98c" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}/></mesh>
        </group>)}</group>
    </group>;
}
