import React, { useEffect, useRef, useState } from 'react';
import { type Point } from './world';
import { cameraView } from './camera-view';
import {
  advanceWork,
  currentTask,
  demoCoworkers,
  nextActivity,
  peopleView,
  resolveTarget,
  type DemoCoworker,
  type Target,
  type WorkState,
} from './people';
import type { Period } from './daylight';

export type FeedItem = { id: number; at: Date; personId: string; who: string; icon: string; text: string };
export type CoworkerView = { person: DemoCoworker; target: Target | null };
// Demo coworker state: routines, work progress, the team feed, greetings and seat ownership.
export function useCoworkers({
  period,
  seat,
  setSeat,
  notify,
  position,
  showDemo,
  onLook,
}: {
  period: Period;
  seat: string | null;
  setSeat: (id: string | null) => void;
  notify: (message: string) => void;
  position: Point;
  showDemo: boolean;
  onLook: () => void;
}) {
  // Demo coworkers: each part of the day has a home activity plus short errands. A small planner
  // picks what's next when the current activity's time is up; the scene just walks them there.
  const seatRef = useRef(seat);
  seatRef.current = seat;
  const planHome = (period: Period) => {
    const taken = new Set(seatRef.current ? [seatRef.current] : []),
      plans: Record<string, Target | null> = {};
    for (const person of demoCoworkers) {
      const target = resolveTarget(person.schedule[period]?.home ?? null, taken);
      if (target?.seatId) taken.add(target.seatId);
      plans[person.id] = target;
    }
    return plans;
  };
  // On page load they're already partway through their current activity, so the first move comes soon.
  const [plans, setPlans] = useState(() => {
    const initial = planHome(period);
    for (const target of Object.values(initial)) if (target) target.dwell *= 0.1 + Math.random() * 0.25;
    return initial;
  });
  const planPeriod = useRef(period);
  const deadlines = useRef(new WeakMap<Target, number>());
  useEffect(() => {
    if (planPeriod.current !== period) {
      planPeriod.current = period;
      setPlans(planHome(period));
    }
  }, [period]);
  useEffect(() => {
    const timers = demoCoworkers.map(person => {
      const current = plans[person.id],
        block = person.schedule[planPeriod.current];
      if (!current || !block || !block.errands.length) return 0;
      // Time up = walking there (estimated from where they are when it starts) + dwelling.
      // Deadlines are fixed per activity so one coworker's change doesn't reset the other's clock.
      if (!deadlines.current.has(current)) {
        const at = peopleView[person.id],
          walkSeconds = at ? (Math.hypot(at.x - current.point[0], at.z - current.point[1]) * 1.4) / 2.4 : 0;
        deadlines.current.set(current, Date.now() + (walkSeconds + current.dwell) * 1000);
      }
      return window.setTimeout(
        () =>
          setPlans(all => {
            if (all[person.id] !== current) return all;
            const taken = new Set([
              ...(seatRef.current ? [seatRef.current] : []),
              ...Object.entries(all).flatMap(([id, t]) => (id !== person.id && t?.seatId ? [t.seatId] : [])),
            ]);
            return { ...all, [person.id]: resolveTarget(nextActivity(block, current.activity), taken) };
          }),
        Math.max(0, deadlines.current.get(current)! - Date.now()),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [plans]);
  const coworkers = React.useMemo(
    () => (showDemo ? demoCoworkers.map(person => ({ person, target: plans[person.id] ?? null })) : []),
    [plans, showDemo],
  );
  // Work: time spent at a work spot moves their current task forward; finishing posts to the feed.
  const plansRef = useRef(plans);
  plansRef.current = plans;
  const [work, setWork] = useState<Record<string, WorkState>>(() =>
    Object.fromEntries(
      demoCoworkers.map(p => [
        p.id,
        { task: Math.floor(Math.random() * p.tasks.length), progress: 0.3 + Math.random() * 0.4 },
      ]),
    ),
  );
  const workRef = useRef(work);
  const [shipped, setShipped] = useState<Record<string, string>>({});
  const feedId = useRef(0);
  const [feed, setFeed] = useState<FeedItem[]>(() =>
    demoCoworkers.flatMap(person => {
      const target = plans[person.id],
        task = currentTask(person, work[person.id]);
      return target
        ? [
            {
              id: ++feedId.current,
              at: new Date(),
              personId: person.id,
              who: person.name,
              icon: target.activity.work ? task.icon : target.activity.icon,
              text: target.activity.work
                ? `is working on ${task.title}`
                : `is ${target.activity.activity.toLowerCase()}`,
            },
          ]
        : [];
    }),
  );
  const post = (person: DemoCoworker, icon: string, text: string) =>
    setFeed(items =>
      [{ id: ++feedId.current, at: new Date(), personId: person.id, who: person.name, icon, text }, ...items].slice(
        0,
        40,
      ),
    );
  useEffect(() => {
    if (!showDemo) return;
    const clock = window.setInterval(() => {
      const next = { ...workRef.current };
      let changed = false;
      for (const person of demoCoworkers) {
        const target = plansRef.current[person.id],
          at = peopleView[person.id];
        if (!target?.activity.work || !at?.present || Math.hypot(at.x - target.point[0], at.z - target.point[1]) > 0.3)
          continue;
        const result = advanceWork(person, next[person.id], 1);
        next[person.id] = result.state;
        changed = true;
        if (result.finished) {
          const title = result.finished.title,
            upcoming = currentTask(person, result.state);
          post(person, '✅', `shipped ${title}`);
          post(person, upcoming.icon, `started ${upcoming.title}`);
          setShipped(all => ({ ...all, [person.id]: title }));
          window.setTimeout(
            () =>
              setShipped(all => {
                const rest = { ...all };
                delete rest[person.id];
                return rest;
              }),
            4000,
          );
        }
      }
      if (changed) {
        workRef.current = next;
        setWork(next);
      }
    }, 1000);
    return () => clearInterval(clock);
  }, [showDemo]);
  const previousPlans = useRef(plans);
  useEffect(() => {
    const before = previousPlans.current;
    previousPlans.current = plans;
    if (before === plans || !showDemo) return;
    for (const person of demoCoworkers) {
      const a = before[person.id],
        b = plans[person.id];
      if (a === b) continue;
      if (!a && b) post(person, '🚤', 'arrived on the island');
      else if (a && !b) post(person, '🌙', 'headed home for the day');
      else if (b?.activity.place === 'Pavilion M' && a?.activity.place !== 'Pavilion M')
        post(person, '💬', `joined the ${b.activity.activity.toLowerCase()}`);
      else if (b?.activity.icon === '☕') post(person, '☕', 'took a coffee break');
      else if (b?.activity.work && !a?.activity.work) {
        const task = currentTask(person, workRef.current[person.id]);
        post(person, task.icon, `is back on ${task.title}`);
      }
    }
  }, [plans]);
  const occupied = new Map(
    coworkers.flatMap(c => (c.target?.seatId ? [[c.target.seatId, c.person.name] as const] : [])),
  );
  const pickSeat = (id: string) => {
    const owner = occupied.get(id);
    if (owner) notify(`${owner} is sitting there. Try another seat.`);
    else setSeat(id);
  };
  const [greeting, setGreeting] = useState<{ id: string; text: string } | null>(null);
  useEffect(() => {
    if (greeting) {
      const t = setTimeout(() => setGreeting(null), 4500);
      return () => clearTimeout(t);
    }
  }, [greeting]);
  const nearby = coworkers.find(c => {
    const p = peopleView[c.person.id];
    return !!c.target && !!p?.present && Math.hypot(p.x - position[0], p.z - position[1]) < 2.5;
  });
  const greet = ({ person, target }: (typeof coworkers)[number]) =>
    setGreeting({
      id: person.id,
      text:
        target?.activity.status === 'Focused'
          ? person.focusReply
          : person.greetings[Math.floor(Math.random() * person.greetings.length)],
    });
  const findPerson = (id: string) => {
    const p = peopleView[id];
    if (p?.present) {
      cameraView.look = [p.x, p.z];
      onLook();
    }
  };
  const say = (personId: string, text: string) => setGreeting({ id: personId, text });
  return { coworkers, work, shipped, feed, greeting, greet, say, nearby, pickSeat, findPerson };
}
