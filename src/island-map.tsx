import { islandKey } from './hosted';
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Footprints, Map as MapIcon, Minus, Plus, X } from 'lucide-react';
import { amphitheater, boardwalk, districts, FERRY_ROUTE, pads, plaza, ponds, walkways, type Point } from './world';
import { shorePoint } from './shoreline';
import { DECKS, highlandsPoint, LAKE, PEAK, POOL, TRAILS, type Trail } from './highlands';
import { routeLength } from './rides';
import { playerState } from './fun-state';
import { peopleView } from './people';

// Two maps:
// - a small round map in the corner, centred on you with an arrow for your heading (click it for the big one);
// - the full map (M), with both islands, place names, trails and people. Click to walk, double-click to jump,
//   drag and scroll to look around the map.
// Both follow you and your coworkers every frame by moving SVG elements directly, without re-rendering React.
type MapPerson = { id: string; name: string; color: string; activity?: string };

const coast = Array.from({ length: 128 }, (_, i) => shorePoint((i / 128) * Math.PI * 2));
const path = (points: Point[]) =>
  points.map(([x, z], i) => `${i ? 'L' : 'M'} ${x.toFixed(2)} ${z.toFixed(2)}`).join(' ') + ' Z';
const officeOutline = path(coast),
  highlandsOutline = path(Array.from({ length: 128 }, (_, i) => highlandsPoint((i / 128) * Math.PI * 2)));
export const PLACE_ICONS: Record<string, string> = {
  arrival: '⚓',
  plaza: '⛲',
  office: '💻',
  meeting: '💬',
  cafe: '☕',
  library: '📚',
  townhall: '🎭',
  wellness: '🌿',
  boardwalk: '🏖️',
  games: '🏓',
  firepit: '🔥',
  jetty: '🎣',
  marina: '🚤',
  bluff: '🧗',
  highlands: '🥾',
  lake: '🛶',
  falls: '💧',
  summit: '⛰️',
  campsite: '⛺',
};
const inHighlandsZ = (z: number) => z < -56;
// Where each place's name sits (default: centred below the icon), so neighbours don't overlap.
type LabelSpot = { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' };
const below: LabelSpot = { dx: 0, dy: 4.4, anchor: 'middle' },
  above: LabelSpot = { dx: 0, dy: -3.7, anchor: 'middle' },
  left: LabelSpot = { dx: -3.2, dy: 0.8, anchor: 'end' },
  right: LabelSpot = { dx: 3.2, dy: 0.8, anchor: 'start' };
const LABELS: Record<string, LabelSpot> = {
  meeting: above,
  marina: left,
  boardwalk: right,
  games: right,
  bluff: above,
  wellness: left,
  jetty: left,
  summit: above,
  campsite: left,
  falls: right,
  lake: left,
};

// The fixed drawing: both islands, paths, buildings, water, bridges, trails and the water-taxi route.
const mapArt = (
  <>
    <polyline
      points={FERRY_ROUTE.map(p => p.join(',')).join(' ')}
      fill="none"
      stroke="#ffffff"
      strokeOpacity="0.7"
      strokeWidth="0.6"
      strokeDasharray="1.6 1.2"
    />
    <path d={highlandsOutline} fill="#a9bd8e" stroke="#e8d6b1" strokeWidth="2" />
    <circle cx={PEAK.x} cy={PEAK.z} r="9" fill="#a39a85" opacity="0.5" />
    <circle cx={PEAK.x} cy={PEAK.z} r="4.5" fill="#968c78" opacity="0.65" />
    <ellipse cx={LAKE.x} cy={LAKE.z} rx={LAKE.rx} ry={LAKE.rz} fill="#83b6ab" />
    <circle cx={POOL.x} cy={POOL.z} r={POOL.r} fill="#83b6ab" />
    {TRAILS.map(t => (
      <polyline
        key={t.id}
        points={t.points.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}
        fill="none"
        stroke={t.color}
        strokeWidth="0.8"
        strokeDasharray="1.4 0.8"
        strokeLinecap="round"
      />
    ))}
    {DECKS.map(d => (
      <line
        key={d.id}
        x1={d.a[0]}
        y1={d.a[1]}
        x2={d.b[0]}
        y2={d.b[1]}
        stroke="#b8946a"
        strokeWidth={d.kind === 'rope' ? 1.2 : 0.9}
      />
    ))}
    <path d={officeOutline} fill="#b5c69e" stroke="#e8d6b1" strokeWidth="2" />
    {walkways.map((points, i) => (
      <polyline
        key={i}
        points={points.map(p => p.join(',')).join(' ')}
        fill="none"
        stroke="#f0e7cc"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    ))}
    <path
      d={`M ${boardwalk.from.join(' ')} Q ${boardwalk.bend.join(' ')} ${boardwalk.to.join(' ')}`}
      fill="none"
      stroke="#c39f73"
      strokeWidth="1.1"
    />
    <circle cx={plaza.x} cy={plaza.z} r={plaza.radius} fill="#e6dcc3" />
    <path
      d={`M ${amphitheater.x + Math.cos(amphitheater.from) * 5.8} ${amphitheater.z + Math.sin(amphitheater.from) * 5.8} A 5.8 5.8 0 0 1 ${amphitheater.x + Math.cos(amphitheater.to) * 5.8} ${amphitheater.z + Math.sin(amphitheater.to) * 5.8}`}
      fill="none"
      stroke="#d6caa9"
      strokeWidth="2.2"
    />
    {pads.map(pad => (
      <rect
        key={pad.id}
        x={pad.x - pad.w / 2}
        y={pad.z - pad.d / 2}
        width={pad.w}
        height={pad.d}
        rx="0.5"
        fill={pad.style === 'plot' ? 'none' : pad.style === 'glass' ? '#d6ebe9' : '#ebe6d8'}
        stroke={pad.style === 'plot' ? '#6d8a73' : '#b9b19a'}
        strokeWidth="0.35"
        strokeDasharray={pad.style === 'plot' ? '1 0.7' : undefined}
      />
    ))}
    {ponds.map((p, i) => (
      <ellipse key={i} cx={p.x} cy={p.z} rx={p.rx} ry={p.rz} fill="#83b6ab" />
    ))}
  </>
);
// You: an arrow pointing the way you face (drawn pointing +z, i.e. down the map, then rotated).
const youArrow = (scale: number) => (
  <g transform={`scale(${scale})`}>
    <circle r="2.1" fill="#dd825d" fillOpacity="0.22" />
    <path
      d="M 0 1.9 L 1.3 -1.2 L 0 -0.45 L -1.3 -1.2 Z"
      fill="#dd825d"
      stroke="#fff"
      strokeWidth="0.45"
      strokeLinejoin="round"
    />
  </g>
);

// Baselines for a person's name relative to their dot: above, below, then further out.
const NAME_SLOTS = [-2.4, 3.9, -4.8, 6.3];

// Every frame: move you, your route and your coworkers on a map (no React re-render).
function useLiveLayer(
  svg: React.RefObject<SVGSVGElement | null>,
  people: MapPerson[],
  onFrame?: (x: number, z: number) => void,
) {
  useEffect(() => {
    let handle = 0;
    const tick = () => {
      const root = svg.current;
      if (root) {
        const { x, z, heading } = playerState;
        root
          .querySelector('.map-you')
          ?.setAttribute('transform', `translate(${x} ${z}) rotate(${(-heading * 180) / Math.PI})`);
        const route = root.querySelector('.map-route');
        if (route) {
          const points = playerState.route;
          route.setAttribute('points', points.length ? [[x, z], ...points].map(p => p.join(',')).join(' ') : '');
          const end = points[points.length - 1],
            pin = root.querySelector('.map-route-end');
          if (pin) {
            pin.setAttribute('visibility', end ? 'visible' : 'hidden');
            if (end) pin.setAttribute('transform', `translate(${end[0]} ${end[1]})`);
          }
        }
        // Names go above the dot, or below / further out when a neighbour's name is already there.
        const placed: { x: number; y: number; half: number }[] = [];
        for (const person of people) {
          const dot = root.querySelector(`[data-person="${person.id}"]`),
            p = peopleView[person.id];
          if (!dot) continue;
          dot.setAttribute('visibility', p?.present ? 'visible' : 'hidden');
          if (!p?.present) continue;
          dot.setAttribute('transform', `translate(${p.x} ${p.z})`);
          const name = dot.querySelector('.map-person-name');
          if (!name) continue;
          const half = person.name.length * 0.56,
            y =
              NAME_SLOTS.find(dy =>
                placed.every(o => Math.abs(o.x - p.x) > o.half + half || Math.abs(o.y - (p.z + dy)) > 2.3),
              ) ?? NAME_SLOTS[0];
          placed.push({ x: p.x, y: p.z + y, half });
          name.setAttribute('y', String(y));
        }
        onFrame?.(x, z);
      }
      handle = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(handle);
  }, [people]);
}

// ---- The small round map ----
const RADIUS = 21;
export function MiniMap({ people, onOpen }: { people: MapPerson[]; onOpen: () => void }) {
  const svg = useRef<SVGSVGElement>(null),
    label = useRef<HTMLSpanElement>(null);
  useLiveLayer(svg, people, (x, z) => {
    svg.current?.setAttribute('viewBox', `${x - RADIUS} ${z - RADIUS} ${RADIUS * 2} ${RADIUS * 2}`);
    if (label.current) {
      const name = inHighlandsZ(z) ? 'Highlands' : z < -47.5 ? 'Rope bridge' : 'Office island';
      if (label.current.textContent !== name) label.current.textContent = name;
    }
  });
  return (
    <button className="mini-map" onClick={onOpen} aria-label="Open the map (M)" title="Open the map (M)">
      <svg ref={svg} viewBox={`-${RADIUS} -${RADIUS} ${RADIUS * 2} ${RADIUS * 2}`} aria-hidden="true">
        {mapArt}
        {districts.map(d => (
          <text key={d.id} x={d.point[0]} y={d.point[1]} fontSize="3.4" textAnchor="middle" dominantBaseline="central">
            {PLACE_ICONS[d.id] ?? '•'}
          </text>
        ))}
        <polyline className="map-route" fill="none" stroke="#dd825d" strokeWidth="0.7" strokeDasharray="1.2 0.8" />
        <g className="map-route-end" visibility="hidden">
          <circle r="1.1" fill="#fff" stroke="#dd825d" strokeWidth="0.5" />
        </g>
        {people.map(p => (
          <circle
            key={p.id}
            data-person={p.id}
            r="1.5"
            fill={p.color}
            stroke="#fff"
            strokeWidth="0.5"
            visibility="hidden"
          />
        ))}
        <g className="map-you">{youArrow(1)}</g>
      </svg>
      <span className="mini-map-label" ref={label}>
        Office island
      </span>
      <span className="mini-map-open">
        <MapIcon size={11} /> Map · M
      </span>
      <span className="mini-map-north" aria-hidden="true">
        N
      </span>
    </button>
  );
}

// ---- The full map ----
type Frame = { x: number; z: number; w: number; h: number };
const FRAMES: Record<'office' | 'highlands' | 'both', Frame> = {
  office: { x: -50, z: -58, w: 104, h: 84 },
  highlands: { x: -38, z: -126, w: 96, h: 70 },
  both: { x: -52, z: -126, w: 112, h: 152 },
};
export function FullMap({
  people,
  trailsDone,
  onWalk,
  onJump,
  onHike,
  onFindPerson,
  onClose,
}: {
  people: MapPerson[];
  trailsDone: string[];
  onWalk: (point: Point) => void;
  onJump: (point: Point) => void;
  onHike: (trail: Trail['id']) => void;
  onFindPerson: (id: string) => void;
  onClose: () => void;
}) {
  const svg = useRef<SVGSVGElement>(null),
    frame = useRef<Frame>({ ...(inHighlandsZ(playerState.z) ? FRAMES.highlands : FRAMES.office) }),
    drag = useRef<{ id: number; x: number; y: number; moved: number } | null>(null),
    clickTimer = useRef(0);
  const apply = () => {
    const f = frame.current;
    svg.current?.setAttribute('viewBox', `${f.x} ${f.z} ${f.w} ${f.h}`);
    // Trail names only once you've zoomed in far enough for them to fit.
    svg.current?.classList.toggle('zoomed-in', f.w < 75);
  };
  useLiveLayer(svg, people);
  useEffect(() => {
    apply();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && islandKey(e) && onClose();
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      window.clearTimeout(clickTimer.current);
    };
  }, []);
  // Map units under a screen point.
  const toMap = (clientX: number, clientY: number): Point | null => {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return [p.x, p.y];
  };
  const zoom = (factor: number, around?: Point) => {
    const f = frame.current,
      [cx, cz] = around ?? [f.x + f.w / 2, f.z + f.h / 2],
      w = Math.min(160, Math.max(14, f.w * factor)),
      k = w / f.w;
    frame.current = { x: cx - (cx - f.x) * k, z: cz - (cz - f.z) * k, w, h: f.h * k };
    apply();
  };
  const show = (name: keyof typeof FRAMES) => {
    frame.current = { ...FRAMES[name] };
    apply();
  };
  // Click = walk there, double-click = jump there (a short wait tells them apart).
  const choose = (point: Point, jump: boolean) => {
    window.clearTimeout(clickTimer.current);
    if (jump) {
      onJump(point);
      onClose();
    } else clickTimer.current = window.setTimeout(() => onWalk(point), 230);
  };
  const pointer = {
    onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
    },
    onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const a = toMap(d.x, d.y),
        b = toMap(e.clientX, e.clientY);
      d.moved += Math.hypot(e.clientX - d.x, e.clientY - d.y);
      d.x = e.clientX;
      d.y = e.clientY;
      if (d.moved > 4) e.currentTarget.setPointerCapture(e.pointerId);
      if (a && b && d.moved > 4) {
        frame.current.x -= b[0] - a[0];
        frame.current.z -= b[1] - a[1];
        apply();
      }
    },
    onPointerUp: (e: ReactPointerEvent<SVGSVGElement>) => {
      const d = drag.current;
      drag.current = null;
      if (!d || d.moved > 4 || (e.target as Element).closest('.map-place')) return;
      const p = toMap(e.clientX, e.clientY);
      if (p) choose(p, false);
    },
    onDoubleClick: (e: React.MouseEvent<SVGSVGElement>) => {
      if ((e.target as Element).closest('.map-place')) return;
      const p = toMap(e.clientX, e.clientY);
      if (p) choose(p, true);
    },
    onWheel: (e: React.WheelEvent<SVGSVGElement>) => {
      zoom(Math.exp(e.deltaY * 0.0015), toMap(e.clientX, e.clientY) ?? undefined);
    },
  };
  return (
    <div className="full-map" role="dialog" aria-label="Island map">
      <div className="full-map-area">
        <svg ref={svg} {...pointer} preserveAspectRatio="xMidYMid meet">
          {mapArt}
          {TRAILS.map(t => {
            const p = t.points[Math.floor(t.points.length * (t.id === 'lake' ? 0.45 : 0.55))];
            return (
              <text key={t.id} className="map-trail-label" x={p[0] + 1.5} y={p[1]} fill={t.color}>
                {t.name}
              </text>
            );
          })}
          <polyline className="map-route" fill="none" stroke="#dd825d" strokeWidth="0.8" strokeDasharray="1.4 0.9" />
          <g className="map-route-end" visibility="hidden">
            <circle r="1.3" fill="#fff" stroke="#dd825d" strokeWidth="0.6" />
          </g>
          {districts.map(d => (
            <g
              key={d.id}
              className="map-place"
              role="button"
              tabIndex={0}
              aria-label={`${d.name}: click to walk, double-click to jump`}
              transform={`translate(${d.point[0]} ${d.point[1]})`}
              onClick={() => choose(d.point, false)}
              onDoubleClick={() => choose(d.point, true)}
              onKeyDown={e => {
                if (e.key === 'Enter') choose(d.point, false);
                if (e.key === ' ') {
                  e.preventDefault();
                  choose(d.point, true);
                }
              }}
            >
              <title>{`${d.name} · click to walk, double-click to jump`}</title>
              <circle r="2.4" fill="#fffdf2" stroke={d.color} strokeWidth="0.6" />
              <text fontSize="2.6" textAnchor="middle" dominantBaseline="central">
                {PLACE_ICONS[d.id] ?? '•'}
              </text>
              <text
                className="map-place-name"
                x={(LABELS[d.id] ?? below).dx}
                y={(LABELS[d.id] ?? below).dy}
                textAnchor={(LABELS[d.id] ?? below).anchor}
              >
                {d.name}
              </text>
            </g>
          ))}
          {people.map(p => (
            <g key={p.id} data-person={p.id} visibility="hidden">
              <circle r="1.6" fill={p.color} stroke="#fff" strokeWidth="0.55" />
              <text className="map-person-name" y="-2.4" textAnchor="middle">
                {p.name}
              </text>
            </g>
          ))}
          <g className="map-you">{youArrow(1.15)}</g>
        </svg>
        <div className="full-map-tools">
          <div role="group" aria-label="Show">
            {(['office', 'highlands', 'both'] as const).map(name => (
              <button key={name} onClick={() => show(name)}>
                {name === 'office' ? 'Office' : name === 'highlands' ? 'Highlands' : 'Both'}
              </button>
            ))}
          </div>
          <button aria-label="Zoom in" onClick={() => zoom(0.75)}>
            <Plus size={14} />
          </button>
          <button aria-label="Zoom out" onClick={() => zoom(1.33)}>
            <Minus size={14} />
          </button>
        </div>
        <p className="full-map-hint">
          Click to walk · Double-click to jump · Drag and scroll to look around · Esc to close
        </p>
        <span className="full-map-north" aria-hidden="true">
          N ↑
        </span>
      </div>
      <aside className="full-map-side">
        <header>
          <strong>Island map</strong>
          <button aria-label="Close the map" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <h3>Trails</h3>
        <ul>
          {TRAILS.map(t => (
            <li key={t.id}>
              <i style={{ background: t.color }} />
              <div>
                <b>
                  {t.name} {trailsDone.includes(t.id) && <Check size={12} aria-label="completed" />}
                </b>
                <span>
                  {t.level} · {Math.round(routeLength(t.points))} m
                </span>
              </div>
              <button
                onClick={() => {
                  onHike(t.id);
                  onClose();
                }}
              >
                <Footprints size={12} /> Hike
              </button>
            </li>
          ))}
        </ul>
        <h3>People</h3>
        <ul>
          <li>
            <i style={{ background: '#dd825d' }} />
            <div>
              <b>You</b>
              <span>The arrow shows which way you face</span>
            </div>
          </li>
          {people.map(p => (
            <li key={p.id}>
              <i style={{ background: p.color }} />
              <div>
                <b>{p.name}</b>
                <span>{p.activity ?? 'Away'}</span>
              </div>
              <button
                onClick={() => {
                  onFindPerson(p.id);
                  onClose();
                }}
              >
                Find
              </button>
            </li>
          ))}
        </ul>
        <h3>Getting across</h3>
        <p>Rope bridge from beside the games lawn, or the water taxi from the water sports dock.</p>
      </aside>
    </div>
  );
}
