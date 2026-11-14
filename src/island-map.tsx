import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Compass, ChevronDown } from 'lucide-react';
import { districts, districtTrails, gardenPaths, ponds, type Point } from './world';
import { shorePoint } from './shoreline';
import { cameraView } from './camera-view';
const coast = Array.from({ length: 128 }, (_, i) => shorePoint(i / 128 * Math.PI * 2));
const outline = coast.map(([x, z], i) => `${i ? 'L' : 'M'} ${x} ${z}`).join(' ') + ' Z';
// Follows the camera every frame, but only re-renders when the visible area actually moves.
function useViewport(active: boolean) {
    const [points, setPoints] = useState('');
    useEffect(() => {
        if (!active)
            return;
        let frame = 0;
        const tick = () => {
            const next = cameraView.corners.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).join(' ');
            setPoints(current => current === next ? current : next);
            frame = requestAnimationFrame(tick);
        };
        tick();
        return () => cancelAnimationFrame(frame);
    }, [active]);
    return points;
}
export function IslandMap({ position, travel, onLook }: { position: Point; travel: (p: Point) => void; onLook: () => void }) {
    const [open, setOpen] = useState(() => !window.matchMedia('(max-width: 760px)').matches);
    const viewport = useViewport(open);
    const pointer = useRef<number | null>(null);
    const look = (e: ReactPointerEvent<SVGSVGElement>) => {
        const matrix = e.currentTarget.getScreenCTM();
        if (!matrix)
            return;
        const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
        cameraView.look = [point.x, point.y];
        onLook();
    };
    return <section className={`island-map ${open ? 'map-open' : ''}`} aria-label="Island mini-map">
        <button className="map-heading" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="island-mini-map"><Compass size={15}/><span>Island map</span><ChevronDown size={14}/></button>
        {open && <div id="island-mini-map"><svg viewBox="-40 -48 84 64" role="group" aria-label="Island map. Click or drag to look around; select a district to travel there."
            onPointerDown={e => { if (e.button !== 0 || (e.target as Element).closest('.map-district'))
                return; pointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); look(e); }}
            onPointerMove={e => { if (pointer.current === e.pointerId)
                look(e); }}
            onPointerUp={e => { if (pointer.current === e.pointerId)
                pointer.current = null; }}
            onPointerCancel={() => { pointer.current = null; }}>
            <path d={outline} fill="#b5c69e" stroke="#e8d6b1" strokeWidth="2"/>
            {[...gardenPaths, ...districtTrails].map((points, i) => <polyline key={i} points={points.map(p => p.join(',')).join(' ')} fill="none" stroke="#f0e7cc" strokeWidth="0.7"/>)}
            {ponds.map((p, i) => <ellipse key={i} cx={p.x} cy={p.z} rx={p.rx} ry={p.rz} fill="#83b6ab"/>)}
            {viewport && <polygon className="map-viewport" points={viewport} pointerEvents="none"/>}
            {districts.map(d => <g key={d.id} role="button" tabIndex={0} aria-label={`Travel to ${d.name}`} onClick={() => travel(d.point)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); travel(d.point); } }} className="map-district"><title>{`Travel to ${d.name}`}</title><circle cx={d.point[0]} cy={d.point[1]} r="3.8" fill="transparent"/><circle cx={d.point[0]} cy={d.point[1]} r="1.65" fill={d.color} stroke="#fff9e4" strokeWidth="0.6"/></g>)}
            <circle pointerEvents="none" cx={position[0]} cy={position[1]} r="1.5" fill="#dd825d" stroke="#fff" strokeWidth="0.7"><title>Your position</title></circle>
            <text x="36" y="-40" fontSize="3.2" fill="#547264" pointerEvents="none">N ↑</text>
        </svg><p>Click to look · dot to travel</p></div>}
    </section>;
}
