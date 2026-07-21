/**
 * Scenario Serialization — Milestone 4
 *
 * Versioned JSON export/import with schema migration and strict
 * structural validation. Imported data is never trusted: every field
 * is type-checked, enums are whitelisted, unknown fields are dropped,
 * and missing Milestone-3 fields in v1 files are filled with clearly
 * labeled provisional defaults (each fill is reported as a migration
 * note — nothing is silently defaulted).
 */

import type {
  AnchorInputs,
  BrakeInputs,
  BrakeLaw,
  CableProperties,
  CraneInputs,
  DynamicsSettings,
  EnvironmentInputs,
  Scenario,
  SiteGeometry,
  TrolleyPayload,
} from './scenario';

export const CURRENT_SCHEMA_VERSION = 3;
export const SCENARIO_FILE_TYPE = 'talon-cufts-scenario';

/** Envelope written to exported .json files. */
export interface ScenarioFile {
  fileType: typeof SCENARIO_FILE_TYPE;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string; // ISO 8601
  scenario: Scenario;
}

export type ImportResult =
  | { ok: true; scenario: Scenario; migrationNotes: string[] }
  | { ok: false; errors: string[] };

// ═══════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════

export function exportScenarioJson(scenario: Scenario, appVersion: string): string {
  const file: ScenarioFile = {
    fileType: SCENARIO_FILE_TYPE,
    schemaVersion: scenario.schemaVersion,
    appVersion,
    exportedAt: new Date().toISOString(),
    scenario,
  };
  return JSON.stringify(file, null, 2);
}

// ═══════════════════════════════════════════════════════════════════════
// Structural readers (fail loudly, never coerce)
// ═══════════════════════════════════════════════════════════════════════

type Raw = Record<string, unknown>;

function isRaw(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

class FieldReader {
  errors: string[] = [];
  notes: string[] = [];

  num(obj: Raw, key: string, path: string): number {
    const v = obj[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    this.errors.push(`${path}.${key}: expected a finite number, got ${JSON.stringify(v)}.`);
    return NaN;
  }

  /** Number with a provisional default for fields added after schema v1. */
  numOr(obj: Raw, key: string, path: string, fallback: number, label: string): number {
    const v = obj[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (v === undefined) {
      this.notes.push(
        `Migration: ${path}.${key} (${label}) was missing; filled with PROVISIONAL default ${fallback}. Review before use.`,
      );
      return fallback;
    }
    this.errors.push(`${path}.${key}: expected a finite number, got ${JSON.stringify(v)}.`);
    return NaN;
  }

  str(obj: Raw, key: string, path: string): string {
    const v = obj[key];
    if (typeof v === 'string') return v;
    this.errors.push(`${path}.${key}: expected a string, got ${JSON.stringify(v)}.`);
    return '';
  }

  bool(obj: Raw, key: string, path: string): boolean {
    const v = obj[key];
    if (typeof v === 'boolean') return v;
    this.errors.push(`${path}.${key}: expected a boolean, got ${JSON.stringify(v)}.`);
    return true;
  }

  oneOf<T extends string>(obj: Raw, key: string, path: string, allowed: readonly T[], fallback?: T): T {
    const v = obj[key];
    if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) return v as T;
    if (v === undefined && fallback !== undefined) {
      this.notes.push(
        `Migration: ${path}.${key} was missing; filled with default '${fallback}'. Review before use.`,
      );
      return fallback;
    }
    this.errors.push(`${path}.${key}: expected one of [${allowed.join(', ')}], got ${JSON.stringify(v)}.`);
    return allowed[0];
  }

  section(obj: Raw, key: string): Raw {
    const v = obj[key];
    if (isRaw(v)) return v;
    this.errors.push(`${key}: expected an object section.`);
    return {};
  }

  /** Optional section (added after v1) — returns empty object and notes when absent. */
  sectionOr(obj: Raw, key: string, label: string): Raw {
    const v = obj[key];
    if (isRaw(v)) return v;
    if (v === undefined) {
      this.notes.push(`Migration: '${key}' section (${label}) was missing; filled with PROVISIONAL defaults.`);
      return {};
    }
    this.errors.push(`${key}: expected an object section.`);
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Migration + structural validation (raw → Scenario)
// ═══════════════════════════════════════════════════════════════════════

const BRAKE_TYPES = ['hydraulic-sled', 'shock-absorber-bank', 'friction-rope', 'eddy-current'] as const;
const BRAKE_LAWS: readonly BrakeLaw[] = ['constant-force', 'linear-ramp', 'velocity-proportional'];

/**
 * Builds a clean Scenario from untrusted raw data, migrating v1 files
 * by filling Milestone-3 fields with labeled provisional defaults.
 * Unknown fields are dropped by construction.
 */
export function migrateScenario(raw: unknown): ImportResult {
  if (!isRaw(raw)) return { ok: false, errors: ['Scenario payload is not an object.'] };

  const version = raw.schemaVersion;
  if (typeof version !== 'number' || version < 1 || version > CURRENT_SCHEMA_VERSION || !Number.isInteger(version)) {
    return {
      ok: false,
      errors: [
        `Unsupported schemaVersion ${JSON.stringify(version)}; this application reads versions 1–${CURRENT_SCHEMA_VERSION}.`,
      ],
    };
  }

  const r = new FieldReader();

  const siteR = r.section(raw, 'site');
  const site: SiteGeometry = {
    horizontalSpanM: r.num(siteR, 'horizontalSpanM', 'site'),
    highPointElevationM: r.num(siteR, 'highPointElevationM', 'site'),
    brakeAnchorElevationM: r.num(siteR, 'brakeAnchorElevationM', 'site'),
    captureHeightAboveGroundM: r.numOr(siteR, 'captureHeightAboveGroundM', 'site', 0, 'capture height above ground (0 = capture at grade)'),
    launchAnchorOffsetM: r.num(siteR, 'launchAnchorOffsetM', 'site'),
    brakeZoneLengthM: r.num(siteR, 'brakeZoneLengthM', 'site'),
    captureZoneLengthM: r.num(siteR, 'captureZoneLengthM', 'site'),
    minGroundClearanceM: r.num(siteR, 'minGroundClearanceM', 'site'),
  };

  const cableR = r.section(raw, 'cable');
  const cable: CableProperties = {
    materialLabel: r.str(cableR, 'materialLabel', 'cable'),
    diameterM: r.num(cableR, 'diameterM', 'cable'),
    linearMassKgPerM: r.num(cableR, 'linearMassKgPerM', 'cable'),
    minBreakingStrengthN: r.num(cableR, 'minBreakingStrengthN', 'cable'),
    designFactor: r.num(cableR, 'designFactor', 'cable'),
    pretensionN: r.num(cableR, 'pretensionN', 'cable'),
  };

  const trolleyR = r.section(raw, 'trolley');
  const trolley: TrolleyPayload = {
    trolleyMassKg: r.num(trolleyR, 'trolleyMassKg', 'trolley'),
    testArticleMassKg: r.num(trolleyR, 'testArticleMassKg', 'trolley'),
    payloadDropM: r.num(trolleyR, 'payloadDropM', 'trolley'),
    maxAllowableSpeedMps: r.num(trolleyR, 'maxAllowableSpeedMps', 'trolley'),
    rollingResistanceCoeff: r.numOr(trolleyR, 'rollingResistanceCoeff', 'trolley', 0.015, 'rolling resistance'),
    dragAreaM2: r.numOr(trolleyR, 'dragAreaM2', 'trolley', 0.4, 'drag area Cd·A'),
    trolleyStructuralRatingN: r.numOr(trolleyR, 'trolleyStructuralRatingN', 'trolley', 0, 'structural rating (0 = not entered)'),
  };

  const craneR = r.section(raw, 'crane');
  const crane: CraneInputs = {
    ratedCapacityAtRadiusN: r.num(craneR, 'ratedCapacityAtRadiusN', 'crane'),
    hookHeightM: r.num(craneR, 'hookHeightM', 'crane'),
    hookRadiusM: r.num(craneR, 'hookRadiusM', 'crane'),
    riggingMassKg: r.num(craneR, 'riggingMassKg', 'crane'),
    dynamicAmplificationFactor: r.num(craneR, 'dynamicAmplificationFactor', 'crane'),
  };

  const anchorsR = r.section(raw, 'anchors');
  const anchors: AnchorInputs = {
    blocksPerAnchor: r.num(anchorsR, 'blocksPerAnchor', 'anchors'),
    blockMassKg: r.num(anchorsR, 'blockMassKg', 'anchors'),
    groundFrictionCoefficient: r.num(anchorsR, 'groundFrictionCoefficient', 'anchors'),
    slidingSafetyFactor: r.num(anchorsR, 'slidingSafetyFactor', 'anchors'),
  };

  const brakeR = r.section(raw, 'brake');
  const brake: BrakeInputs = {
    brakeType: r.oneOf(brakeR, 'brakeType', 'brake', BRAKE_TYPES),
    maxDecelerationMps2: r.num(brakeR, 'maxDecelerationMps2', 'brake'),
    availableStrokeM: r.num(brakeR, 'availableStrokeM', 'brake'),
    brakeLaw: r.oneOf(brakeR, 'brakeLaw', 'brake', BRAKE_LAWS, 'constant-force'),
    brakeForceN: r.numOr(brakeR, 'brakeForceN', 'brake', 0, 'brake force (0 = no braking until set)'),
    velocityCoeffNsPerM: r.numOr(brakeR, 'velocityCoeffNsPerM', 'brake', 0, 'velocity coefficient'),
    brakeCapacityN: r.numOr(brakeR, 'brakeCapacityN', 'brake', 0, 'brake capacity (0 = not entered)'),
  };

  const envR = r.section(raw, 'environment');
  const environment: EnvironmentInputs = {
    steadyCrosswindMps: r.num(envR, 'steadyCrosswindMps', 'environment'),
    gustMps: r.num(envR, 'gustMps', 'environment'),
    temperatureC: r.num(envR, 'temperatureC', 'environment'),
    alongTrackWindMps: r.numOr(envR, 'alongTrackWindMps', 'environment', 0, 'along-track wind'),
    airDensityKgPerM3: r.numOr(envR, 'airDensityKgPerM3', 'environment', 1.225, 'air density'),
  };

  const dynR = r.sectionOr(raw, 'dynamics', 'Milestone-3 simulation settings');
  const dynamics: DynamicsSettings = {
    releasePositionFrac: r.numOr(dynR, 'releasePositionFrac', 'dynamics', 0, 'release position'),
    releaseSpeedMps: r.numOr(dynR, 'releaseSpeedMps', 'dynamics', 0, 'release speed'),
    timeStepS: r.numOr(dynR, 'timeStepS', 'dynamics', 0.01, 'time step'),
    maxSimTimeS: r.numOr(dynR, 'maxSimTimeS', 'dynamics', 120, 'time limit'),
  };

  const scenario: Scenario = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: r.str(raw, 'name', 'scenario'),
    isUnverifiedExample: r.bool(raw, 'isUnverifiedExample', 'scenario'),
    site,
    cable,
    trolley,
    crane,
    anchors,
    brake,
    environment,
    dynamics,
  };

  if (r.errors.length > 0) return { ok: false, errors: r.errors };
  if (version < CURRENT_SCHEMA_VERSION && r.notes.length === 0) {
    r.notes.push(
      `Migrated schema v${version} → v${CURRENT_SCHEMA_VERSION} (no field changes were required).`,
    );
  }
  return { ok: true, scenario, migrationNotes: r.notes };
}

// ═══════════════════════════════════════════════════════════════════════
// Import (file text → Scenario)
// ═══════════════════════════════════════════════════════════════════════

export function importScenarioJson(jsonText: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return { ok: false, errors: [`File is not valid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
  if (!isRaw(parsed)) return { ok: false, errors: ['File does not contain a JSON object.'] };

  // Accept either the export envelope or a bare scenario object.
  if (parsed.fileType !== undefined) {
    if (parsed.fileType !== SCENARIO_FILE_TYPE) {
      return { ok: false, errors: [`Unrecognized fileType ${JSON.stringify(parsed.fileType)}.`] };
    }
    if (!isRaw(parsed.scenario)) {
      return { ok: false, errors: ['Envelope has no scenario object.'] };
    }
    return migrateScenario(parsed.scenario);
  }
  return migrateScenario(parsed);
}
