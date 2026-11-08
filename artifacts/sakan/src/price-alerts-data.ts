import type { MonitorMetric } from './monitor-data';

export type PriceAlertRule = {
  propertyId: string;
  metric: MonitorMetric;
  min: number | null;
  max: number | null;
  enabled: true;
};
export const alertKey = (propertyId: string, metric: MonitorMetric) => `${propertyId}:${metric}`;

export function validatePriceAlert(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return 'Enter at least one threshold.';
  if ([min, max].some((value) => value !== null && (!Number.isFinite(value) || value <= 0))) return 'Thresholds must be positive numbers.';
  if (min !== null && max !== null && min >= max) return 'Minimum must be lower than maximum.';
  return null;
}

export function evaluatePriceAlert(rule: PriceAlertRule | undefined, current: number): { state: 'unset' | 'within' | 'below' | 'above'; message: string } {
  if (!rule) return { state: 'unset', message: 'No alert set for this property and metric.' };
  if (!Number.isFinite(current) || current <= 0) return { state: 'unset', message: 'Enter a positive sample price to check this alert.' };
  if (rule.min !== null && current <= rule.min) return { state: 'below', message: 'Price alert: sample price is at or below your minimum.' };
  if (rule.max !== null && current >= rule.max) return { state: 'above', message: 'Price alert: sample price is at or above your maximum.' };
  return { state: 'within', message: 'Sample price is within your thresholds. No alert triggered.' };
}
