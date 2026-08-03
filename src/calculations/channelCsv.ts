/**
 * Measured-channel CSV import — Milestone 8D.
 *
 * Parses a time-series CSV into `MeasuredChannel`s for the digital-twin
 * correlation. NEW and additive: the correlation engine
 * (`testCorrelation.ts`) is not modified.
 *
 * Governance: the RAW samples and the original file text are preserved exactly
 * as imported and are never mutated by later conditioning (Rule 5 / M16
 * preserve-raw). A malformed file is REJECTED with an explicit reason rather
 * than partially accepted, and a blank cell is a parse error — never silently
 * read as 0 (Rules 3/4).
 *
 * Expected shape: a header row, first column = time in seconds, each remaining
 * column = one channel. Header names become channel names; a trailing unit in
 * brackets or parentheses is captured, e.g. `cable_tension [N]`.
 */
import type { MeasuredChannel } from './testCorrelation';

export type ChannelCsvResult =
  | { ok: true; channels: MeasuredChannel[]; rowCount: number; warnings: string[]; rawText: string }
  | { ok: false; errors: string[] };

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',' || ch === '\t') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** Splits `name [unit]` / `name (unit)` into its parts. */
function parseHeader(header: string): { name: string; unit?: string } {
  const m = /^(.*?)[\s]*[[(]([^\])]+)[\])]\s*$/.exec(header);
  if (m) return { name: m[1].trim() || header, unit: m[2].trim() };
  return { name: header };
}

export function importChannelCsv(text: string): ChannelCsvResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 3) {
    return { ok: false, errors: ['CSV needs a header row and at least two data rows.'] };
  }

  const header = splitLine(lines[0]);
  if (header.length < 2) {
    return { ok: false, errors: ['CSV needs at least two columns: time and one channel.'] };
  }
  // A numeric first cell means there is no header row — we require one so
  // channels can be named rather than guessed.
  if (Number.isFinite(Number(header[0])) && header[0] !== '') {
    return {
      ok: false,
      errors: ['CSV must start with a header row naming the time column and each channel.'],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const timeS: number[] = [];
  const columns: number[][] = header.slice(1).map(() => []);

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    if (cells.length !== header.length) {
      errors.push(`Row ${i + 1}: expected ${header.length} columns, found ${cells.length}.`);
      continue;
    }
    // A blank or non-numeric cell is an error — never read as zero.
    const t = Number(cells[0]);
    if (cells[0] === '' || !Number.isFinite(t)) {
      errors.push(`Row ${i + 1}: time "${cells[0]}" is blank or not a number.`);
      continue;
    }
    timeS.push(t);
    for (let c = 1; c < header.length; c++) {
      const v = Number(cells[c]);
      if (cells[c] === '' || !Number.isFinite(v)) {
        errors.push(`Row ${i + 1}, column "${header[c]}": "${cells[c]}" is blank or not a number.`);
        continue;
      }
      columns[c - 1].push(v);
    }
    if (errors.length > 20) {
      errors.push('… further errors suppressed.');
      break;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  if (timeS.length < 2) return { ok: false, errors: ['Fewer than two valid data rows.'] };

  // Time must be monotonic for interpolation to be meaningful.
  for (let i = 1; i < timeS.length; i++) {
    if (timeS[i] <= timeS[i - 1]) {
      return {
        ok: false,
        errors: [`Time must strictly increase (row ${i + 2}: ${timeS[i]} ≤ ${timeS[i - 1]}).`],
      };
    }
  }

  const dt = (timeS[timeS.length - 1] - timeS[0]) / (timeS.length - 1);
  if (dt > 0) {
    const rate = 1 / dt;
    if (rate < 5) {
      warnings.push(
        `Average sample rate is ${rate.toFixed(2)} Hz — sparse data may hide peaks and bias timing error.`,
      );
    }
  }

  const channels: MeasuredChannel[] = header.slice(1).map((h, i) => {
    const { name, unit } = parseHeader(h);
    return {
      name: name || `channel_${i + 1}`,
      timeS: [...timeS],
      raw: columns[i], // preserved exactly as imported; conditioning never mutates it
      unit,
      sampleRateHz: dt > 0 ? 1 / dt : undefined,
    };
  });

  return { ok: true, channels, rowCount: timeS.length, warnings, rawText: text };
}

/**
 * Builds a clearly-labelled SYNTHETIC channel so the correlation workflow can be
 * exercised before real test data exists. This is NOT measured data: callers
 * must label it example-only and must never present a correlation against it as
 * validation of a design (Rule 4).
 *
 * Shape: a decaying oscillation — representative of a braking/sway transient —
 * with a deterministic pseudo-random perturbation so it is reproducible.
 */
export function buildSyntheticChannel(options: {
  name?: string;
  unit?: string;
  durationS?: number;
  sampleRateHz?: number;
  amplitude?: number;
  decayRate?: number;
  frequencyHz?: number;
  noiseFraction?: number;
  /** Deterministic seed (Rule 9 — reproducible). */
  seed?: number;
} = {}): MeasuredChannel {
  const duration = options.durationS ?? 10;
  const rate = options.sampleRateHz ?? 50;
  const amp = options.amplitude ?? 1;
  const decay = options.decayRate ?? 0.35;
  const freq = options.frequencyHz ?? 0.5;
  const noise = options.noiseFraction ?? 0.03;
  let seed = options.seed ?? 12345;
  // Deterministic LCG — no Math.random, so the demo is reproducible.
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296 - 0.5;
  };

  const n = Math.max(2, Math.round(duration * rate));
  const timeS: number[] = [];
  const raw: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const clean = amp * Math.exp(-decay * t) * Math.cos(2 * Math.PI * freq * t);
    timeS.push(Number(t.toFixed(6)));
    raw.push(clean + noise * amp * rand());
  }
  return {
    name: options.name ?? 'SYNTHETIC (example only)',
    timeS,
    raw,
    unit: options.unit,
    sampleRateHz: rate,
  };
}

/** The model the synthetic channel was generated from, for parameter estimation. */
export function syntheticModel(params: {
  amplitude: number;
  decayRate: number;
  frequencyHz: number;
}, timeS: number[]): { timeS: number[]; values: number[] } {
  return {
    timeS,
    values: timeS.map(
      (t) => params.amplitude * Math.exp(-params.decayRate * t) * Math.cos(2 * Math.PI * params.frequencyHz * t),
    ),
  };
}
