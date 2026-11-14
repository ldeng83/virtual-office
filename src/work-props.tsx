import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { peopleView } from './people';
import type { Point } from './world';

// Small canvas textures redrawn a few times a second: cheap, and readable from the default zoom.
function useCanvasTexture(width: number, height: number) {
    return useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        return { canvas, ctx: canvas.getContext('2d')!, texture };
    }, [width, height]);
}
// Deterministic pseudo-random numbers so drawings don't flicker between frames.
const hash = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

export type ScreenWork = { personId: string; craft: 'design' | 'code'; progress: number; celebrating: boolean };

// A monitor screen that lights up only while its coworker is actually sitting at the desk.
export function DeskScreen({ desk, seat, work }: { desk: { x: number; z: number }; seat: Point; work: ScreenWork }) {
    const { canvas, ctx, texture } = useCanvasTexture(160, 100);
    const mesh = useRef<THREE.Group>(null), glow = useRef<THREE.MeshBasicMaterial>(null), last = useRef(-1), scroll = useRef(0);
    const latest = useRef(work);
    latest.current = work;
    useEffect(() => () => texture.dispose(), [texture]);
    useFrame(({ clock }) => {
        const at = peopleView[latest.current.personId];
        const on = !!at?.present && Math.hypot(at.x - seat[0], at.z - seat[1]) < 0.3;
        if (mesh.current)
            mesh.current.visible = on;
        const t = clock.elapsedTime;
        if (glow.current)
            glow.current.opacity = latest.current.celebrating ? 0.75 : 0.4 + Math.sin(t * 2.2) * 0.12;
        if (!on || t - last.current < 0.16)
            return;
        last.current = t;
        scroll.current++;
        const { craft, progress, celebrating } = latest.current, w = canvas.width, h = canvas.height;
        if (celebrating) {
            ctx.fillStyle = '#5c9a6d';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(craft === 'code' ? '✓ tests passed' : '✓ shared', w / 2, h / 2 + 8);
        }
        else if (craft === 'code') {
            ctx.fillStyle = '#1f2b2a';
            ctx.fillRect(0, 0, w, h);
            const colors = ['#8fd1a8', '#e6c07b', '#7fb2d9', '#c9b4e0', '#9fb2ad'];
            for (let row = 0; row < 9; row++) {
                const line = scroll.current + row, indent = Math.floor(hash(line) * 4) * 8;
                for (let token = 0, x = 8 + indent; token < 1 + Math.floor(hash(line + 0.5) * 4) && x < w - 12; token++) {
                    const len = 12 + hash(line * 3 + token) * 34;
                    ctx.fillStyle = colors[Math.floor(hash(line * 7 + token) * colors.length)];
                    ctx.fillRect(x, 6 + row * 9, len, 5);
                    x += len + 5;
                }
            }
            // blinking cursor on the last line
            if (scroll.current % 4 < 2) {
                ctx.fillStyle = '#e8f0ec';
                ctx.fillRect(10, 6 + 8 * 9, 5, 6);
            }
        }
        else {
            ctx.fillStyle = '#f4f1e8';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#d8d2c2';
            ctx.fillRect(6, 6, w - 12, 12);
            // wireframe cards appear as the design task progresses
            const shown = 2 + Math.floor(progress * 10);
            for (let i = 0; i < 12; i++) {
                const col = i % 4, row = Math.floor(i / 4), x = 8 + col * 37, y = 24 + row * 24;
                ctx.strokeStyle = i < shown ? '#7193b5' : '#e7e2d6';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, 31, 18);
                if (i < shown - 1) {
                    ctx.fillStyle = '#c9d6e3';
                    ctx.fillRect(x + 4, y + 4, 12, 4);
                }
            }
            // moving "pen" cursor
            const i = Math.min(11, shown - 1), cx = 8 + (i % 4) * 37 + 16 + Math.sin(scroll.current) * 10, cy = 24 + Math.floor(i / 4) * 24 + 9;
            ctx.fillStyle = '#d9815f';
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        // progress bar along the bottom
        ctx.fillStyle = '#00000030';
        ctx.fillRect(0, h - 5, w, 5);
        ctx.fillStyle = celebrating ? '#ffffff' : '#8fd1a8';
        ctx.fillRect(0, h - 5, w * (celebrating ? 1 : progress), 5);
        texture.needsUpdate = true;
    });
    // The worker sits between the camera and their screen, so the whole monitor also glows softly
    // (visible from any angle) while the detailed screen floats just in front of its face (z = -0.075).
    const tint = work.craft === 'code' ? '#8fd1a8' : '#9cc0e6';
    return <group ref={mesh} position={[desk.x, 1.17, desk.z]} visible={false}>
        <mesh position={[0, 0, -0.1]}><boxGeometry args={[0.6, 0.4, 0.075]}/><meshBasicMaterial ref={glow} color={work.celebrating ? '#b9f0c4' : tint} transparent opacity={0.4} depthWrite={false} toneMapped={false}/></mesh>
        <mesh position={[0, 0, -0.06]}><planeGeometry args={[0.5, 0.31]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>
    </group>;
}

// A whiteboard by the meeting table that fills with boxes and arrows while someone draws on it,
// and is wiped clean when the meeting ends.
export function Whiteboard({ position, face, spot, active }: { position: Point; face: Point; spot: Point; active: boolean }) {
    const { canvas, ctx, texture } = useCanvasTexture(256, 160);
    const strokes = useRef(0), drawn = useRef(-1), timer = useRef(0);
    useEffect(() => () => texture.dispose(), [texture]);
    useFrame((_, dt) => {
        if (!active)
            strokes.current = 0;
        else {
            const drawing = Object.values(peopleView).some(p => p.present && Math.hypot(p.x - spot[0], p.z - spot[1]) < 0.35);
            timer.current += dt * (drawing ? 1 : 0.08);
            if (timer.current > 0.55) {
                timer.current = 0;
                strokes.current = Math.min(18, strokes.current + 1);
            }
        }
        if (strokes.current === drawn.current)
            return;
        drawn.current = strokes.current;
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = '#fbfbf6';
        ctx.fillRect(0, 0, w, h);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        const boxes: [number, number][] = [];
        for (let i = 0; i < strokes.current; i++) {
            const kind = i % 3, x = 18 + hash(i + 1) * (w - 80), y = 14 + hash(i + 11) * (h - 50);
            ctx.strokeStyle = ['#3f6252', '#d9815f', '#7193b5'][i % 3];
            if (kind === 0) {
                ctx.strokeRect(x, y, 46, 26);
                boxes.push([x + 23, y + 13]);
            }
            else if (kind === 1 && boxes.length > 1) {
                const [a, b] = [boxes[boxes.length - 1], boxes[boxes.length - 2]];
                ctx.beginPath();
                ctx.moveTo(a[0], a[1]);
                ctx.lineTo(b[0], b[1]);
                ctx.stroke();
            }
            else {
                ctx.fillStyle = ['#f3d98a', '#f2b8a0', '#bcd9c2'][i % 3];
                ctx.fillRect(x, y, 22, 22);
            }
        }
        texture.needsUpdate = true;
    });
    const angle = Math.atan2(face[0] - position[0], face[1] - position[1]);
    return <group position={[position[0], 0, position[1]]} rotation={[0, angle, 0]} name="meeting-whiteboard">
        {[-0.75, 0.75].map(x => <mesh key={x} position={[x, 0.75, -0.02]} castShadow><boxGeometry args={[0.06, 1.5, 0.06]}/><meshStandardMaterial color="#7f8b75"/></mesh>)}
        <mesh position={[0, 1.35, -0.04]} castShadow><boxGeometry args={[1.62, 1.04, 0.05]}/><meshStandardMaterial color="#e7e4da"/></mesh>
        <mesh position={[0, 1.35, -0.01]}><planeGeometry args={[1.5, 0.94]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>
    </group>;
}
