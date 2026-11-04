import { useSyncExternalStore } from 'react';

/** Browser-local monitored property IDs. Stored only in this browser, never in the server workspace. */
export const MONITOR_STORAGE_KEY = 'realmax.monitor.v1';
type MonitorState = { ids: string[]; error: string };

let state: MonitorState = { ids: [], error: '' };
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(MONITOR_STORAGE_KEY);
    if (raw === null) { state = { ids: [], error: '' }; return; }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
      state = { ids: [], error: 'Saved monitoring data in this browser was unreadable, so it was not used. It will be replaced the next time you change your monitored list.' };
      return;
    }
    state = { ids: [...new Set(parsed as string[])], error: '' };
  } catch (error) {
    state = { ids: [], error: error instanceof SyntaxError
      ? 'Saved monitoring data in this browser was malformed, so it was not used. It will be replaced the next time you change your monitored list.'
      : 'This browser blocked local storage, so monitored properties cannot be loaded or kept after reload.' };
  }
}

function write(ids: string[]) {
  try {
    if (ids.length) window.localStorage.setItem(MONITOR_STORAGE_KEY, JSON.stringify(ids));
    else window.localStorage.removeItem(MONITOR_STORAGE_KEY);
    state = { ids, error: '' };
  } catch {
    state = { ids, error: 'Could not save to this browser\'s local storage. Your change applies now but will be lost on reload.' };
  }
  emit();
}

export const monitorStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === MONITOR_STORAGE_KEY || event.key === null) { loaded = false; load(); emit(); }
    };
    window.addEventListener('storage', onStorage);
    return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
  },
  get() { load(); return state; },
  toggle(id: string) { load(); write(state.ids.includes(id) ? state.ids.filter((x) => x !== id) : [...state.ids, id]); },
  add(id: string) { load(); if (!state.ids.includes(id)) write([...state.ids, id]); },
  remove(id: string) { load(); write(state.ids.filter((x) => x !== id)); },
  clear() { load(); write([]); },
  dismissError() { state = { ...state, error: '' }; emit(); },
};

export function useMonitor() {
  const snapshot = useSyncExternalStore(monitorStore.subscribe, monitorStore.get, monitorStore.get);
  return {
    ids: snapshot.ids,
    error: snapshot.error,
    isMonitored: (id: string) => snapshot.ids.includes(id),
    toggle: monitorStore.toggle,
    add: monitorStore.add,
    remove: monitorStore.remove,
    clear: monitorStore.clear,
    dismissError: monitorStore.dismissError,
  };
}
