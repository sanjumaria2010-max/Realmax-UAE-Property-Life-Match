/**
 * Realmax Monitor — fictional sample price data.
 * Pure, deterministic functions: identical inputs always produce identical output.
 * Nothing here is market data, a valuation, or a prediction.
 */
export type MonitorMetric = 'sale' | 'rent';
export type ScenarioKey = 'downside' | 'base' | 'upside';
export type HistoryPoint = { month: string; label: string; value: number };
export type ScenarioAssumptions = Record<ScenarioKey, number>;
export type ScenarioPoint = { month: string; label: string; downside: number; base: number; upside: number };
export type ScenarioEndpoint = { key: ScenarioKey; annualRate: number; value: number; change: number; changePct: number };

export const HISTORY_MONTHS = 36;
/** Fixed fictional "as of" month so every figure stays stable regardless of today's date. */
export const SAMPLE_AS_OF = { year: 2026, month: 11 } as const; // Fixed fictional November 2026 snapshot
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function seededRandom(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Month offset from the sample as-of month (0 = as-of, -1 = previous, +1 = next). */
export function monthAt(offset: number) {
  const index = SAMPLE_AS_OF.year * 12 + (SAMPLE_AS_OF.month - 1) + offset;
  const year = Math.floor(index / 12);
  const m = index - year * 12;
  return { month: `${year}-${String(m + 1).padStart(2, '0')}`, label: `${MONTHS[m]} ${year}` };
}

/** Fictional annual drift used to shape the sample history (percent). */
export function sampleDrift(id: string, metric: MonitorMetric): number {
  const r = seededRandom(hashString(`${id}:${metric}:drift`))();
  return Math.round((metric === 'sale' ? 1.2 + r * 5.6 : 0.8 + r * 4.4) * 10) / 10;
}

/** 36 months of fictional monthly values ending exactly at `current`. */
export function buildHistory(id: string, metric: MonitorMetric, current: number, months = HISTORY_MONTHS): HistoryPoint[] {
  const safe = Number.isFinite(current) && current > 0 ? current : 0;
  const rand = seededRandom(hashString(`${id}:${metric}:history`));
  const monthlyDrift = sampleDrift(id, metric) / 100 / 12;
  const swing = metric === 'sale' ? 0.011 : 0.007;
  const values = new Array<number>(months);
  values[months - 1] = safe;
  for (let i = months - 1; i > 0; i -= 1) {
    const r = monthlyDrift + (rand() * 2 - 1) * swing;
    values[i - 1] = values[i] / (1 + r);
  }
  return values.map((value, i) => ({ ...monthAt(i - (months - 1)), value: i === months - 1 ? safe : Math.round(value) }));
}

/** Annual scenario assumptions (percent per year), fictional and stable per property. */
export function scenarioAssumptions(id: string, metric: MonitorMetric): ScenarioAssumptions {
  const base = sampleDrift(id, metric);
  const round = (n: number) => Math.round(n * 10) / 10;
  return metric === 'sale'
    ? { downside: round(base - 6), base, upside: round(base + 3.5) }
    : { downside: round(base - 4.5), base, upside: round(base + 2.5) };
}

/** Compound from the current value: value * (1 + annual)^(m / 12). */
export function compound(current: number, annualPct: number, monthsAhead: number): number {
  return Math.round(current * Math.pow(1 + annualPct / 100, monthsAhead / 12));
}

export function buildScenarios(current: number, assumptions: ScenarioAssumptions, horizonYears: number): ScenarioPoint[] {
  const total = Math.max(1, Math.min(3, Math.round(horizonYears))) * 12;
  return Array.from({ length: total + 1 }, (_, m) => ({
    ...monthAt(m),
    downside: compound(current, assumptions.downside, m),
    base: compound(current, assumptions.base, m),
    upside: compound(current, assumptions.upside, m),
  }));
}

export function scenarioEndpoints(current: number, assumptions: ScenarioAssumptions, horizonYears: number): ScenarioEndpoint[] {
  return (['downside', 'base', 'upside'] as ScenarioKey[]).map((key) => {
    const value = compound(current, assumptions[key], horizonYears * 12);
    return { key, annualRate: assumptions[key], value, change: value - current, changePct: current ? (value - current) / current * 100 : 0 };
  });
}

export function summarizeHistory(points: HistoryPoint[]) {
  if (points.length < 2) return { start: points[0]?.value ?? 0, end: points[0]?.value ?? 0, change: 0, changePct: 0, maxRise: null, maxFall: null, avgAbsPct: 0 };
  const start = points[0].value;
  const end = points[points.length - 1].value;
  const moves = points.slice(1).map((p, i) => ({ label: p.label, change: p.value - points[i].value, pct: (p.value - points[i].value) / points[i].value * 100 }));
  const maxRise = moves.reduce((a, b) => (b.pct > a.pct ? b : a));
  const maxFall = moves.reduce((a, b) => (b.pct < a.pct ? b : a));
  return {
    start, end, change: end - start, changePct: start ? (end - start) / start * 100 : 0,
    maxRise, maxFall,
    avgAbsPct: moves.reduce((s, m) => s + Math.abs(m.pct), 0) / moves.length,
  };
}
