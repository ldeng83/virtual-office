import { useEffect, useRef, useState } from 'react';
import type { Period } from './daylight';
import { nextActivity, resolveTarget, type Activity, type Target } from './people';
import {
  ARRIVE_TIMEOUT_MS,
  autopilotBlock,
  autopilotFeedText,
  CLICK_SLOP,
  idlePhase,
  inputIntent,
  seatHome,
  type AutopilotSettings,
} from './autopilot';
import { playerControl } from './fun-state';

export type AutopilotCommand = { target: Target; seq: number };

// Idle detection and the autopilot planner for you. Any real input (a key, a click or tap, a scroll)
// resets the idle clock and, while autopilot is on, hands control straight back.
export function useAutopilot({
  settings,
  checked,
  status,
  seat,
  setSeat,
  period,
  blocked,
  occupied,
  onStart,
  post,
}: {
  settings: AutopilotSettings;
  checked: boolean;
  status: string;
  seat: string | null;
  setSeat: (id: string | null) => void;
  period: Period;
  // A dialog or the full map is open: the idle countdown waits.
  blocked: boolean;
  // Seats coworkers are using (or heading to).
  occupied: ReadonlySet<string>;
  onStart: () => void;
  post: (icon: string, text: string) => void;
}) {
  const [active, setActive] = useState(false),
    [countdown, setCountdown] = useState<number | null>(null),
    [activity, setActivity] = useState<Activity | null>(null),
    [command, setCommand] = useState<AutopilotCommand | null>(null);
  const lastInput = useRef(Date.now()),
    activeRef = useRef(false),
    seatedHome = useRef<Activity | null>(null),
    current = useRef<Activity | null>(null),
    target = useRef<Target | null>(null),
    timer = useRef(0);
  // The latest props, for timers and event listeners.
  const live = useRef({ settings, checked, status, seat, setSeat, period, blocked, occupied, onStart, post });
  live.current = { settings, checked, status, seat, setSeat, period, blocked, occupied, onStart, post };

  const clearTimer = () => window.clearTimeout(timer.current);
  const plan = () => {
    clearTimer();
    if (!activeRef.current) return;
    const { period, status, occupied, seat, post } = live.current;
    const block = autopilotBlock(period, status, seatedHome.current);
    const taken = new Set(occupied);
    const next = nextActivity(block, current.current, Math.random, taken);
    const goal = resolveTarget(next, taken);
    if (!goal) return;
    current.current = next;
    target.current = goal;
    setActivity(next);
    if (next !== block.home) post(next.icon, autopilotFeedText(next));
    // Already sitting where we're meant to be: just stay a while.
    if (goal.seatId && goal.seatId === seat) {
      timer.current = window.setTimeout(plan, goal.dwell * 1000);
      return;
    }
    setCommand({ target: goal, seq: Date.now() });
    timer.current = window.setTimeout(plan, ARRIVE_TIMEOUT_MS);
  };
  // The scene calls this when the walk (or hike) to the current spot ends.
  const arrive = () => {
    const goal = target.current;
    if (!activeRef.current || !goal) return;
    clearTimer();
    if (goal.seatId) {
      // Someone sat down while we were walking over: pick again.
      if (live.current.occupied.has(goal.seatId)) {
        current.current = null;
        timer.current = window.setTimeout(plan, 500);
        return;
      }
      live.current.setSeat(goal.seatId);
    }
    timer.current = window.setTimeout(plan, goal.dwell * 1000);
  };
  const start = () => {
    activeRef.current = true;
    setActive(true);
    setCountdown(null);
    seatedHome.current = seatHome(live.current.seat);
    current.current = null;
    live.current.onStart();
    plan();
  };
  const takeOver = () => {
    lastInput.current = Date.now();
    setCountdown(null);
    if (!activeRef.current) return;
    activeRef.current = false;
    setActive(false);
    clearTimer();
    target.current = null;
    current.current = null;
    setActivity(null);
    // Stop where you are; a seat (or a ride under way) stays as it is.
    playerControl.halt();
  };

  // Real input from you.
  useEffect(() => {
    const input = (e: Event) => {
      if (e instanceof KeyboardEvent && ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
      // The pill's own Take over button handles its click (taking over on press would remove it mid-click).
      if ((e.target as HTMLElement | null)?.closest?.('.autopilot-pill')) {
        lastInput.current = Date.now();
        return;
      }
      // Looking around (zoom, pan, orbit) shows you're here but leaves autopilot running.
      const el = e.target as HTMLElement | null,
        onMap = !!el?.closest?.('.full-map, .mini-map'),
        where = el?.closest?.('.map-controls, .view-modes')
          ? 'zoom'
          : onMap || !el?.closest?.('.island-panel')
            ? 'other'
            : el.tagName === 'CANVAS'
              ? 'view'
              : 'panel',
        intent = inputIntent(e.type, e instanceof PointerEvent ? e.button : 0, where);
      if (intent === 'control') return takeOver();
      lastInput.current = Date.now();
      if (intent === 'press') {
        const down = e as PointerEvent;
        press = { x: down.clientX, y: down.clientY, id: down.pointerId };
      }
    };
    // A press on the 3D view that comes back up where it went down was a click, not a drag.
    let press: { x: number; y: number; id: number } | null = null;
    const release = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
      press = null;
      if (e.type === 'pointerup' && moved < CLICK_SLOP) takeOver();
    };
    const events = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const;
    for (const name of events) window.addEventListener(name, input, { capture: true, passive: true });
    window.addEventListener('pointerup', release, { capture: true });
    window.addEventListener('pointercancel', release, { capture: true });
    return () => {
      for (const name of events) window.removeEventListener(name, input, { capture: true });
      window.removeEventListener('pointerup', release, { capture: true });
      window.removeEventListener('pointercancel', release, { capture: true });
    };
  }, []);

  // The idle clock: a countdown for the last few seconds, then autopilot.
  useEffect(() => {
    const tick = window.setInterval(() => {
      const { settings, checked, blocked } = live.current;
      const typing = !!(document.activeElement as HTMLElement | null)?.closest?.('input,textarea,select');
      if (activeRef.current) {
        // Turned off, checked out or paused while it was running.
        if (!settings.enabled || settings.paused || !checked) takeOver();
        return;
      }
      if (!settings.enabled || settings.paused || !checked || blocked || typing) {
        lastInput.current = Date.now();
        setCountdown(null);
        return;
      }
      const phase = idlePhase(Date.now() - lastInput.current, settings.delay);
      if (phase.start) start();
      else setCountdown(phase.countdown);
    }, 250);
    return () => {
      window.clearInterval(tick);
      clearTimer();
    };
  }, []);

  // A new status (Focused, In a meeting…) changes the plan right away.
  useEffect(() => {
    if (activeRef.current) {
      current.current = null;
      plan();
    }
  }, [status]);

  return { active, countdown, activity, command, arrive, takeOver };
}
