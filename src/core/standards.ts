/**
 * Engineering standards document — Milestone 9A.
 *
 * A shareable set of org standards (design factors, allowable limits,
 * verification policy, load-combination templates) that a team keeps consistent
 * by versioning the exported JSON in a shared Git repo — "latest draft" = latest
 * pull. Pure data (no React, Rule 7). SI internally (Rule 8). No building-code
 * combination is ever assumed: a template records a `standard` only when the
 * user explicitly cites one.
 *
 * The shipped default is a STARTER TEMPLATE — clearly marked, not authoritative;
 * an organization must review, edit, and approve it (set `starterTemplate`
 * false) before it governs design.
 */
import type { Dimension } from './dimensions';
import type { LoadCaseKind } from './model';
import type { VerificationState } from './provenance';

export const STANDARDS_SCHEMA_VERSION = 1;

/** A safety/design factor applied to a demand for a class of component. */
export interface DesignFactorEntry {
  key: string;
  label: string;
  /** Dimensionless factor (rating ≥ demand × value). */
  value: number;
  notes?: string;
}

/** An allowable limit (a max or min) an analysis result is checked against. */
export interface AllowableLimitEntry {
  key: string;
  label: string;
  /** SI value; display converts at the units boundary. */
  valueSI: number;
  dimension: Dimension;
  kind: 'max' | 'min';
  notes?: string;
}

export interface CombinationTerm {
  loadCaseKind: LoadCaseKind;
  factor: number;
}

/** A named load-combination policy (a template applied per project). */
export interface CombinationTemplate {
  name: string;
  terms: CombinationTerm[];
  /** Only set when the user explicitly cites a standard + revision. */
  standard?: { name: string; revision: string };
  notes?: string;
}

export interface VerificationPolicy {
  /** When true, only verified data may support a design decision. */
  requireVerifiedForDesign: boolean;
  /** The least state that counts as design-acceptable. */
  minimumStateForDesign: VerificationState;
  /** Property keys that always require manufacturer verification. */
  criticalPropertyKeys: string[];
}

export interface Standards {
  schemaVersion: number;
  name: string;
  /** Human revision label (Git history is the authoritative version trail). */
  revision: string;
  organization?: string;
  updatedOn: string;
  notes?: string;
  /** True for the shipped starter template; an org sets false once approved. */
  starterTemplate: boolean;
  designFactors: DesignFactorEntry[];
  allowableLimits: AllowableLimitEntry[];
  verificationPolicy: VerificationPolicy;
  loadCombinationTemplates: CombinationTemplate[];
}

/**
 * The shipped starter standards. Values are common industry starting points,
 * NOT an approved specification — every one must be reviewed and set by the
 * organization before it governs design.
 */
export function createDefaultStandards(updatedOn = '2026-07-24T00:00:00.000Z'): Standards {
  return {
    schemaVersion: STANDARDS_SCHEMA_VERSION,
    name: 'TALON starter standards (REVIEW REQUIRED)',
    revision: '0',
    updatedOn,
    starterTemplate: true,
    notes:
      'Starter template — illustrative values only. Review, edit, and approve ' +
      'against your organization’s engineering standards before use, then set ' +
      'starterTemplate = false and share the file via your Git repo.',
    designFactors: [
      { key: 'cable', label: 'Cable / rope (breaking strength)', value: 5, notes: 'Common 5:1 starting point; confirm per application.' },
      { key: 'rigging', label: 'Rigging hardware (WLL)', value: 5 },
      { key: 'structural', label: 'Structural steel (yield)', value: 1.67 },
      { key: 'anchor', label: 'Ground anchor / ballast', value: 2 },
    ],
    allowableLimits: [
      { key: 'minGroundClearance', label: 'Minimum ground clearance', valueSI: 0.5, dimension: 'length', kind: 'min' },
      { key: 'maxSagSpanRatio', label: 'Maximum sag / span ratio', valueSI: 0.08, dimension: 'dimensionless', kind: 'max' },
      { key: 'maxDecelerationG', label: 'Maximum deceleration (g)', valueSI: 3, dimension: 'dimensionless', kind: 'max' },
      { key: 'maxTrolleySpeed', label: 'Maximum trolley speed', valueSI: 15, dimension: 'velocity', kind: 'max' },
    ],
    verificationPolicy: {
      requireVerifiedForDesign: true,
      minimumStateForDesign: 'userVerified',
      criticalPropertyKeys: [
        'minimumBreakingStrength',
        'workingLoadLimit',
        'ratedCapacity',
        'proofLoad',
        'forceCapacity',
      ],
    },
    loadCombinationTemplates: [
      {
        name: 'Service (unfactored)',
        terms: [
          { loadCaseKind: 'dead', factor: 1 },
          { loadCaseKind: 'pretension', factor: 1 },
          { loadCaseKind: 'normalOperation', factor: 1 },
        ],
        notes: 'Unfactored service combination. No building-code factor is applied unless a standard is cited.',
      },
    ],
  };
}

// ── pure immutable edits ─────────────────────────────────────────────────────

export function updateStandardsMeta(
  s: Standards,
  patch: Partial<Pick<Standards, 'name' | 'revision' | 'organization' | 'notes' | 'starterTemplate'>>,
): Standards {
  return { ...s, ...patch };
}

export function setDesignFactor(s: Standards, entry: DesignFactorEntry): Standards {
  const exists = s.designFactors.some((d) => d.key === entry.key);
  const designFactors = exists
    ? s.designFactors.map((d) => (d.key === entry.key ? entry : d))
    : [...s.designFactors, entry];
  return { ...s, designFactors };
}

export function removeDesignFactor(s: Standards, key: string): Standards {
  return { ...s, designFactors: s.designFactors.filter((d) => d.key !== key) };
}

export function setAllowableLimit(s: Standards, entry: AllowableLimitEntry): Standards {
  const exists = s.allowableLimits.some((l) => l.key === entry.key);
  const allowableLimits = exists
    ? s.allowableLimits.map((l) => (l.key === entry.key ? entry : l))
    : [...s.allowableLimits, entry];
  return { ...s, allowableLimits };
}

export function removeAllowableLimit(s: Standards, key: string): Standards {
  return { ...s, allowableLimits: s.allowableLimits.filter((l) => l.key !== key) };
}

export function setVerificationPolicy(s: Standards, policy: VerificationPolicy): Standards {
  return { ...s, verificationPolicy: { ...policy } };
}

export function removeCombinationTemplate(s: Standards, name: string): Standards {
  return { ...s, loadCombinationTemplates: s.loadCombinationTemplates.filter((c) => c.name !== name) };
}

// ── validation ───────────────────────────────────────────────────────────────

export interface StandardsIssue {
  severity: 'error' | 'warning';
  message: string;
}

/** Structural + sanity checks; warns (does not silently fix) on odd values. */
export function checkStandards(s: Standards): StandardsIssue[] {
  const issues: StandardsIssue[] = [];
  const err = (message: string) => issues.push({ severity: 'error', message });
  const warn = (message: string) => issues.push({ severity: 'warning', message });

  if (!s.name.trim()) err('Standards must have a name.');
  for (const d of s.designFactors) {
    if (!(d.value >= 1)) warn(`Design factor "${d.label}" = ${d.value} is below 1; confirm this is intended.`);
  }
  for (const l of s.allowableLimits) {
    if (!Number.isFinite(l.valueSI)) err(`Allowable limit "${l.label}" has a non-finite value.`);
  }
  for (const c of s.loadCombinationTemplates) {
    if (c.terms.length === 0) warn(`Combination template "${c.name}" has no terms.`);
  }
  if (s.starterTemplate) {
    warn('These are STARTER-TEMPLATE standards and are not authoritative until reviewed and approved.');
  }
  return issues;
}
