import { shoreRadius, shoreSlope, ISLAND_CENTER_Z } from './shoreline.ts';
// The coastal residents. Dolphins, whales and the roaming schools live in open-sea.ts.
export type SeaAnimal = 'turtle' | 'school' | 'ray' | 'crab';
export function animalRoute(kind: SeaAnimal, index: number, time: number) {
  // Small oval routes stay within distinct habitats, leaving most water empty.
  const radii = { turtle: 1.3, school: 1.25, ray: 2, crab: -0.45 };
  const speeds = { turtle: 0.18, school: 0.32, ray: 0.14, crab: 0 };
  const starts = {
    turtle: [1.35, 1.75],
    school: [1.2, 1.65, 1.9],
    ray: [0.15, 0.4],
    crab: [0.85, 1.12, 1.3],
  };
  const arc = { turtle: 0.1, school: 0.12, ray: 0.12, crab: 0 };
  const width = { turtle: 0.25, school: 0.22, ray: 0.35, crab: 0 };
  const swim = time * speeds[kind] + index * 2.1;
  const crabPhase = (time + index * 4) % 24;
  const ease = (value: number) => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, value)))) / 2;
  const crabTravel =
    crabPhase < 6 ? ease(crabPhase / 6) : crabPhase < 10 ? 1 : crabPhase < 16 ? 1 - ease((crabPhase - 10) / 6) : 0;
  const hiding = crabPhase > 20 ? Math.sin(((crabPhase - 20) / 4) * Math.PI) : 0;
  const activity = kind === 'crab' ? (crabPhase < 6 || (crabPhase >= 10 && crabPhase < 16) ? 1 : 0) : 1;
  const angle =
    kind === 'crab'
      ? starts.crab[index % 3] + (crabTravel - 0.5) * 0.13
      : starts[kind][index % starts[kind].length] + Math.sin(swim) * arc[kind];
  const radius = shoreRadius(angle) + radii[kind] + Math.cos(swim) * width[kind];
  const angularVelocity = Math.cos(swim) * arc[kind] * speeds[kind];
  const radialVelocity = -Math.sin(swim) * width[kind] * speeds[kind] + shoreSlope(angle) * angularVelocity;
  const dx = (Math.cos(angle) * radialVelocity - Math.sin(angle) * radius * angularVelocity) * 1.28;
  const dz = Math.sin(angle) * radialVelocity + Math.cos(angle) * radius * angularVelocity;
  const heading = kind === 'crab' ? -angle : Math.atan2(dx, dz);
  const y =
    kind === 'crab'
      ? -0.09 - hiding * 0.3
      : kind === 'school'
        ? -0.85
        : kind === 'ray'
          ? -0.9
          : -0.48 + Math.sin(time * 0.45 + index * 2) * 0.12;
  return {
    x: Math.cos(angle) * radius * 1.28,
    z: ISLAND_CENTER_Z + Math.sin(angle) * radius,
    y,
    heading,
    activity,
    pitch: 0,
  };
}
