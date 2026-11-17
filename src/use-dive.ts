import { useEffect, useRef, useState } from 'react';
import { SPECIES, type SpeciesId } from './dive';
import { diveState, seaState } from './fun-state';
import { seats } from './world';

// The React side of a dive: the air gauge, the logbook (kept between visits) and the notices.
export type DiveLog = { seen: Partial<Record<SpeciesId, string>>; dives: number };
const today = () => new Date().toLocaleDateString('en-CA');
function readLog(): DiveLog {
  try {
    return { seen: {}, dives: 0, ...JSON.parse(localStorage.getItem('atoll-dive-log') || '{}') };
  } catch {
    return { seen: {}, dives: 0 };
  }
}
const surfaced = { air: 1, under: false, free: false, returning: false };

export function useDive({
  seat,
  setSeat,
  notify,
}: {
  seat: string | null;
  setSeat: (id: string | null) => void;
  notify: (message: string) => void;
}) {
  const diving = seats.find(s => s.id === seat)?.ride?.kind === 'scuba';
  const [log, setLog] = useState(readLog),
    [hud, setHud] = useState(surfaced),
    [splash, setSplash] = useState(0);
  const known = useRef(log);
  known.current = log;
  useEffect(() => {
    try {
      localStorage.setItem('atoll-dive-log', JSON.stringify(log));
    } catch {
      /* Storage may be disabled. */
    }
  }, [log]);
  // New finds go in the log, with a note in the activity feed the first time.
  useEffect(() => {
    diveState.onSplash = () => setSplash(n => n + 1);
    diveState.onSpot = id => {
      if (known.current.seen[id]) return;
      const species = SPECIES.find(s => s.id === id)!,
        found = Object.keys(known.current.seen).length + 1,
        name = species.name[0].toLowerCase() + species.name.slice(1),
        where: [number, number] = [diveState.x, diveState.z];
      setLog(l => ({ ...l, seen: { ...l.seen, [id]: today() } }));
      notify(
        found === SPECIES.length
          ? `📖 ${species.icon} ${species.name}: that completes your dive log!`
          : `📖 New in your dive log: ${species.icon} ${name} (${found}/${SPECIES.length})`,
      );
      seaState.onSighting({ icon: species.icon, who: 'You', text: `logged ${name} on a dive`, where: () => where });
    };
    return () => {
      diveState.onSplash = diveState.onSpot = () => {};
    };
  }, []);
  // The gauge reads the dive a few times a second, and says so when things change.
  useEffect(() => {
    if (!diving) return setHud(surfaced);
    let was = surfaced,
      warned = false,
      counted = false;
    const clock = window.setInterval(() => {
      const now = {
        air: Math.ceil(diveState.air * 180) / 180,
        under: diveState.under,
        free: diveState.free,
        returning: diveState.returning,
      };
      if (now.under && !counted) {
        counted = true;
        setLog(l => ({ ...l, dives: l.dives + 1 }));
      }
      if (now.free && !was.free) notify('🤿 You’re swimming it yourself now. Surface when you’ve seen enough.');
      if (now.air < 1 / 6 && !warned && !now.returning) {
        warned = true;
        notify('🫧 Thirty seconds of air left.');
      }
      if (now.returning && !was.returning && now.air <= 0) notify('🫧 Tank’s empty: heading back to the ladder.');
      if (Object.entries(now).some(([key, value]) => was[key as keyof typeof now] !== value)) setHud(now);
      was = now;
    }, 250);
    return () => window.clearInterval(clock);
  }, [diving]);
  return {
    diving,
    hud,
    log,
    found: Object.keys(log.seen).length,
    splash,
    // Swim back up to the ladder; pressed again (or before you're under), climb straight out.
    surface: () => {
      if (diveState.under && !diveState.returning) diveState.surface = true;
      else setSeat(null);
    },
  };
}
