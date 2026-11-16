import { useEffect, useMemo, useRef, useState } from 'react';
import type { Period } from './daylight';
import { EMOTE_ICONS, type Emote } from './fun-state';
import type { RideKind } from './rides';
import { dailyShells } from './island-extras';
import { CAVE, checkpoints, SUMMIT, TRAILS } from './highlands';
import { LofiRadio, Piano } from './music';
import type { CoworkerView } from './use-coworkers';
import { locations, radio, seats, type Point } from './world';

// Fun and relaxing activities: radio and piano, fishing, the seashell hunt, emotes, passing showers,
// and a gentle nudge to take a break after a long stretch at your desk.
type Stats = {
  fish: number;
  shellsTotal: number;
  shellsDay: string;
  shellsFound: string[];
  // Trails completed (trail id → the day you last finished it) and the days you reached the summit.
  trails: Record<string, string>;
  summits: string[];
};
const FISH = [
  'a mackerel',
  'a sea bass',
  'a little snapper',
  'a sardine',
  'a bright parrotfish',
  'an old boot (it happens)',
  'a silver mullet',
];
const today = () => new Date().toLocaleDateString('en-CA');
function readStats(): Stats {
  const fallback: Stats = { fish: 0, shellsTotal: 0, shellsDay: today(), shellsFound: [], trails: {}, summits: [] };
  try {
    const stored = { ...fallback, ...JSON.parse(localStorage.getItem('atoll-fun') || '{}') } as Stats;
    return stored.shellsDay === today() ? stored : { ...stored, shellsDay: today(), shellsFound: [] };
  } catch {
    return fallback;
  }
}

export function useFun({
  seat,
  setSeat,
  position,
  notify,
  period,
  motion,
  nearby,
  say,
  travel,
  openTelescope,
}: {
  seat: string | null;
  setSeat: (id: string | null) => void;
  position: Point;
  notify: (message: string) => void;
  period: Period;
  motion: boolean;
  nearby: CoworkerView | undefined;
  say: (personId: string, text: string) => void;
  travel: (point: Point) => void;
  openTelescope: () => void;
}) {
  const [stats, setStats] = useState(readStats);
  useEffect(() => {
    try {
      localStorage.setItem('atoll-fun', JSON.stringify(stats));
    } catch {
      /* Storage may be disabled. */
    }
  }, [stats]);

  // Café radio: plays for everyone near the café; louder the closer you are.
  const radioPlayer = useRef<LofiRadio | null>(null);
  const [radioOn, setRadioOn] = useState(false);
  const toggleRadio = () => {
    radioPlayer.current ??= new LofiRadio();
    if (radioOn) radioPlayer.current.stop();
    else {
      radioPlayer.current.start();
      notify('📻 Lo-fi radio on at the café. It gets quieter as you walk away.');
    }
    setRadioOn(!radioOn);
  };
  useEffect(() => {
    if (!radioOn) return;
    const distance = Math.hypot(position[0] - radio[0], position[1] - radio[1]);
    radioPlayer.current?.setVolume(Math.max(0, Math.min(1, 1 - (distance - 3) / 16)));
  }, [position, radioOn]);
  useEffect(() => () => radioPlayer.current?.stop(), []);

  // Piano: sitting at it plays a soft improvisation until you stand up.
  const piano = useRef<Piano | null>(null);
  useEffect(() => {
    if (seat !== 'pn-0') return;
    piano.current ??= new Piano();
    piano.current.start();
    notify('🎹 You’re playing the piano. Stand up to stop.');
    return () => piano.current?.stop();
  }, [seat]);

  // Fishing: now and then something bites.
  useEffect(() => {
    if (!seat?.startsWith('fs-')) return;
    notify('🎣 Line in the water. Something will bite soon…');
    let timer = 0;
    const wait = () => {
      timer = window.setTimeout(
        () => {
          if (Math.random() < 0.7) {
            const fish = FISH[Math.floor(Math.random() * FISH.length)];
            setStats(s => ({ ...s, fish: s.fish + (fish.includes('boot') ? 0 : 1) }));
            notify(`🐟 You caught ${fish}! ${fish.includes('boot') ? '' : 'Back into the sea it goes.'}`);
          }
          wait();
        },
        7000 + Math.random() * 8000,
      );
    };
    wait();
    return () => window.clearTimeout(timer);
  }, [seat]);

  useEffect(() => {
    const ride = seats.find(s => s.id === seat)?.ride?.kind;
    if (ride) notify(RIDE_STARTS[ride]);
    if (seat?.startsWith('hm-')) notify('🌴 Swinging in the hammock. Take your time.');
    if (seat?.startsWith('rt-')) notify('☀️ Up on the rooftop terrace. Best view on the island.');
  }, [seat]);

  // Telescope: stars only after dusk.
  const lookThroughTelescope = () => {
    if (period === 'dusk' || period === 'night') openTelescope();
    else notify('🔭 The stars come out after dusk. Come back tonight.');
  };

  // Trails: pass every checkpoint along a trail to complete it; the summit and the cave are milestones.
  const visited = useRef<Record<string, Set<number>>>({}),
    cave = useRef(false);
  useEffect(() => {
    const [x, z] = position;
    if (z > -56) return;
    for (const trail of TRAILS) {
      const marks = checkpoints(trail),
        seen = (visited.current[trail.id] ??= new Set());
      marks.forEach((p, i) => Math.hypot(p[0] - x, p[1] - z) < 2.4 && seen.add(i));
      if (seen.size === marks.length) {
        seen.clear();
        setStats(s => ({ ...s, trails: { ...s.trails, [trail.id]: today() } }));
        notify(`${trail.icon} You completed the ${trail.name}! Badge earned.`);
      }
    }
    if (Math.hypot(SUMMIT[0] - x, SUMMIT[1] - z) < 2.6)
      setStats(s => {
        if (s.summits.includes(today())) return s;
        notify('⛰️ You reached the summit! Take a seat and enjoy the view.');
        return { ...s, summits: [...s.summits, today()].slice(-30) };
      });
    if (!cave.current && Math.hypot(CAVE.x - x, CAVE.z - z) < 2.6) {
      cave.current = true;
      notify('💎 You found the crystal cave beside the waterfall.');
    }
  }, [position]);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA');
  const summitsThisWeek = stats.summits.filter(d => d > weekAgo).length,
    trailsDone = Object.keys(stats.trails).length;

  // Seashell hunt: five new shells a day.
  const shells = useMemo(
    () => dailyShells(stats.shellsDay).filter(s => !stats.shellsFound.includes(s.id)),
    [stats.shellsDay, stats.shellsFound],
  );
  const collectShell = (id: string) => {
    setStats(s => {
      if (s.shellsFound.includes(id)) return s;
      const found = s.shellsFound.length + 1;
      notify(
        found >= 5
          ? '🐚 All five seashells found today. New ones wash up tomorrow!'
          : `🐚 You found a seashell! ${found}/5 today.`,
      );
      return { ...s, shellsFound: [...s.shellsFound, id], shellsTotal: s.shellsTotal + 1 };
    });
  };

  // Emotes, and coworkers nearby react to them.
  const [emote, setEmote] = useState<{ kind: Emote; seq: number } | null>(null);
  const doEmote = (kind: Emote) => {
    if (seat) setSeat(null);
    setEmote({ kind, seq: Date.now() });
    const friend = nearby?.target ? nearby.person : null;
    if (kind === 'highfive') {
      if (friend) {
        say(friend.id, '🙌 Up top!');
        notify(`You high-fived ${friend.name}! 🙌`);
      } else notify('🙌 High five! Walk up to someone to get one back.');
    } else if (friend && kind === 'wave') say(friend.id, '👋 Hey there!');
    else if (friend && kind === 'dance') say(friend.id, '😄 Nice moves!');
    else if (friend && kind === 'cheer') say(friend.id, '🎉 Woo!');
  };

  // Passing showers every so often (with motion on), followed by a rainbow.
  const [raining, setRaining] = useState(false),
    [rainbow, setRainbow] = useState(false);
  const weatherTimers = useRef<number[]>([]);
  const startRain = () => {
    if (raining) return;
    setRaining(true);
    notify('🌧️ A passing shower. The café and the pavilions are dry.');
    weatherTimers.current.push(
      window.setTimeout(() => {
        setRaining(false);
        setRainbow(true);
        notify('🌈 A rainbow over the sea.');
        weatherTimers.current.push(window.setTimeout(() => setRainbow(false), 45000));
      }, 70000),
    );
  };
  useEffect(() => {
    if (!motion) return;
    const timer = window.setTimeout(startRain, (6 + Math.random() * 6) * 60000);
    return () => window.clearTimeout(timer);
  }, [motion, raining]);
  useEffect(() => () => weatherTimers.current.forEach(t => window.clearTimeout(t)), []);

  // Break nudge after two minutes in a row at a desk.
  const deskSince = useRef<number | null>(null);
  const [nudge, setNudge] = useState(false),
    snoozeUntil = useRef(0);
  useEffect(() => {
    deskSince.current = seat?.startsWith('desk-') ? Date.now() : null;
    setNudge(false);
  }, [seat]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (deskSince.current && Date.now() - deskSince.current > 120000 && Date.now() > snoozeUntil.current)
        setNudge(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);
  const takeBreak = () => {
    setNudge(false);
    setSeat(null);
    travel(locations.find(l => l.id === 'firepit')!.point);
    notify('🌴 Break time. The hammocks are just here.');
  };
  const snooze = () => {
    setNudge(false);
    snoozeUntil.current = Date.now() + 5 * 60000;
  };

  return {
    stats,
    summitsThisWeek,
    trailsDone,
    radioOn,
    toggleRadio,
    lookThroughTelescope,
    shells,
    collectShell,
    petCat: () => notify('💛 Mochi purrs and follows you for a while.'),
    emote,
    doEmote,
    emoteIcons: EMOTE_ICONS,
    raining,
    rainbow,
    startRain,
    nudge,
    takeBreak,
    snooze,
  };
}

// Rides run on autopilot; any movement key (or the button) brings you back.
const RIDE_STARTS: Record<RideKind, string> = {
  kayak: '🛶 Paddling around the island. Press a movement key or Paddle back to return.',
  jetski: '🚤 Full throttle! A lap of the island on the jet ski.',
  sailboat: '⛵ Sails up. A slow, calm lap of the island.',
  parasail: '🪂 Hold on: the boat lifts you up for the best view of the island.',
  climb: '🧗 Climbing the bluff. There’s a lookout at the top.',
  scuba: '🤿 Diving down to the reef. Look out for the turtle and the wreck.',
  ferry: '⛴️ All aboard the water taxi. Sit back for the trip round the coast.',
};
const RIDE_MESSAGES: Record<RideKind, { text: string; action: string }> = {
  kayak: { text: 'Paddling around the island', action: 'Paddle back' },
  jetski: { text: 'Riding the jet ski', action: 'Head back' },
  sailboat: { text: 'Sailing around the island', action: 'Sail back' },
  parasail: { text: 'Parasailing over the sea', action: 'Come down' },
  climb: { text: 'On the climbing bluff', action: 'Climb down' },
  scuba: { text: 'Scuba diving on the reef', action: 'Surface' },
  ferry: { text: 'On the water taxi', action: 'Get off' },
};

// What the seat message says for each kind of seat.
export function seatMessage(id: string) {
  const seat = seats.find(s => s.id === id);
  if (!seat) return { text: 'Settled in', action: 'Stand up' };
  if (seat.ride) return RIDE_MESSAGES[seat.ride.kind];
  if (seat.kind === 'hammock') return { text: 'Swinging in the hammock', action: 'Get up' };
  if (id === 'pn-0') return { text: 'Playing the piano', action: 'Stop playing' };
  if (id.startsWith('fs-')) return { text: 'Fishing off the jetty', action: 'Reel in' };
  if (id.startsWith('pp-')) return { text: 'Playing ping-pong', action: 'Put the paddle down' };
  if (id.startsWith('rt-')) return { text: 'Relaxing on the rooftop terrace', action: 'Head downstairs' };
  return { text: `Settled into ${seat.name}`, action: 'Stand up' };
}
