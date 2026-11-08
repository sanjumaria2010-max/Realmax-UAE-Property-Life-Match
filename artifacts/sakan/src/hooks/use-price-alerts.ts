import { useSyncExternalStore } from 'react';
import type { MonitorMetric } from '../monitor-data';
import { alertKey, validatePriceAlert, type PriceAlertRule } from '../price-alerts-data';

export const PRICE_ALERTS_STORAGE_KEY = 'realmax.price-alerts.v1';
type State = { rules: Record<string, PriceAlertRule>; error: string };
let state: State = { rules: {}, error: '' };
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(PRICE_ALERTS_STORAGE_KEY);
    if (raw === null) { state = { rules: {}, error: '' }; return; }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid alert data');
    const rules: Record<string, PriceAlertRule> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const rule = value as PriceAlertRule | null;
      if (!rule || typeof rule.propertyId !== 'string' || !['sale', 'rent'].includes(rule.metric)
        || rule.enabled !== true || ![rule.min, rule.max].every((v) => v === null || typeof v === 'number')
        || validatePriceAlert(rule.min, rule.max) || key !== alertKey(rule.propertyId, rule.metric)) throw new Error('Invalid alert rule');
      rules[key] = rule;
    }
    state = { rules, error: '' };
  } catch {
    state = { rules: {}, error: 'Saved alerts could not be read. Local storage may be blocked or the data may be damaged. Saving a new alert will replace unreadable data.' };
  }
}
function write(rules: Record<string, PriceAlertRule>): string | null {
  try {
    if (Object.keys(rules).length) window.localStorage.setItem(PRICE_ALERTS_STORAGE_KEY, JSON.stringify(rules));
    else window.localStorage.removeItem(PRICE_ALERTS_STORAGE_KEY);
    state = { rules, error: '' };
    emit();
    return null;
  } catch {
    // Keep the previously saved rules; never claim that a failed write succeeded.
    const error = 'Could not save alerts in this browser. Your previous alert settings are unchanged.';
    state = { ...state, error };
    emit();
    return error;
  }
}
export const priceAlertsStore = {
  get() { load(); return state; },
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === PRICE_ALERTS_STORAGE_KEY || event.key === null) { loaded = false; load(); emit(); }
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
    load();
    const rules = { ...state.rules };
    delete rules[alertKey(propertyId, metric)];
    return write(rules);
  },
  clear() { load(); return write({}); },
};
export function usePriceAlerts() {
  const snapshot = useSyncExternalStore(priceAlertsStore.subscribe, priceAlertsStore.get, priceAlertsStore.get);
  return { ...snapshot, save: priceAlertsStore.save, remove: priceAlertsStore.remove };
}
