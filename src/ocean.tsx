import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { IslandTime } from './atmosphere';
import { periods } from './daylight';

const palettes = {
    dawn: ['#769aaf', '#b2d9d1', '#eededc', '#ffe5d1'],
    morning: ['#5aabba', '#91ddcb', '#e0f4e7', '#fff6d9'],
    midday: ['#4f9fb7', '#89ddce', '#e1f5e7', '#fffce5'],
    golden: ['#899eae', '#b4cfc2', '#f4dfc5', '#ffe0ac'],
    dusk: ['#626e94', '#889faa', '#c4c7da', '#e4d4f0'],
    night: ['#233f59', '#437e86', '#8bb8c2', '#c7e5f3'],
};
const vertexShader = `
    varying vec2 vOcean;
    varying vec3 vSurface;
    uniform float time;
    void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vOcean = world.xz;
        float offshore = smoothstep(10.6, 13.0, length(vec2(world.x / 1.28, world.z)));
        float swell = sin(world.x * 0.55 + world.z * 0.32 - time * 0.85) * 0.08
                    + sin(world.x * -0.28 + world.z * 0.7 - time * 0.62) * 0.045;
        world.y += swell * offshore;
        vSurface = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;
const fragmentShader = `
    varying vec2 vOcean;
    varying vec3 vSurface;
    uniform float time;
    uniform vec3 lightDirection;
    uniform float shallowLight;
    uniform vec3 deepColor;
    uniform vec3 shallowColor;
    uniform vec3 foamColor;
    uniform vec3 glintColor;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float caustic(vec2 p) {
        vec2 q = p + vec2(sin(p.y * 1.5 + time * 0.32), cos(p.x * 1.3 - time * 0.27)) * 0.3;
        float a = sin(q.x * 3.3 + q.y * 1.8 + time * 0.21);
        float b = sin(q.x * -2.1 + q.y * 3.5 - time * 0.18);
        return pow(1.0 - abs(a * 0.5 + b * 0.5), 12.0);
    }
    void main() {
        vec2 p = vOcean;
        vec2 coast = vec2(p.x / 1.28, p.y);
        float radius = length(coast);
        float shore = radius - 10.4;
        float angle = atan(coast.y, coast.x);
        float wave = sin(p.x * 0.72 + p.y * 0.46 - time * 0.45)
                   + sin(p.x * -0.34 + p.y * 0.65 + time * 0.3);
        float shallows = exp(-max(shore, 0.0) * 0.48);
        vec3 water = mix(deepColor, shallowColor, shallows * 0.85);
        water += wave * 0.018 * exp(-max(shore, 0.0) * 0.075);

        // Slow crossing swells catch broad highlights as their slopes turn.
        float swellA = p.x * 0.55 + p.y * 0.32 - time * 0.85;
        float swellB = p.x * -0.28 + p.y * 0.7 - time * 0.62;
        vec2 slope = vec2(cos(swellA) * 0.11 + cos(swellB) * -0.045,
                          cos(swellA) * 0.064 + cos(swellB) * 0.11);
        vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
        vec3 viewDirection = normalize(cameraPosition - vSurface);
        vec3 halfway = normalize(normalize(lightDirection) + viewDirection);
        float reflection = pow(max(dot(normal, halfway), 0.0), 38.0);
        float ridges = pow(0.5 + 0.5 * sin(swellA + sin(swellB) * 0.5), 7.0);
        float offshore = smoothstep(0.4, 2.0, shore);
        float nearIsland = exp(-max(shore, 0.0) * 0.035);
        water = mix(water, glintColor, (reflection * 0.27 + ridges * 0.055) * offshore * nearIsland);

        // Refracted light drifts through the shallow shelf close to the sand.
        float shelf = smoothstep(0.1, 0.65, shore) * (1.0 - smoothstep(1.8, 4.3, shore));
        float lightPattern = caustic(p * 0.85) * shelf;
        water = mix(water, foamColor, lightPattern * 0.15 * shallowLight);

        // Broken wave fronts roll inward, dissolve at the beach, and start offshore.
        float drift = sin(angle * 7.0 + time * 0.24) * 0.11 + sin(angle * 13.0 + time * 0.16) * 0.065;
        float cycle = fract((shore + drift) * 0.63 + time * 0.085);
        float crest = smoothstep(0.78, 0.9, cycle) * (1.0 - smoothstep(0.92, 1.0, cycle));
        float broken = smoothstep(-0.5, 0.45, sin(angle * 12.0 + shore * 2.5) + sin(angle * 21.0 - time * 0.12) * 0.5);
        float coastMask = smoothstep(0.02, 0.2, shore) * (1.0 - smoothstep(1.0, 3.1, shore));
        float foam = crest * broken * coastMask;
        float wash = exp(-pow((shore - 0.16 - sin(time * 0.55 + angle * 4.0) * 0.08) * 9.0, 2.0));
        water = mix(water, foamColor, foam * 0.48 + wash * 0.24);

        // A sparse, stable grid of small highlights avoids full-screen glitter.
        vec2 cell = floor(p * 1.15);
        float seed = hash(cell);
        vec2 center = vec2(hash(cell + 7.3), hash(cell + 19.1)) * 0.65 + 0.175;
        vec2 delta = abs(fract(p * 1.15) - center);
        float crossLight = exp(-delta.x * 140.0 - delta.y * 20.0)
                         + exp(-delta.x * 25.0 - delta.y * 150.0);
        float twinkle = pow(0.5 + 0.5 * sin(time * 1.25 + seed * 60.0), 8.0);
        float spark = crossLight * step(0.94, seed) * twinkle * smoothstep(0.35, 1.0, shore);
        water = mix(water, glintColor, clamp(spark * 0.85, 0.0, 0.8));
        float clarity = mix(0.66, 0.88, smoothstep(1.0, 7.0, max(shore, 0.0)));
        gl_FragColor = vec4(water, clarity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

export function Ocean({ motion, time }: { motion: boolean; time: IslandTime }) {
    const material = useRef<THREE.ShaderMaterial>(null);
    const seabed = useRef<THREE.MeshBasicMaterial>(null);
    const elapsed = useRef(0);
    const target = useMemo(() => palettes[time.from].map((color, i) => new THREE.Color(color).lerp(new THREE.Color(palettes[time.to][i]), time.progress)), [time.from, time.to, time.progress]);
    const direction = useMemo(() => new THREE.Vector3(...periods[time.from].position).lerp(new THREE.Vector3(...periods[time.to].position), time.progress).normalize(), [time.from, time.to, time.progress]);
    const shallowLight = 1 - THREE.MathUtils.lerp(periods[time.from].darkness, periods[time.to].darkness, time.progress) * 0.75;
    const uniforms = useMemo(() => ({ time: { value: 0 }, lightDirection: { value: direction.clone() }, shallowLight: { value: shallowLight }, deepColor: { value: target[0].clone() }, shallowColor: { value: target[1].clone() }, foamColor: { value: target[2].clone() }, glintColor: { value: target[3].clone() } }), []);
    useFrame((_, dt) => {
        if (motion) elapsed.current += Math.min(dt, 0.05);
        if (!material.current) return;
        const values = material.current.uniforms;
        values.time.value = elapsed.current;
        const alpha = motion ? 1 - Math.exp(-Math.min(dt, 0.1) * 2) : 1;
        values.lightDirection.value.lerp(direction, alpha).normalize();
        values.shallowLight.value = THREE.MathUtils.lerp(values.shallowLight.value, shallowLight, alpha);
        if (seabed.current) seabed.current.color.copy(values.deepColor.value).multiplyScalar(0.7);
        ['deepColor', 'shallowColor', 'foamColor', 'glintColor'].forEach((key, i) => values[key].value.lerp(target[i], alpha));
    });
    return <><mesh name="ocean-floor" raycast={() => {}} rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.5, 0]}><planeGeometry args={[240, 240]}/><meshBasicMaterial ref={seabed} color="#427c96"/></mesh><mesh name="ocean" renderOrder={-1} raycast={() => {}} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <planeGeometry args={[240, 240, 192, 192]}/>
        <shaderMaterial ref={material} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} transparent depthWrite={false}/>
    </mesh></>;
}
