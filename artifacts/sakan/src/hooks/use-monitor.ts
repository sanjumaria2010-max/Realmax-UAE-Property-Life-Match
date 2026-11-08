import { useSyncExternalStore } from 'react';
import type { MonitorMetric } from '../monitor-data';

export type MonitorScope = 'live' | 'invest';
export const MONITOR_STORAGE_KEY = 'realmax.monitor.v1';
export const monitorStorageKey = (scope: MonitorScope) => `realmax.monitor.v2.${scope}`;
export type MonitorView = {
  propertyId: string | null; metric: MonitorMetric; range: 2 | 3; horizon: 1 | 2 | 3;
  showForecast: boolean; showTable: boolean;
};
export const defaultMonitorView = (): MonitorView => ({
  propertyId: null, metric: 'sale', range: 3, horizon: 2, showForecast: false, showTable: false,
});
type MonitorState = { ids: string[]; view: MonitorView; error: string };
const stores = new Map<MonitorScope, ReturnType<typeof createMonitorStore>>();

function createMonitorStore(scope: MonitorScope) {
  const key = monitorStorageKey(scope);
  let state: MonitorState = { ids: [], view: defaultMonitorView(), error: '' };
  let loaded = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  function load() {
    if (loaded) return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(key);
      const legacy = raw === null ? window.localStorage.getItem(MONITOR_STORAGE_KEY) : null;
      if (raw === null && legacy === null) { state = { ids: [], view: defaultMonitorView(), error: '' }; return; }
      const parsed = JSON.parse(raw ?? legacy!);
      const ids: unknown = raw === null ? parsed : parsed?.ids;
      const view = raw === null ? defaultMonitorView() : parsed?.view;
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')
        || !view || !(view.propertyId === null || typeof view.propertyId === 'string')
        || !['sale', 'rent'].includes(view.metric) || ![2, 3].includes(view.range)
        || ![1, 2, 3].includes(view.horizon) || typeof view.showForecast !== 'boolean' || typeof view.showTable !== 'boolean') {
        state = { ids: [], view: defaultMonitorView(), error: 'Saved monitoring data was unreadable, so it was not used. Your other journey has not been changed.' };
        return;
      }
      state = { ids: [...new Set(ids as string[])], view: { ...view }, error: '' };
      // Retain legacy data as a backup. Each journey independently gets its own initial copy.
      if (raw === null) {
        try { window.localStorage.setItem(key, JSON.stringify({ ids: state.ids, view: state.view })); }
        catch { state = { ...state, error: 'Previous monitored properties were loaded, but this browser could not save their separate journey copy.' }; }
      }
    } catch (error) {
      state = { ids: [], view: defaultMonitorView(), error: error instanceof SyntaxError
        ? 'Saved monitoring data was malformed, so it was not used.'
        : 'This browser blocked local storage, so monitored properties cannot be loaded or kept after reload.' };
    }
  }
  function write(ids: string[], view = state.view) {
    try {
      // Persist empty lists too, so removing everything cannot resurrect the legacy list.
      window.localStorage.setItem(key, JSON.stringify({ ids, view }));
      state = { ids, view, error: '' };
    } catch {
      state = { ids, view, error: 'Could not save to this browser\'s local storage. Your change applies now but will be lost on reload.' };
    }
    emit();
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) { loaded = false; load(); emit(); }
      };
      window.addEventListener('storage', onStorage);
      return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
    },
    get() { load(); return state; },
    toggle(id: string) { load(); write(state.ids.includes(id) ? state.ids.filter((x) => x !== id) : [...state.ids, id]); },
    add(id: string) { load(); if (!state.ids.includes(id)) write([...state.ids, id]); },
    remove(id: string) { load(); write(state.ids.filter((x) => x !== id)); },
    setView(patch: Partial<MonitorView>) { load(); write(state.ids, { ...state.view, ...patch }); },
    clear() { load(); write([], defaultMonitorView()); },
    dismissError() { state = { ...state, error: '' }; emit(); },
    invalidate() { loaded = false; load(); emit(); },
  };
}
export function getMonitorStore(scope: MonitorScope) {
  if (!stores.has(scope)) stores.set(scope, createMonitorStore(scope));
  return stores.get(scope)!;
}
export const monitorStore = getMonitorStore('live');
export function clearAllMonitors(): string | null {
  let error: string | null = null;
  try { window.localStorage.removeItem(MONITOR_STORAGE_KEY); }
  catch { error = 'The previous shared monitoring backup could not be removed from this browser.'; }
  for (const scope of ['live', 'invest'] as const) {
    getMonitorStore(scope).clear();
    if (getMonitorStore(scope).get().error) error = getMonitorStore(scope).get().error;
  }
  return error;
}
export function useMonitor(scope: MonitorScope = 'live') {
  const store = getMonitorStore(scope);
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get);
  return { ...snapshot, isMonitored: (id: string) => snapshot.ids.includes(id),
    toggle: store.toggle, add: store.add, remove: store.remove, clear: store.clear,
    setView: store.setView, dismissError: store.dismissError };
}
