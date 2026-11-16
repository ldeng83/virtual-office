import { useEffect, useMemo, useRef, useState } from 'react';
import type { Period } from './daylight';
import { EMOTE_ICONS, type Emote } from './fun-state';
import { dailyShells } from './island-extras';
import { LofiRadio, Piano } from './music';
import type { CoworkerView } from './use-coworkers';
import { locations, radio, seats, type Point } from './world';

// Fun and relaxing activities: radio and piano, fishing, the seashell hunt, emotes, passing showers,
// and a gentle nudge to take a break after a long stretch at your desk.
type Stats = { fish: number; shellsTotal: number; shellsDay: string; shellsFound: string[] };
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
  const fallback: Stats = { fish: 0, shellsTotal: 0, shellsDay: today(), shellsFound: [] };
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
    if (seat?.startsWith('ky-'))
      notify('🛶 Paddling around the island. Press a movement key or Paddle back to return.');
    if (seat?.startsWith('hm-')) notify('🌴 Swinging in the hammock. Take your time.');
    if (seat?.startsWith('rt-')) notify('☀️ Up on the rooftop terrace. Best view on the island.');
  }, [seat]);

  // Telescope: stars only after dusk.
  const lookThroughTelescope = () => {
    if (period === 'dusk' || period === 'night') openTelescope();
    else notify('🔭 The stars come out after dusk. Come back tonight.');
  };

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

// What the seat message says for each kind of seat.
export function seatMessage(id: string) {
  const seat = seats.find(s => s.id === id);
  if (!seat) return { text: 'Settled in', action: 'Stand up' };
  if (seat.kind === 'kayak') return { text: 'Paddling around the island', action: 'Paddle back' };
  if (seat.kind === 'hammock') return { text: 'Swinging in the hammock', action: 'Get up' };
  if (id === 'pn-0') return { text: 'Playing the piano', action: 'Stop playing' };
  if (id.startsWith('fs-')) return { text: 'Fishing off the jetty', action: 'Reel in' };
  if (id.startsWith('pp-')) return { text: 'Playing ping-pong', action: 'Put the paddle down' };
  if (id.startsWith('rt-')) return { text: 'Relaxing on the rooftop terrace', action: 'Head downstairs' };
  return { text: `Settled into ${seat.name}`, action: 'Stand up' };
}
