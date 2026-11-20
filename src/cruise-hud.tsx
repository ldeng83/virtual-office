import { useEffect, useRef, useState } from 'react';
import { cruiseState, playerState } from './fun-state';
import { BOAT_NAME, clockText, sailingAt, TRIP_NAMES, BELL_SECONDS, cruiseRoute } from './cruise';
import { cruisePier, pierPoint } from './world';
import { ringBell } from './music';

// The Island Queen's line in the HUD: at the pier, what she's doing next and when; aboard, the trip and
// how long till she's back. The bell rings (if island sounds are on) and a toast goes up on the last
// call and as she casts off, for anyone aboard or on the pier.
const PIER_MIDDLE = pierPoint(cruisePier.length / 2 + 2, 0);
const nearPier = () => Math.hypot(playerState.x - PIER_MIDDLE[0], playerState.z - PIER_MIDDLE[1]) < 11;
export function CruiseHud({
  notify,
  volume,
  below,
}: {
  notify: (message: string) => void;
  // Bell volume (0 with island sounds off).
  volume: number;
  // Sit below the seat message when that's showing.
  below: boolean;
}) {
  const [line, setLine] = useState<string | null>(null),
    last = useRef<{ phase: string; bell: boolean } | null>(null),
    live = useRef({ notify, volume });
  live.current = { notify, volume };
  useEffect(() => {
    const tick = () => {
      const s = sailingAt(Date.now()),
        aboard = cruiseState.aboard,
        here = aboard || nearPier(),
        trip = TRIP_NAMES[s.trip],
        bell = s.phase === 'boarding' && s.departsIn <= BELL_SECONDS,
        before = last.current;
      last.current = { phase: s.phase, bell };
      if (before && here) {
        if (bell && !before.bell) {
          ringBell(live.current.volume / 100);
          live.current.notify(`🔔 Last call for the ${trip}: the ${BOAT_NAME} sails in ${BELL_SECONDS} seconds.`);
        }
        if (before.phase === 'boarding' && s.phase !== 'boarding')
          live.current.notify(
            aboard
              ? `🛳️ All aboard! The ${trip} is under way${
                  s.trip === 'whales' && cruiseRoute(s.sailing).whale !== null ? ', out to meet a whale' : ''
                }.`
              : `🛳️ The ${BOAT_NAME} has sailed. She's back in ${clockText(s.backIn)}.`,
          );
      }
      setLine(
        !here
          ? null
          : aboard
            ? `Aboard the ${BOAT_NAME} · ${trip} · ${
                s.phase === 'boarding' ? `departs in ${clockText(s.departsIn)}` : `back in ${clockText(s.backIn)}`
              }`
            : s.phase === 'boarding'
              ? `${BOAT_NAME} · ${trip} · departs in ${clockText(s.departsIn)}`
              : `${BOAT_NAME} · out on the ${trip} · back in ${clockText(s.backIn)}`,
      );
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, []);
  return line ? (
    <div className={below ? 'cruise-hud below' : 'cruise-hud'} role="status">
      <span aria-hidden="true">🛳️</span>
      <span>{line}</span>
    </div>
  ) : null;
}
