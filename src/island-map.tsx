import { useState } from 'react';
import { Compass, ChevronDown } from 'lucide-react';
import { districts, districtTrails, gardenPaths, ponds, type Point } from './world';
import { shorePoint } from './shoreline';
const coast = Array.from({ length: 128 }, (_, i) => shorePoint(i / 128 * Math.PI * 2));
const outline = coast.map(([x, z], i) => `${i ? 'L' : 'M'} ${x} ${z}`).join(' ') + ' Z';
export function IslandMap({ position, travel }: { position: Point; travel: (p: Point) => void }) {
    const [open, setOpen] = useState(() => !window.matchMedia('(max-width: 760px)').matches);
    return <section className={`island-map ${open ? 'map-open' : ''}`} aria-label="Island mini-map">
        <button className="map-heading" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="island-mini-map"><Compass size={15}/><span>Island map</span><ChevronDown size={14}/></button>
        {open && <div id="island-mini-map"><svg viewBox="-40 -48 84 64" role="group" aria-label="District map. Select a district to travel there.">
            <path d={outline} fill="#b5c69e" stroke="#e8d6b1" strokeWidth="2"/>
            {[...gardenPaths, ...districtTrails].map((points, i) => <polyline key={i} points={points.map(p => p.join(',')).join(' ')} fill="none" stroke="#f0e7cc" strokeWidth="0.7"/>)}
            {ponds.map((p, i) => <ellipse key={i} cx={p.x} cy={p.z} rx={p.rx} ry={p.rz} fill="#83b6ab"/>)}
            {districts.map(d => <g key={d.id} role="button" tabIndex={0} aria-label={`Travel to ${d.name}`} onClick={() => travel(d.point)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); travel(d.point); } }} className="map-district"><title>{d.name}</title><circle cx={d.point[0]} cy={d.point[1]} r="3.8" fill="transparent"/><circle cx={d.point[0]} cy={d.point[1]} r="1.65" fill={d.color} stroke="#fff9e4" strokeWidth="0.6"/></g>)}
            <circle pointerEvents="none" cx={position[0]} cy={position[1]} r="1.5" fill="#dd825d" stroke="#fff" strokeWidth="0.7"><title>Your position</title></circle>
            <text x="36" y="-40" fontSize="3.2" fill="#547264">N ↑</text>
        </svg><p>Choose a district to travel</p></div>}
    </section>;
}
