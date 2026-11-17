import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { diveState, playerState } from './fun-state';
import { groundHeight } from './highlands';
import type { Spot } from './interact';
import { nearbyPlaces, PLACE_ACTIVITIES, type Nearby } from './place-activities';
import { ZoneLabel } from './scene-parts';
import { districts } from './world';

const FAR_VIEW = 6;
const NOWHERE: Nearby = { open: null, hinted: [] };
// The place names over the island. The one you're standing at opens up into buttons for what you
// can do there; places a little further off show icons for it; the rest are just names.
export function PlaceLabels({
  raised,
  quiet,
  occupied,
  onUse,
}: {
  // Overview mode lifts the names clear of the buildings.
  raised: boolean;
  // Seated, riding, diving or on autopilot: names only.
  quiet: boolean;
  occupied: ReadonlySet<string>;
  onUse: (spot: Spot) => void;
}) {
  const [nearby, setNearby] = useState(NOWHERE),
    last = useRef(NOWHERE);
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    // From far enough out the names would only pile up on each other.
    if (group.current) group.current.visible = camera.zoom > FAR_VIEW;
    const next = quiet || diveState.under ? NOWHERE : nearbyPlaces(playerState.x, playerState.z, last.current);
    if (next.open === last.current.open && next.hinted.join() === last.current.hinted.join()) return;
    last.current = next;
    setNearby(next);
  });
  return (
    <group ref={group}>
      {districts
        .filter(d => d.id !== 'arrival')
        .map(d => (
          <ZoneLabel
            key={d.id}
            position={[d.point[0], groundHeight(...d.point) + (raised ? 3 : 2.6), d.point[1] - 1.6]}
            id={d.id}
            title={d.name.toUpperCase()}
            stage={nearby.open === d.id ? 'open' : nearby.hinted.includes(d.id) ? 'hint' : 'name'}
            activities={PLACE_ACTIVITIES[d.id] ?? []}
            occupied={occupied}
            onUse={onUse}
          />
        ))}
    </group>
  );
}
