/**
 * CSV export — Milestone 4.
 *
 * Generates CSV text for summary results and dynamic time histories.
 * Values are exported in SI units with explicit unit headers; display
 * conversion is a UI concern. Checks that were not evaluated export
 * their status ('insufficient') and an empty value — never zero.
 */

import type { ScenarioSummary } from '../calculations/statusSummary';
import type { SimulationResult } from '../calculations/trolleyDynamics';

function esc(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function row(cells: (string | number | null)[]): string {
  return cells
    .map((c) => (c === null ? '' : typeof c === 'number' ? String(c) : esc(c)))
    .join(',');
}

const KIND_UNITS: Record<string, string> = {
  force: 'N',
  length: 'm',
  speed: 'm/s',
  ratio: 'fraction',
  angle: 'deg',
  g: 'g',
  sf: 'ratio',
  text: '',
};

export function summaryCsv(summary: ScenarioSummary): string {
  const lines: string[] = [];
  lines.push(row(['scenario', summary.scenarioName]));
  lines.push(row(['overall status', summary.overall]));
  if (summary.solverError) lines.push(row(['solver error', summary.solverError]));
  lines.push('');
  lines.push(row(['check', 'value (SI)', 'unit', 'status', 'detail', 'solver', 'inputs', 'assumptions']));
  for (const item of summary.items) {
    lines.push(
      row([
        item.label,
        item.valueSI,
        KIND_UNITS[item.kind] ?? '',
        item.status + (item.text ? ` (${item.text})` : ''),
        item.detail,
        item.solver,
        item.inputs,
        item.assumptions,
      ]),
    );
  }
  if (summary.criticalWarnings.length > 0) {
    lines.push('');
    lines.push(row(['critical warnings']));
    for (const w of summary.criticalWarnings) lines.push(row([w]));
  }
  lines.push('');
  lines.push(
    row([
      'DISCLAIMER',
      'Preliminary engineering estimates only. All results require validation by qualified engineers.',
    ]),
  );
  return lines.join('\n');
}

export function timeHistoryCsv(sim: SimulationResult): string {
  const h = sim.history;
  const lines: string[] = [];
  lines.push(row(['t (s)', 's_path (m)', 'x (m)', 'y_rel_node (m)', 'v (m/s)', 'a (m/s^2)', 'brake force (N)']));
  for (let i = 0; i < h.tS.length; i++) {
    lines.push(row([h.tS[i], h.sM[i], h.xM[i], h.yM[i], h.vMps[i], h.aMps2[i], h.brakeForceN[i]]));
  }
  return lines.join('\n');
}

/** Browser download helper (no server involved). */
export function downloadTextFile(filename: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
