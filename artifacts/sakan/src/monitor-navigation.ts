import type { Goal } from './sakan-data';

export const canMonitorGoal = (goal: Goal) => goal === 'live' || goal === 'invest';
export const isMonitorHash = (hash: string) => hash === '#monitor' || hash.startsWith('#monitor/');
export const monitorHash = (id: string | null) => id ? `#monitor/${encodeURIComponent(id)}` : '#monitor';
export function monitorPropertyFromHash(hash: string): string | null {
  if (!hash.startsWith('#monitor/')) return null;
  try { return decodeURIComponent(hash.slice('#monitor/'.length)) || null; }
  catch { return null; }
}
