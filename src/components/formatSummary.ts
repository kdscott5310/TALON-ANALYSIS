/**
 * Display formatting for status-summary items (UI boundary only).
 */
import type { SummaryItem, CheckStatus } from '../calculations/statusSummary';
import { formatForce, formatLength, formatSpeed, type UnitSystem } from '../units/units';

export function formatItemValue(item: SummaryItem, unitSystem: UnitSystem): string {
  if (item.text) return item.text;
  if (item.valueSI === null) return '—';
  switch (item.kind) {
    case 'force':
      return formatForce(item.valueSI, unitSystem, 0);
    case 'length':
      return formatLength(item.valueSI, unitSystem, 1);
    case 'speed':
      return formatSpeed(item.valueSI, unitSystem, 1);
    case 'ratio':
      return `${(item.valueSI * 100).toFixed(1)}%`;
    case 'angle':
      return `${item.valueSI.toFixed(1)}°`;
    case 'g':
      return `${item.valueSI.toFixed(2)} g`;
    case 'sf':
      return item.valueSI === Infinity ? '∞' : item.valueSI.toFixed(2);
    case 'text':
      return item.text ?? '—';
  }
}

export const STATUS_LABEL: Record<CheckStatus, string> = {
  ok: 'OK',
  caution: 'Caution',
  failed: 'FAILED',
  insufficient: 'Insufficient info',
  error: 'Solver error',
};
