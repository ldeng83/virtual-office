import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { findPath, type Point } from './world';
import { ARRIVAL_DOCK, peopleView, type DemoCoworker, type Target } from './people';

// Shared avatar body so the player and coworkers always look like the same kind of person.
export function AvatarBody({ color, hair = '#5b5147' }: { color: string; hair?: string }) {
    return <>
        <mesh position={[0, 0.65, 0]} castShadow receiveShadow><cylinderGeometry args={[0.22, 0.26, 0.6, 12]}/><meshStandardMaterial color={color} roughness={0.9}/></mesh>
        <mesh position={[0, 1.17, 0]} castShadow><sphereGeometry args={[0.22, 16, 12]}/><meshStandardMaterial color="#e8bc98"/></mesh>
        <mesh position={[0, 1.29, -0.03]}><sphereGeometry args={[0.22, 12, 8]}/><meshStandardMaterial color={hair}/></mesh>
        {[-0.13, 0.13].map(x => <mesh key={x} position={[x, 0.22, 0]} castShadow receiveShadow><boxGeometry args={[0.17, 0.4, 0.19]}/><meshStandardMaterial color="#495b60" roughness={0.85}/></mesh>)}
    </>;
}

const SPEED = 2.4;

export function Coworker({ person, target, greeting }: { person: DemoCoworker; target: Target | null; greeting: string | null }) {
    const group = useRef<THREE.Group>(null);
    const pos = useRef(new THREE.Vector3(...(target ? [target.point[0], 0, target.point[1]] : [ARRIVAL_DOCK[0], 0, ARRIVAL_DOCK[1]]) as [number, number, number]));
    const path = useRef<Point[]>([]), present = useRef(!!target), leaving = useRef(false), walk = useRef(0), first = useRef(true);
    useEffect(() => {
        if (first.current) {
            // On page load coworkers are already where their routine says, not walking in.
            first.current = false;
            return;
        }
        const from: Point = [pos.current.x, pos.current.z];
        if (target) {
            if (!present.current) {
                pos.current.set(ARRIVAL_DOCK[0], 0, ARRIVAL_DOCK[1]);
                present.current = true;
            }
            leaving.current = false;
            path.current = findPath([pos.current.x, pos.current.z], target.point);
            if (!path.current.length)
                pos.current.set(target.point[0], 0, target.point[1]);
        }
        else if (present.current) {
            leaving.current = true;
            path.current = findPath(from, ARRIVAL_DOCK);
        }
    }, [target]);
    useEffect(() => () => { delete peopleView[person.id]; }, [person.id]);
    useFrame((_, dt) => {
        const g = group.current;
        if (!g)
            return;
        dt = Math.min(dt, 0.05);
        let moving = false;
        if (path.current.length) {
            const [tx, tz] = path.current[0], dx = tx - pos.current.x, dz = tz - pos.current.z, d = Math.hypot(dx, dz);
            const step = SPEED * dt;
            if (d <= step) {
                pos.current.set(tx, 0, tz);
                path.current.shift();
            }
            else {
                pos.current.x += dx / d * step;
                pos.current.z += dz / d * step;
                g.rotation.y = Math.atan2(dx, dz);
            }
            moving = true;
            walk.current += dt * 12;
            if (!path.current.length && leaving.current) {
                present.current = false;
                leaving.current = false;
            }
        }
        else if (target)
            g.rotation.y = target.angle;
        g.visible = present.current;
        g.position.copy(pos.current);
        g.position.y = moving ? Math.sin(walk.current) * 0.045 : target?.seatId ? -0.2 : 0;
        peopleView[person.id] = { x: pos.current.x, z: pos.current.z, present: present.current };
    });
    const status = target?.slot.status;
    return <group ref={group} name={`coworker-${person.id}`}>
        <AvatarBody color={person.color} hair={person.hair}/>
        <Html position={[0, 1.85, 0]} center zIndexRange={[20, 0]}>
            <div className="avatar-label coworker-label">
                {greeting && <div className="speech-bubble">{greeting}</div>}
                <i className={status === 'Available' ? '' : 'busy'}/>{person.name}
            </div>
        </Html>
    </group>;
}
