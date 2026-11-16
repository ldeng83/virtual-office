import { shoreDistance, shorePoint, WALK_INSET } from './shoreline.ts';
export type Point = [number, number];
// ---- Campus layout (world units: x east, z south; the arrival pier is on the south shore) ----
// Building pads: floors now, walls and roofs later. `glass` pads become see-through pavilions.
export type Pad = {
  id: string;
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  style: 'building' | 'glass' | 'plot';
};
export const pads: Pad[] = [
  { id: 'lobby', name: 'Lobby', x: 0, z: 5.57, w: 8, d: 4.5, style: 'glass' },
  { id: 'hq', name: 'Main workspace', x: 0, z: -27.43, w: 20, d: 9, style: 'building' },
  { id: 'pav-s', name: 'Pavilion S', x: 14.4, z: -4.63, w: 4, d: 4, style: 'glass' },
  { id: 'pav-m', name: 'Pavilion M', x: 22.8, z: -14.23, w: 6.5, d: 5.5, style: 'glass' },
  { id: 'pav-l', name: 'Pavilion L', x: 20.4, z: -28.03, w: 8.5, d: 6.5, style: 'glass' },
  { id: 'library', name: 'Focus library', x: -20.4, z: -15.43, w: 10, d: 7, style: 'building' },
  { id: 'cafe', name: 'Café', x: 13.2, z: 2.57, w: 6.5, d: 4.5, style: 'building' },
];
// Building shells: walls on every side except open ones, with doorways (centres in world x for
// north/south walls, world z for east/west walls) where the walkways arrive.
export type Side = 'north' | 'south' | 'east' | 'west';
export const DOOR_WIDTH = 1.8,
  WALL_THICKNESS = 0.16,
  WALL_HEIGHT = 2.4;
export const shells: Record<string, { doors: Partial<Record<Side, number[]>>; open?: Side[] }> = {
  lobby: { doors: { south: [0], north: [0] } },
  hq: { doors: { south: [0], north: [-6] } },
  'pav-s': { doors: { west: [-4.63], east: [-4.63] } },
  'pav-m': { doors: { south: [20.8], east: [-14.23] } },
  'pav-l': { doors: { south: [17.4] } },
  library: { doors: { east: [-15.63], south: [-20.4] } },
  cafe: { doors: { east: [2.07] }, open: ['south', 'west'] },
};
export type Wall = { pad: string; side: Side; x: number; z: number; w: number; d: number };
// Wall pieces between doorways, plus the empty spans over each doorway (for door headers).
export const walls: Wall[] = [],
  doorways: Wall[] = [];
for (const pad of pads) {
  const shell = shells[pad.id];
  if (!shell) continue;
  for (const side of ['north', 'south', 'east', 'west'] as Side[]) {
    if (shell.open?.includes(side)) continue;
    const horizontal = side === 'north' || side === 'south';
    const lo = horizontal ? pad.x - pad.w / 2 : pad.z - pad.d / 2,
      hi = horizontal ? pad.x + pad.w / 2 : pad.z + pad.d / 2;
    const fixed =
      side === 'north'
        ? pad.z - pad.d / 2
        : side === 'south'
          ? pad.z + pad.d / 2
          : side === 'west'
            ? pad.x - pad.w / 2
            : pad.x + pad.w / 2;
    const gaps = (shell.doors[side] ?? [])
      .map(c => [c - DOOR_WIDTH / 2, c + DOOR_WIDTH / 2])
      .sort((a, b) => a[0] - b[0]);
    const piece = (a: number, b: number, list: Wall[]) => {
      if (b - a > 0.05)
        list.push(
          horizontal
            ? { pad: pad.id, side, x: (a + b) / 2, z: fixed, w: b - a, d: WALL_THICKNESS }
            : { pad: pad.id, side, x: fixed, z: (a + b) / 2, w: WALL_THICKNESS, d: b - a },
        );
    };
    let at = lo;
    for (const [a, b] of gaps) {
      piece(at, a, walls);
      piece(a, b, doorways);
      at = b;
    }
    piece(at, hi, walls);
  }
}
export const flowerBedsAround = (g: { x: number; z: number }): Point[] => [
  [g.x + 5.2, g.z + 3.2],
  [g.x - 4.6, g.z - 2.8],
  [g.x + 4.4, g.z - 2.8],
  [g.x - 4.8, g.z + 3.4],
];
export const plaza = { x: 0, z: -8.23, radius: 6, fountain: 1.6 };
export const amphitheater = {
  x: -14.4,
  z: 0.17,
  stage: 1.5,
  tiers: [2.8, 4.3, 5.8],
  from: (150 * Math.PI) / 180,
  to: (300 * Math.PI) / 180,
};
export const garden = { x: -12.6, z: -37.63, loopX: 5.6, loopZ: 3 };
export const flowerBeds = flowerBedsAround(garden);
export const ponds = [{ x: garden.x, z: garden.z, rx: 2.6, rz: 1.5 }];
export const boardwalk = {
  from: [29.76, -23.83] as Point,
  bend: [35.04, -11.83] as Point,
  to: [29.76, -0.43] as Point,
};
export const newsScreen = { x: 0, z: -13.03, w: 3.6 };
export const WHITEBOARD: Point = [19.85, -14.23];
export const WHITEBOARD_FACING: Point = [20.85, -14.23];
export const WHITEBOARD_SPOT: Point = [20.55, -14.23];
// Furniture that blocks walking: half-extents already include room for the avatar.
type Block = { x: number; z: number; hx: number; hz: number } | { x: number; z: number; r: number };
export const tables = {
  pavS: { x: 14.4, z: -4.63, r: 0.3 },
  pavM: { x: 23.2, z: -14.23, w: 2.8, d: 1.3 },
  pavL: { x: 20.4, z: -28.03, w: 5.2, d: 1.7 },
  counter: { x: 13.2, z: 1.37, w: 4.2, d: 0.8 },
  reception: { x: -2.2, z: 5.07, w: 2.6, d: 0.9 },
  terrace: [
    [11.8, 5.97],
    [14.6, 5.97],
  ] as Point[],
  atrium: { x: 0, z: -27.43, w: 2.6, d: 2.6 },
};
// 14 desks: Design (west half) and Engineering (east half) of the main workspace.
export const desks = [-1, 1].flatMap((side, team) =>
  Array.from({ length: 7 }, (_, i) => {
    const col = i % 4,
      row = Math.floor(i / 4),
      x = side < 0 ? -8.9 + col * 2.2 : 2.3 + col * 2.2;
    return { id: `desk-${team * 7 + i}`, x, z: row ? -24.83 : -30.03, team: team ? 'Engineering' : 'Design' };
  }),
);
export const booths = Array.from({ length: 6 }, (_, i) => ({
  id: `booth-${i}`,
  x: -23.8 + (i % 3) * 3.4,
  z: i < 3 ? -17.33 : -13.73,
}));
export type Seat = {
  id: string;
  name: string;
  point: Point;
  angle: number;
  kind?: 'chair' | 'bench' | 'stool' | 'lounger' | 'armchair' | 'stand' | 'hammock' | 'log' | 'crate' | 'kayak';
  // Height of the seat's floor above the ground (the rooftop terrace).
  y?: number;
  // Set for seats reached in a special way (rooftop stairs, kayaks at the jetty).
  fixedApproach?: boolean;
  // Where people step in and out of the seat; the seat itself is solid.
  approach: Point;
};
// Footprint of each seat kind (width across, depth front-to-back) in the seat's own frame.
const seatFootprint: Record<NonNullable<Seat['kind']>, [number, number]> = {
  chair: [0.7, 0.7],
  bench: [0.9, 0.5],
  stool: [0.5, 0.5],
  lounger: [0.65, 1.55],
  armchair: [0.85, 0.75],
  stand: [0.45, 0.45],
  hammock: [0.9, 2.3],
  log: [0.9, 0.45],
  crate: [0.5, 0.5],
  kayak: [0.6, 2.4],
};
const facing = (from: Point, to: Point) => Math.atan2(to[0] - from[0], to[1] - from[1]);
const ring = (
  cx: number,
  cz: number,
  r: number,
  angles: number[],
  name: string,
  id: string,
  kind: Seat['kind'],
  rz = r,
): Seat[] =>
  angles.map((a, i) => {
    const point: Point = [cx + Math.cos(a) * r, cz + Math.sin(a) * rz];
    // approach is filled in once collision is known (below)
    return { id: `${id}-${i}`, name, point, angle: facing(point, [cx, cz]), kind, approach: point };
  });
// Every seat's `approach` is a placeholder until the step-in spots are chosen below.
// ---- Fun and relaxing spots ----
export const gamesLawn = { x: 9, z: -38.47, w: 8.4, d: 5 };
export const pingPong = { x: 7.5, z: -38.47, w: 2, d: 1.1 };
export const cornhole: Point[] = [
  [11.9, -40.27],
  [11.9, -36.67],
];
export const firepit = { x: 24.72, z: -7.27, r: 0.65 };
export const hammocks: Point[] = [
  [27.72, -5.47],
  [27.72, -8.67],
];
// A timber jetty off the west coast: fishing at the end, kayaks moored alongside.
export const jetty = { x0: -37.88, x1: -29.28, z: -4.63, w: 1.8 };
export const kayakMoorings: Point[] = [
  [-34.28, -6.23],
  [-36.28, -6.23],
];
export const piano = { x: 7.08, z: 4.85, w: 1.5, d: 0.6 };
export const radio: Point = [11.5, 1.37];
export const telescope: Point = [-19.7, -35.23];
// Rooftop terrace on the main workspace, reached by an outdoor stair on its west side.
export const ROOF_Y = 2.75;
export const roofStair = { x: -10.5, z0: -29.43, z1: -24.03, w: 0.8, foot: [-11.5, -23.53] as Point };
export const townhallScreen = {
  x: amphitheater.x + Math.cos(Math.PI / 4) * 2.7,
  z: amphitheater.z + Math.sin(Math.PI / 4) * 2.7,
  w: 3,
  facing: (-3 * Math.PI) / 4,
};
export const seats = [
  ...desks.map((d, i) => ({
    id: d.id,
    name: `${d.team} desk ${(i % 7) + 1}`,
    point: [d.x, d.z + 0.95] as Point,
    angle: Math.PI,
  })),
  ...[22.3, 23.2, 24.1].flatMap((x, i) => [
    { id: `pm-${i}`, name: 'Pavilion M seat', point: [x, -15.53] as Point, angle: 0 },
    { id: `pm-${i + 3}`, name: 'Pavilion M seat', point: [x, -12.93] as Point, angle: Math.PI },
  ]),
  // Pavilion L: six a side along the long table; the ends stay open so people can get round it.
  ...[18.3, 19.15, 20, 20.85, 21.7, 22.55].flatMap((x, i) => [
    { id: `pl-${i}`, name: 'Pavilion L seat', point: [x, -29.53] as Point, angle: 0 },
    { id: `pl-${i + 6}`, name: 'Pavilion L seat', point: [x, -26.53] as Point, angle: Math.PI },
  ]),
  { id: 'ps-0', name: 'Pavilion S armchair', point: [13.6, -4.63], angle: Math.PI / 2, kind: 'armchair' },
  { id: 'ps-1', name: 'Pavilion S armchair', point: [15.2, -4.63], angle: -Math.PI / 2, kind: 'armchair' },
  ...booths.map(b => ({ id: b.id, name: 'Library focus booth', point: [b.x, b.z + 0.5] as Point, angle: Math.PI })),
  ...[11.8, 13.2, 14.6].map((x, i) => ({
    id: `cs-${i}`,
    name: 'Café counter stool',
    point: [x, 2.42] as Point,
    angle: Math.PI,
    kind: 'stool' as const,
  })),
  ...tables.terrace.flatMap(([x, z], t) => [
    { id: `ts-${t * 3}`, name: 'Terrace seat', point: [x - 0.9, z] as Point, angle: Math.PI / 2 },
    { id: `ts-${t * 3 + 1}`, name: 'Terrace seat', point: [x + 0.9, z] as Point, angle: -Math.PI / 2 },
    { id: `ts-${t * 3 + 2}`, name: 'Terrace seat', point: [x, z + 0.9] as Point, angle: Math.PI },
  ]),
  ...[1.6, 2.6, 3.6].map((x, i) => ({
    id: `lb-${i}`,
    name: 'Lobby armchair',
    point: [x, 4.37] as Point,
    angle: 0,
    kind: 'armchair' as const,
  })),
  ...ring(
    plaza.x,
    plaza.z,
    4.4,
    [1, 3, 5, 7].map(n => (n * Math.PI) / 4),
    'Plaza bench',
    'pz',
    'bench',
  ),
  ...amphitheater.tiers.flatMap((r, tier) => {
    const count = [5, 6, 5][tier];
    return ring(
      amphitheater.x,
      amphitheater.z,
      r,
      Array.from(
        { length: count },
        (_, i) => amphitheater.from + ((i + 0.5) / count) * (amphitheater.to - amphitheater.from),
      ),
      'Town hall seat',
      `am${tier}`,
      'bench',
    );
  }),
  ...ring(
    garden.x,
    garden.z,
    garden.loopX,
    [160, 20, 300].map(d => (d * Math.PI) / 180),
    'Garden bench',
    'gb',
    'bench',
    garden.loopZ,
  ),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `bw-${i}`,
    name: 'Boardwalk lounger',
    point: [
      [31.56, -19.63],
      [32.22, -15.79],
      [32.88, -11.95],
      [32.22, -8.11],
      [31.56, -4.27],
    ][i] as Point,
    angle: Math.PI / 2,
    kind: 'lounger' as const,
  })),
  ...[pingPong.x - pingPong.w / 2 - 0.55, pingPong.x + pingPong.w / 2 + 0.55].map((x, i) => ({
    id: `pp-${i}`,
    name: 'Ping-pong table',
    point: [x, pingPong.z] as Point,
    angle: i ? -Math.PI / 2 : Math.PI / 2,
    kind: 'stand' as const,
  })),
  { id: 'ch-0', name: 'Cornhole', point: [cornhole[0][0], -38.02] as Point, angle: Math.PI, kind: 'stand' as const },
  ...ring(
    firepit.x,
    firepit.z,
    1.5,
    [30, 120, 210, 300].map(d => (d * Math.PI) / 180),
    'Firepit log',
    'fp',
    'log',
  ),
  ...hammocks.map((point, i) => ({ id: `hm-${i}`, name: 'Hammock', point, angle: 0, kind: 'hammock' as const })),
  ...[-0.45, 0.45].map((dz, i) => ({
    id: `fs-${i}`,
    name: 'Fishing spot',
    point: [jetty.x0 + 0.7, jetty.z + dz] as Point,
    angle: -Math.PI / 2,
    kind: 'crate' as const,
  })),
  ...kayakMoorings.map((point, i) => ({
    id: `ky-${i}`,
    name: 'Kayak',
    point,
    angle: -Math.PI / 2,
    kind: 'kayak' as const,
    approach: [point[0], jetty.z - 0.45] as Point,
    fixedApproach: true,
  })),
  {
    id: 'pn-0',
    name: 'Piano bench',
    point: [piano.x, piano.z + 0.85] as Point,
    angle: Math.PI,
    kind: 'bench' as const,
  },
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `rt-${i}`,
    name: 'Rooftop lounger',
    point: [-8.4 + i * 1.3, -30.13] as Point,
    angle: 0,
    kind: 'lounger' as const,
    y: ROOF_Y,
    approach: roofStair.foot,
    fixedApproach: true,
  })),
].map(seat => ({ approach: seat.point, ...seat })) as Seat[];
// Places in the sidebar and on the map.
export const locations = [
  {
    id: 'arrival',
    name: 'Arrival pier',
    detail: 'Land here and say hello',
    point: [0, 10.97] as Point,
    color: '#c9a87e',
  },
  {
    id: 'plaza',
    name: 'Central plaza',
    detail: 'Where every walkway meets',
    point: [0, -1.83] as Point,
    color: '#d9c9a2',
  },
  {
    id: 'office',
    name: 'Main workspace',
    detail: 'Desks for Design and Engineering',
    point: [0, -22.03] as Point,
    color: '#c7a57c',
  },
  {
    id: 'meeting',
    name: 'Meeting pavilions',
    detail: 'Rooms for 2, 6 and 12',
    point: [18.48, -8.95] as Point,
    color: '#8fb7b3',
  },
  {
    id: 'cafe',
    name: 'Café & terrace',
    detail: 'Coffee with a sea view',
    point: [13.2, 4.47] as Point,
    color: '#e8a27f',
  },
  {
    id: 'library',
    name: 'Focus library',
    detail: 'Quiet booths for deep work',
    point: [-20.4, -11.23] as Point,
    color: '#9c8cb8',
  },
  {
    id: 'townhall',
    name: 'Town hall',
    detail: 'Quiz at golden hour, movies at dusk',
    point: [-14, 2.77] as Point,
    color: '#d2b68d',
  },
  {
    id: 'wellness',
    name: 'Wellness garden',
    detail: 'A walking loop around the pond',
    point: [garden.x, garden.z + garden.loopZ] as Point,
    color: '#8fb07e',
  },
  {
    id: 'boardwalk',
    name: 'Boardwalk',
    detail: 'Loungers by the east beach',
    point: [30.72, -11.83] as Point,
    color: '#d8c08f',
  },
  { id: 'games', name: 'Games lawn', detail: 'Ping-pong and cornhole', point: [10, -35.67] as Point, color: '#9cc27f' },
  {
    id: 'firepit',
    name: 'Firepit & hammocks',
    detail: 'Swing, sway and toast marshmallows',
    point: [23.32, -7.27] as Point,
    color: '#e09a6b',
  },
  {
    id: 'jetty',
    name: 'Fishing jetty',
    detail: 'Cast a line or take a kayak out',
    point: [-30.48, -4.63] as Point,
    color: '#8fb7c9',
  },
];
export const districts = locations;
// Walkways: spokes from the plaza to every zone.
export const walkways: Point[][] = [
  [
    [-19.8, -11.23],
    [-30.08, -4.63],
  ],
  [
    [0, 10.97],
    [0, 7.82],
  ],
  [
    [0, 3.32],
    [0, -2.23],
  ],
  [
    [0, -14.23],
    [0, -22.93],
  ],
  [
    [4.5, -6.23],
    [12.4, -4.63],
  ],
  [
    [16.4, -4.63],
    [17.4, -4.63],
    [20.8, -11.53],
  ],
  [
    [5, -11.23],
    [17.4, -24.83],
  ],
  [
    [-5.2, -10.23],
    [-15.4, -15.63],
  ],
  [
    [4.3, -4.23],
    [9.6, 1.37],
  ],
  [
    [-4.6, -5.23],
    [-11.2, -1.83],
  ],
  [
    [-6, -31.93],
    [-6.2, -32.83],
    [-10.5, -34.68],
  ],
  [
    [16.5, 2.07],
    [29.76, -1.63],
  ],
  [
    [26.1, -14.23],
    [31.2, -13.63],
  ],
  [
    [13.68, -31.75],
    [13.68, -33.91],
    [10, -36.37],
  ],
];
// Small fixed decor that also blocks walking.
// Plaza lamp posts: evenly spaced round the edge, skipping spots where a walkway leaves the plaza.
export const lampPosts: Point[] = Array.from({ length: 16 }, (_, i) => (i * Math.PI) / 8 + Math.PI / 16)
  .map(a => [plaza.x + Math.cos(a) * (plaza.radius + 0.6), plaza.z + Math.sin(a) * (plaza.radius + 0.6)] as Point)
  .filter(p => walkways.every(path => path.slice(1).every((q, i) => segmentDistance(p, path[i], q) > 1.2)))
  .filter((_, i) => i % 2 === 0);
export const lobbyPlanter: Point = [-3.4, 6.97];
const seatBlocks: Block[] = seats
  .filter(seat => !seat.y && seat.kind !== 'kayak')
  .map(seat => {
    const [w, d] = seatFootprint[seat.kind ?? 'chair'],
      s = Math.abs(Math.sin(seat.angle)),
      c = Math.abs(Math.cos(seat.angle));
    // Axis-aligned seats get a tight box; seats on curves (benches round the plaza, the amphitheater) a circle.
    if (s < 0.1 || c < 0.1) {
      const [hx, hz] = s < 0.1 ? [w / 2, d / 2] : [d / 2, w / 2];
      return { x: seat.point[0], z: seat.point[1], hx: hx + 0.08, hz: hz + 0.08 };
    }
    return { x: seat.point[0], z: seat.point[1], r: (Math.max(w, d) / 2) * 0.8 + 0.08 };
  });
const blocks: Block[] = [
  ...seatBlocks,
  { x: pingPong.x, z: pingPong.z, hx: pingPong.w / 2 + 0.2, hz: pingPong.d / 2 + 0.2 },
  ...cornhole.map(([x, z]) => ({ x, z, hx: 0.5, hz: 0.75 })),
  { x: firepit.x, z: firepit.z, r: firepit.r + 0.25 },
  { x: piano.x, z: piano.z, hx: piano.w / 2 + 0.2, hz: piano.d / 2 + 0.2 },
  { x: telescope[0], z: telescope[1], r: 0.45 },
  {
    x: roofStair.x,
    z: (roofStair.z0 + roofStair.z1) / 2,
    hx: roofStair.w / 2 + 0.25,
    hz: (roofStair.z1 - roofStair.z0) / 2 + 0.1,
  },
  ...[-1, 0, 1].map(k => ({
    x: townhallScreen.x + Math.cos(townhallScreen.facing) * k,
    z: townhallScreen.z - Math.sin(townhallScreen.facing) * k,
    r: 0.45,
  })),
  ...lampPosts.map(([x, z]) => ({ x, z, r: 0.22 })),
  { x: lobbyPlanter[0], z: lobbyPlanter[1], r: 0.5 },
  ...flowerBeds.map(([x, z]) => ({ x, z, r: 0.85 })),
  { x: plaza.x, z: plaza.z, r: plaza.fountain + 0.3 },
  { x: newsScreen.x, z: newsScreen.z, hx: newsScreen.w / 2 + 0.25, hz: 0.35 },
  ...[tables.pavM, tables.pavL, tables.counter, tables.reception, tables.atrium].map(t => ({
    x: t.x,
    z: t.z,
    hx: t.w / 2 + 0.3,
    hz: t.d / 2 + 0.25,
  })),
  { x: tables.pavS.x, z: tables.pavS.z, r: tables.pavS.r + 0.25 },
  ...tables.terrace.map(([x, z]) => ({ x, z, r: 0.7 })),
  { x: WHITEBOARD[0], z: WHITEBOARD[1], hx: 0.45, hz: 0.95 },
  ...walls.map(w => ({ x: w.x, z: w.z, hx: w.w / 2 + 0.3, hz: w.d / 2 + 0.3 })),
  ...booths.flatMap(b => [
    { x: b.x, z: b.z - 0.45, hx: 0.8, hz: 0.45 },
    { x: b.x - 1.1, z: b.z - 0.2, hx: 0.25, hz: 0.8 },
    { x: b.x + 1.1, z: b.z - 0.2, hx: 0.25, hz: 0.8 },
  ]),
];
export function segmentDistance(point: Point, a: Point, b: Point) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dz);
}
// Palms ring the coast, plus a few shade trees on the lawns, kept clear of everything people use.
function clearForTree(point: Point) {
  return (
    shoreDistance(...point) < -WALK_INSET - 1 &&
    locations.every(l => Math.hypot(l.point[0] - point[0], l.point[1] - point[1]) > 2.5) &&
    seats.every(s => Math.hypot(s.point[0] - point[0], s.point[1] - point[1]) > 1.5) &&
    pads.every(p => Math.abs(point[0] - p.x) > p.w / 2 + 1.2 || Math.abs(point[1] - p.z) > p.d / 2 + 1.2) &&
    Math.hypot(point[0] - plaza.x, point[1] - plaza.z) > plaza.radius + 1.5 &&
    Math.hypot(point[0] - amphitheater.x, point[1] - amphitheater.z) > 7.2 &&
    ((point[0] - garden.x) / (garden.loopX + 1.4)) ** 2 + ((point[1] - garden.z) / (garden.loopZ + 1.4)) ** 2 > 1 &&
    segmentDistance(point, boardwalk.from, boardwalk.bend) > 2.5 &&
    segmentDistance(point, boardwalk.bend, boardwalk.to) > 2.5 &&
    walkways.every(path => path.slice(1).every((p, i) => segmentDistance(point, path[i], p) > 1.6)) &&
    (Math.abs(point[0] - gamesLawn.x) > gamesLawn.w / 2 + 1 ||
      Math.abs(point[1] - gamesLawn.z) > gamesLawn.d / 2 + 1) &&
    segmentDistance(point, [jetty.x0, jetty.z], [jetty.x1 + 2, jetty.z]) > 2.2 &&
    Math.hypot(point[0] - roofStair.x, point[1] - (roofStair.z0 + roofStair.z1) / 2) > 3.5
  );
}
export const trees: Point[] = [];
for (let i = 0; i < 36; i++) {
  const point = shorePoint((i / 36) * Math.PI * 2, -WALK_INSET - 1.3);
  if (clearForTree(point)) trees.push(point);
}
for (const point of [
  [-8.4, -17.83],
  [8.4, -17.23],
  [-26.4, -26.23],
  [26.4, -35.83],
  [-6, 6.77],
  [24, -4.03],
  [-28.8, -7.03],
  [-3.6, -40.63],
] as Point[])
  if (clearForTree(point)) trees.push(point);
export const onJetty = (x: number, z: number) =>
  Math.abs(z - jetty.z) < jetty.w / 2 - 0.15 && x > jetty.x0 + 0.15 && x < jetty.x1;
export function walkable(x: number, z: number) {
  if (shoreDistance(x, z) > -WALK_INSET && !onJetty(x, z)) return false;
  if (desks.some(d => Math.abs(x - d.x) < 0.73 && Math.abs(z - d.z) < 0.57)) return false;
  if (trees.some(t => Math.hypot(x - t[0], z - t[1]) < 0.65)) return false;
  if (
    blocks.some(b =>
      'r' in b ? Math.hypot(x - b.x, z - b.z) < b.r : Math.abs(x - b.x) < b.hx && Math.abs(z - b.z) < b.hz,
    )
  )
    return false;
  if (ponds.some(p => ((x - p.x) / (p.rx + 0.25)) ** 2 + ((z - p.z) / (p.rz + 0.25)) ** 2 < 1)) return false;
  return true;
}
// Cells right next to a wall or furniture cost a little more, so routes keep a margin and straighten cleanly.
const hugsObstacle = (p: Point) =>
  !(
    gridWalkable(p[0] + 1, p[1]) &&
    gridWalkable(p[0] - 1, p[1]) &&
    gridWalkable(p[0], p[1] + 1) &&
    gridWalkable(p[0], p[1] - 1)
  );
const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const octile = (a: Point, b: Point) => {
  const dx = Math.abs(a[0] - b[0]),
    dz = Math.abs(a[1] - b[1]);
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
};
// A straight segment is clear when the centre line and a little either side stay walkable.
export function clearLine(a: Point, b: Point, margin = 0.15) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  if (!length) return true;
  const nx = (-dz / length) * margin,
    nz = (dx / length) * margin;
  for (let i = 1, steps = Math.ceil(length / 0.05); i <= steps; i++) {
    const x = a[0] + (dx * i) / steps,
      z = a[1] + (dz * i) / steps;
    if (!walkable(x, z) || (i < steps && (!walkable(x + nx, z + nz) || !walkable(x - nx, z - nz)))) return false;
  }
  return true;
}
// String pulling: from each corner, jump to the furthest waypoint still in a clear straight line.
export function smoothPath(start: Point, route: Point[]): Point[] {
  const out: Point[] = [];
  let from = start,
    i = 0;
  while (i < route.length) {
    let j = route.length - 1;
    while (j > i && !clearLine(from, route[j])) j--;
    out.push(route[j]);
    from = route[j];
    i = j + 1;
  }
  return out;
}
// A* visits the useful part of the larger map; static cell checks are shared across routes.
const gridCache = new Map<string, boolean>();
function gridWalkable(x: number, z: number) {
  const key = `${x},${z}`;
  if (!gridCache.has(key)) gridCache.set(key, walkable(x / 2, z / 2));
  return gridCache.get(key)!;
}
// Grid A* (8 directions, no corner cutting), then straightened so routes run in clean lines.
export function findPath(start: Point, end: Point): Point[] {
  const route = gridPath(start, end);
  return route.length ? smoothPath(start, route) : route;
}
function gridPath(start: Point, end: Point): Point[] {
  if (!walkable(...end)) return [];
  const s = start.map(v => Math.round(v * 2)) as Point,
    e = end.map(v => Math.round(v * 2)) as Point;
  const key = (p: Point) => p.join(',');
  const heap: { point: Point; score: number; cost: number }[] = [];
  const push = (entry: (typeof heap)[number]) => {
    heap.push(entry);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent].score <= entry.score) break;
      heap[i] = heap[parent];
      i = parent;
    }
    heap[i] = entry;
  };
  const pop = () => {
    const first = heap[0],
      last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child++;
        if (heap[child].score >= last.score) break;
        heap[i] = heap[child];
        i = child;
      }
      heap[i] = last;
    }
    return first;
  };
  const prev = new Map<string, Point | null>([[key(s), null]]),
    costs = new Map<string, number>([[key(s), 0]]);
  push({ point: s, score: 0, cost: 0 });
  while (heap.length) {
    const { point: p, cost } = pop();
    if (cost !== costs.get(key(p))) continue;
    if (key(p) === key(e)) {
      const route: Point[] = [end];
      let current: Point | null = p;
      while (current && key(current) !== key(s)) {
        route.unshift([current[0] / 2, current[1] / 2]);
        current = prev.get(key(current)) ?? null;
      }
      return route;
    }
    for (const [dx, dz] of STEPS) {
      // Diagonals only when both side cells are open, so routes never clip an obstacle's corner.
      if (dx && dz && !(gridWalkable(p[0] + dx, p[1]) && gridWalkable(p[0], p[1] + dz))) continue;
      const n: Point = [p[0] + dx, p[1] + dz],
        nextCost = cost + (dx && dz ? Math.SQRT2 : 1) + (hugsObstacle(n) ? 0.6 : 0);
      // The midpoint check catches thin obstacles (lamp posts) that fit between grid cells.
      if (
        gridWalkable(...n) &&
        walkable((p[0] + n[0]) / 4, (p[1] + n[1]) / 4) &&
        nextCost < (costs.get(key(n)) ?? Infinity)
      ) {
        costs.set(key(n), nextCost);
        prev.set(key(n), p);
        push({ point: n, cost: nextCost, score: nextCost + octile(n, e) });
      }
    }
  }
  return [];
}
// Pick each seat's step-in spot: in front if free, otherwise behind (desk and table chairs), otherwise
// beside, and always one the pathfinder can reach from the pier.
const reachable = (() => {
  const start = locations[0].point.map(v => Math.round(v * 2)) as Point,
    seen = new Set([start.join(',')]),
    queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    for (const [dx, dz] of STEPS) {
      if (dx && dz && !(gridWalkable(x + dx, z) && gridWalkable(x, z + dz))) continue;
      const key = `${x + dx},${z + dz}`;
      if (!seen.has(key) && gridWalkable(x + dx, z + dz)) {
        seen.add(key);
        queue.push([x + dx, z + dz]);
      }
    }
  }
  return (p: Point) => seen.has(`${Math.round(p[0] * 2)},${Math.round(p[1] * 2)}`);
})();
for (const seat of seats.filter(s => !s.fixedApproach)) {
  const f: Point = [Math.sin(seat.angle), Math.cos(seat.angle)],
    side: Point = [f[1], -f[0]];
  const directions: Point[] = [f, [-f[0], -f[1]], side, [-side[0], -side[1]]];
  const spot = [0.8, 1, 1.25]
    .flatMap(d => directions.map(([dx, dz]) => [seat.point[0] + dx * d, seat.point[1] + dz * d] as Point))
    .find(p => walkable(...p) && reachable(p));
  if (!spot) throw new Error(`No free space beside ${seat.id}`);
  seat.approach = spot;
}
