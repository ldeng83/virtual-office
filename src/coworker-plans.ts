import { resolveTarget, type DemoCoworker, type Target } from './people.ts';
import type { Period } from './daylight.ts';

// Keeps the plans in step with who is on the island: everyone already here carries on with what
// they're doing, a newcomer starts at their home spot, and anyone who left is dropped.
// `taken` holds seats in use by somebody other than a coworker (you).
export function reconcilePlans(
  plans: Record<string, Target | null>,
  people: DemoCoworker[],
  period: Period,
  taken: ReadonlySet<string>,
): Record<string, Target | null> {
  const ids = new Set(people.map(p => p.id)),
    left = Object.keys(plans).some(id => !ids.has(id)),
    arrived = people.filter(p => !(p.id in plans));
  if (!left && !arrived.length) return plans;
  const next: Record<string, Target | null> = {},
    used = new Set(taken);
  for (const person of people)
    if (person.id in plans) {
      next[person.id] = plans[person.id];
      const seat = plans[person.id]?.seatId;
      if (seat) used.add(seat);
    }
  for (const person of arrived) {
    const target = resolveTarget(person.schedule[period]?.home ?? null, used);
    if (target?.seatId) used.add(target.seatId);
    next[person.id] = target;
  }
  return next;
}
