import { useEffect, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { findPath, type Point } from './world';
import { ARRIVAL_DOCK, peopleView, type DemoCoworker, type Target } from './people';

// Shared avatar body so the player and coworkers always look like the same kind of person.
// The head and torso are separate groups so coworkers can look around and breathe.
//
// X-ray: every visible avatar pixel marks the stencil buffer; a second, flat tinted copy is then
// drawn only where the avatar is behind something (depth test "greater") and not where the avatar
// itself is visible, so you can always see people through trees, roofs, and canopies.
const parts = {
    torso: new THREE.CylinderGeometry(0.22, 0.26, 0.6, 12),
    face: new THREE.SphereGeometry(0.22, 16, 12),
    hair: new THREE.SphereGeometry(0.22, 12, 8),
    leg: new THREE.BoxGeometry(0.17, 0.4, 0.19),
};
const stencilMark = { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp } as const;
const xrayMaterials = new Map<string, THREE.MeshBasicMaterial>();
function xrayMaterial(color: string, opacity: number) {
    const key = `${color}/${opacity}`;
    if (!xrayMaterials.has(key))
        xrayMaterials.set(key, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthFunc: THREE.GreaterDepth, toneMapped: false, fog: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc }));
    return xrayMaterials.get(key)!;
}
function Part({ geometry, color, position, xray, shadow = true, roughness }: { geometry: THREE.BufferGeometry; color: string; position?: [number, number, number]; xray: THREE.Material | null; shadow?: boolean; roughness?: number }) {
    return <>
        <mesh geometry={geometry} position={position} castShadow={shadow} receiveShadow={shadow}><meshStandardMaterial color={color} roughness={roughness} {...stencilMark}/></mesh>
        {xray && <mesh geometry={geometry} position={position} material={xray} renderOrder={20} raycast={() => null}/>}
    </>;
}
export function AvatarBody({ color, hair = '#5b5147', head, torso, xray = 0 }: { color: string; hair?: string; head?: RefObject<THREE.Group | null>; torso?: RefObject<THREE.Group | null>; xray?: number }) {
    const ghost = xray > 0 ? xrayMaterial(color, xray) : null;
    return <>
        <group ref={torso} position={[0, 0.35, 0]}><Part geometry={parts.torso} position={[0, 0.3, 0]} color={color} roughness={0.9} xray={ghost}/></group>
        <group ref={head} position={[0, 1.17, 0]}>
            <Part geometry={parts.face} color="#e8bc98" xray={ghost}/>
            <Part geometry={parts.hair} position={[0, 0.12, -0.03]} color={hair} shadow={false} xray={ghost}/>
        </group>
        {[-0.13, 0.13].map(x => <Part key={x} geometry={parts.leg} position={[x, 0.22, 0]} color="#495b60" roughness={0.85} xray={ghost}/>)}
    </>;
}

const SPEED = 2.4, NOTICE = 4, WAVE = 2.6;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function Coworker({ person, target, greeting, player, motion, task, shipped }: { person: DemoCoworker; target: Target | null; greeting: string | null; player: RefObject<THREE.Vector3>; motion: boolean; task: { title: string; icon: string; progress: number } | null; shipped: string | null }) {
    const group = useRef<THREE.Group>(null), head = useRef<THREE.Group>(null), torso = useRef<THREE.Group>(null);
    const pos = useRef(new THREE.Vector3(...(target ? [target.point[0], 0, target.point[1]] : [ARRIVAL_DOCK[0], 0, ARRIVAL_DOCK[1]]) as [number, number, number]));
    const path = useRef<Point[]>([]), present = useRef(!!target), leaving = useRef(false), walk = useRef(0), first = useRef(true);
    const clock = useRef(Math.random() * 10), near = useRef(false), hop = useRef(0);
    const [waving, setWaving] = useState(false), [close, setClose] = useState(false);
    useEffect(() => { if (shipped)
        hop.current = 1; }, [shipped]);
    useEffect(() => {
        if (first.current) {
            // On page load coworkers are already where their routine says, not walking in.
            first.current = false;
            return;
        }
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
            path.current = findPath([pos.current.x, pos.current.z], ARRIVAL_DOCK);
        }
    }, [target]);
    useEffect(() => { if (waving) {
        const t = setTimeout(() => setWaving(false), WAVE * 1000);
        return () => clearTimeout(t);
    } }, [waving]);
    useEffect(() => () => { delete peopleView[person.id]; }, [person.id]);
    useFrame((_, dt) => {
        const g = group.current;
        if (!g)
            return;
        dt = Math.min(dt, 0.05);
        if (motion)
            clock.current += dt;
        const t = clock.current;
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
        // Notice the player: look at them when close, wave once as they arrive (if not busy).
        const me = player.current, toPlayer = me ? Math.hypot(me.x - pos.current.x, me.z - pos.current.z) : Infinity;
        const isNear = present.current && toPlayer < NOTICE;
        if (isNear && !near.current && !moving && target?.activity.status === 'Available') {
            setWaving(true);
            hop.current = 1;
        }
        if (isNear !== near.current)
            setClose(isNear);
        near.current = isNear;
        const pose = target?.activity.pose;
        if (head.current) {
            let yaw = 0, pitch = 0;
            if (isNear && me)
                yaw = THREE.MathUtils.clamp(wrap(Math.atan2(me.x - pos.current.x, me.z - pos.current.z) - g.rotation.y), -1.1, 1.1);
            else if (!moving && motion)
                yaw = pose === 'look' ? Math.sin(t * 0.35) * 0.6 : Math.sin(t * 0.23) * Math.max(0, Math.sin(t * 0.11)) * 0.5;
            if (!moving && motion && !isNear)
                pitch = pose === 'desk' ? 0.22 + Math.sin(t * 9) * 0.02 : pose === 'talk' ? Math.max(0, Math.sin(t * 2.6)) * 0.14 : pose === 'sip' ? Math.max(0, Math.sin(t * 0.5) - 0.7) * 0.6 : 0;
            head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, yaw, 6, dt);
            head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, -pitch, 6, dt);
        }
        if (torso.current)
            torso.current.scale.y = motion && !moving ? 1 + Math.sin(t * 2.1) * 0.025 : 1;
        hop.current = Math.max(0, hop.current - dt * 2.5);
        g.visible = present.current;
        g.position.copy(pos.current);
        g.position.y = moving ? Math.sin(walk.current) * 0.045 : (target?.seatId ? -0.2 : 0) + Math.sin(hop.current * Math.PI) * 0.18;
        peopleView[person.id] = { x: pos.current.x, z: pos.current.z, present: present.current };
    });
    const status = target?.activity.status;
    return <group ref={group} name={`coworker-${person.id}`}>
        <AvatarBody color={person.color} hair={person.hair} head={head} torso={torso} xray={0.3}/>
        {/* At a desk the tag floats higher so it doesn't cover their glowing monitor from the default camera. */}
        <Html position={[0, target?.activity.pose === 'desk' && target.seatId ? 2.55 : 1.85, 0]} center zIndexRange={[20, 0]}>
            <div className="avatar-label coworker-label">
                {greeting ? <div className="speech-bubble">{greeting}</div> : shipped ? <div className="speech-bubble shipped">✅ Shipped: {shipped}</div> : close && task && <div className="task-card">{task.icon} {task.title}<b>{Math.round(task.progress * 100)}%</b></div>}
                <i className={status === 'Available' ? '' : 'busy'}/>{person.name}{target && <b className={waving ? 'activity-icon waving' : 'activity-icon'} title={target.activity.activity}>{waving ? '👋' : target.activity.icon}</b>}
                {task && <span className="task-bar" aria-hidden="true"><span style={{ width: `${task.progress * 100}%` }}/></span>}
            </div>
        </Html>
    </group>;
}
