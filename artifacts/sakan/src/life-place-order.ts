import type { Destination } from './sakan-data';

export const LIFE_ROLES = ['Work', 'School', 'Partner work', 'Worship', 'Sport'] as const;
export type LifePlaceEntry = { key: string; kind: string; id?: string };
export const LIFE_ORDER_KEY = 'realmax.life-order.v1';

/** Empty role cards are layout only: never create a destination until a place is saved. */
export function reconcileLifeOrder(previous: LifePlaceEntry[], destinations: Destination[]): LifePlaceEntry[] {
  const kinds = [...new Set<string>([...LIFE_ROLES, ...destinations.map((d) => d.kind)])];
  const available = kinds.flatMap((kind): LifePlaceEntry[] => {
    const saved = destinations.filter((d) => d.kind === kind);
    return saved.length ? saved.map((d) => ({ key: `saved:${d.id}`, kind, id: d.id }))
      : [{ key: `slot:${kind}`, kind }];
  });
  const remaining = new Map(available.map((entry) => [entry.key, entry]));
  const result: LifePlaceEntry[] = [];
  for (const old of previous) {
    const entry = remaining.get(old.key) ?? [...remaining.values()].find((item) =>
      item.kind === old.kind && (!old.id || !item.id));
    if (entry) { result.push(entry); remaining.delete(entry.key); }
  }
  for (const entry of remaining.values()) {
    const same = result.map((item) => item.kind).lastIndexOf(entry.kind);
    if (same >= 0) result.splice(same + 1, 0, entry);
    else result.push(entry);
  }
  return result;
}

export function moveLifeEntry(entries: LifePlaceEntry[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= entries.length || to >= entries.length || from === to) return entries;
  const next = [...entries];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/** Only accept exact permutations, so stale reorder events cannot drop or duplicate places. */
export function reorderDestinations(destinations: Destination[], ids: string[]): Destination[] | null {
  if (ids.length !== destinations.length || new Set(ids).size !== ids.length) return null;
  const byId = new Map(destinations.map((d) => [d.id, d]));
  if (ids.some((id) => !byId.has(id))) return null;
  return ids.map((id) => byId.get(id)!);
}
