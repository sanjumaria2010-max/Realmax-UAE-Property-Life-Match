import type { Goal } from './sakan-data';
import type { MonitorScope } from './hooks/use-monitor';

export const canMonitorGoal = (goal: Goal) => goal === 'live' || goal === 'invest';
export const isMonitorHash = (hash: string) => hash === '#monitor' || hash.startsWith('#monitor/');
export const monitorHash = (id: string | null, scope?: MonitorScope) =>
  `#monitor${scope ? `/${scope}` : ''}${id ? `/${encodeURIComponent(id)}` : ''}`;
export function monitorScopeFromHash(hash: string): MonitorScope | null {
  const scope = hash.split('/')[1];
  return scope === 'live' || scope === 'invest' ? scope : null;
}
export function monitorPropertyFromHash(hash: string): string | null {
  if (!hash.startsWith('#monitor/')) return null;
  const parts = hash.slice('#monitor/'.length).split('/');
  if (parts[0] === 'live' || parts[0] === 'invest') parts.shift();
  try { return decodeURIComponent(parts.join('/')) || null; }
  catch { return null; }
}
