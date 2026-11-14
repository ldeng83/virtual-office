import { useMemo } from 'react';
import * as THREE from 'three';
import { ISLAND_SCALE, ISLAND_CENTER_Z, shorePoint } from './shoreline';
import type { Point } from './world';

function terrainGeometry(top: number, bottom: number, insetTop: number, insetBottom: number, sides = true) {
    const vertices: number[] = [], segments = 128;
    for (let i = 0; i < segments; i++) {
        const [ax, az] = shorePoint(i / segments * Math.PI * 2, -insetTop * ISLAND_SCALE);
        const [bx, bz] = shorePoint((i + 1) / segments * Math.PI * 2, -insetTop * ISLAND_SCALE);
        vertices.push(0, top, ISLAND_CENTER_Z, bx, top, bz, ax, top, az);
        if (sides) {
            const [cx, cz] = shorePoint(i / segments * Math.PI * 2, -insetBottom * ISLAND_SCALE);
            const [dx, dz] = shorePoint((i + 1) / segments * Math.PI * 2, -insetBottom * ISLAND_SCALE);
            vertices.push(cx, bottom, cz, ax, top, az, bx, top, bz, cx, bottom, cz, bx, top, bz, dx, bottom, dz);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
}
export function IslandTerrain({ onWalk }: { onWalk: (point: Point, dragDistance: number) => void }) {
    const sand = useMemo(() => terrainGeometry(-0.12, -0.42, 0.3, 0), []);
    const grass = useMemo(() => terrainGeometry(0.08, -0.22, 1.1, 0.7), []);
    const ground = useMemo(() => terrainGeometry(0.095, 0.095, 1.1, 1.1, false), []);
    return <group name="expanded-island">
        <mesh geometry={sand} receiveShadow><meshStandardMaterial color="#dfcc9e" roughness={0.9}/></mesh>
        <mesh geometry={grass} receiveShadow><meshStandardMaterial color="#a9bd8e" roughness={0.9}/></mesh>
        <mesh name="walkable-ground" geometry={ground} onClick={event => { event.stopPropagation(); onWalk([event.point.x, event.point.z], event.delta); }}><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>
    </group>;
}
