import { useSyncExternalStore } from 'react';
import type { MonitorMetric } from '../monitor-data';
import type { MonitorScope } from './use-monitor';
import { alertKey, validatePriceAlert, type PriceAlertRule } from '../price-alerts-data';

export const PRICE_ALERTS_STORAGE_KEY = 'realmax.price-alerts.v1';
export const priceAlertsStorageKey = (scope: MonitorScope) => `realmax.price-alerts.v2.${scope}`;
type State = { rules: Record<string, PriceAlertRule>; error: string };
const stores = new Map<MonitorScope, ReturnType<typeof createPriceAlertsStore>>();
function createPriceAlertsStore(scope: MonitorScope) {
  const key = priceAlertsStorageKey(scope);
  let state: State = { rules: {}, error: '' };
  let loaded = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  function load() {
    if (loaded) return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(key);
      const legacy = raw === null ? window.localStorage.getItem(PRICE_ALERTS_STORAGE_KEY) : null;
      if (raw === null && legacy === null) { state = { rules: {}, error: '' }; return; }
      const parsed: unknown = JSON.parse(raw ?? legacy!);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid alert data');
      const rules: Record<string, PriceAlertRule> = {};
      for (const [ruleKey, value] of Object.entries(parsed)) {
        const rule = value as PriceAlertRule | null;
        if (!rule || typeof rule.propertyId !== 'string' || !['sale', 'rent'].includes(rule.metric)
          || rule.enabled !== true || ![rule.min, rule.max].every((v) => v === null || typeof v === 'number')
          || validatePriceAlert(rule.min, rule.max) || ruleKey !== alertKey(rule.propertyId, rule.metric)) throw new Error('Invalid alert rule');
        rules[ruleKey] = rule;
      }
      state = { rules, error: '' };
      if (raw === null) {
        try { window.localStorage.setItem(key, JSON.stringify(rules)); }
        catch { state = { ...state, error: 'Previous alerts were loaded, but their separate journey copy could not be saved.' }; }
      }
    } catch {
      state = { rules: {}, error: 'Saved alerts could not be read. Local storage may be blocked or the data may be damaged. Saving a new alert will replace unreadable data in this journey only.' };
    }
  }
  function write(rules: Record<string, PriceAlertRule>): string | null {
    try {
      window.localStorage.setItem(key, JSON.stringify(rules));
      state = { rules, error: '' }; emit(); return null;
    } catch {
      const error = 'Could not save alerts in this browser. Your previous alert settings are unchanged.';
      state = { ...state, error }; emit(); return error;
    }
  }
  return {
    get() { load(); return state; },
    subscribe(listener: () => void) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) { loaded = false; load(); emit(); }
      };
      window.addEventListener('storage', onStorage);
      return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
    },
    save(propertyId: string, metric: MonitorMetric, min: number | null, max: number | null): string | null {
      load();
      const error = validatePriceAlert(min, max);
      if (error) return error;
      const rule: PriceAlertRule = { propertyId, metric, min, max, enabled: true };
      return write({ ...state.rules, [alertKey(propertyId, metric)]: rule });
    },
    remove(propertyId: string, metric: MonitorMetric) {
      load(); const rules = { ...state.rules }; delete rules[alertKey(propertyId, metric)]; return write(rules);
    },
    clear() { load(); return write({}); },
  };
}
export function getPriceAlertsStore(scope: MonitorScope) {
  if (!stores.has(scope)) stores.set(scope, createPriceAlertsStore(scope));
  return stores.get(scope)!;
}
export const priceAlertsStore = getPriceAlertsStore('live');
export function clearAllPriceAlerts(): string | null {
  let error: string | null = null;
  try { window.localStorage.removeItem(PRICE_ALERTS_STORAGE_KEY); }
  catch { error = 'The previous shared alert backup could not be removed from this browser.'; }
  for (const scope of ['live', 'invest'] as const) error = getPriceAlertsStore(scope).clear() || error;
  return error;
}
export function usePriceAlerts(scope: MonitorScope = 'live') {
  const store = getPriceAlertsStore(scope);
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get);
  return { ...snapshot, save: store.save, remove: store.remove };
}
