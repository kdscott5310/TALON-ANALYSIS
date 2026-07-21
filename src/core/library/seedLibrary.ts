/**
 * Seeded example component records — Milestone 7.
 *
 * ⚠ EVERY RECORD HERE IS `exampleOnly`. These are illustrative placeholders
 * that demonstrate the library shape. They are NOT manufacturer data, are NOT
 * verified, and must NEVER be used for design or to authorize a test.
 *
 * Rule 4: no vendor data is hard-coded as certified. `seedLibrary.test.ts`
 * asserts that no seeded record or property claims a verified state, and that
 * no seed carries a real manufacturer name, model, or part number.
 */

import { exampleValue } from '../provenance';
import { createLibrary, type ComponentLibrary, type ComponentRecord } from './componentLibrary';

const SEED_NOTE =
  'EXAMPLE ONLY — illustrative placeholder, not manufacturer data. Replace with a ' +
  'verified value from the current manufacturer document before any design use.';

function seedRecord(
  id: string,
  category: ComponentRecord['category'],
  name: string,
  description: string,
  properties: ComponentRecord['properties'],
): ComponentRecord {
  return {
    id,
    category,
    name,
    // No manufacturer / model / partNumber: seeds must not imply a real product.
    description,
    properties,
    attachments: [],
    provenance: {
      state: 'exampleOnly',
      sourceType: 'seedData',
      notes: SEED_NOTE,
    },
    obsolete: false,
    history: [
      {
        changedOn: '2026-01-01T00:00:00.000Z',
        summary: 'Seeded as example-only placeholder.',
        state: 'exampleOnly',
      },
    ],
    notes: SEED_NOTE,
  };
}

/**
 * Builds the seed library. Values are plausible orders of magnitude chosen to
 * exercise the UI and selection logic — they are not taken from any product.
 */
export function buildSeedLibrary(updatedOn?: string): ComponentLibrary {
  const lib = createLibrary('TALON example library (EXAMPLE ONLY)', updatedOn);

  const records: ComponentRecord[] = [
    seedRecord(
      'seed-synthetic-rope-12mm',
      'syntheticRope',
      'Generic 12 mm HMPE 12-strand rope (EXAMPLE)',
      'Placeholder synthetic rope for demonstrating cable selection.',
      [
        {
          key: 'diameter',
          label: 'Diameter',
          quantity: exampleValue(0.012, 'length', SEED_NOTE),
        },
        {
          key: 'minimumBreakingStrength',
          label: 'Minimum breaking strength',
          quantity: exampleValue(130000, 'force', SEED_NOTE),
        },
        {
          key: 'linearMass',
          label: 'Linear mass',
          quantity: exampleValue(0.083, 'linearDensity', SEED_NOTE),
        },
        {
          key: 'axialStiffness',
          label: 'Axial stiffness EA',
          quantity: exampleValue(9.5e6, 'force', SEED_NOTE),
        },
      ],
    ),
    seedRecord(
      'seed-wire-rope-13mm',
      'wireRope',
      'Generic 13 mm galvanized wire rope (EXAMPLE)',
      'Placeholder steel wire rope for comparison against synthetic options.',
      [
        { key: 'diameter', label: 'Diameter', quantity: exampleValue(0.013, 'length', SEED_NOTE) },
        {
          key: 'minimumBreakingStrength',
          label: 'Minimum breaking strength',
          quantity: exampleValue(110000, 'force', SEED_NOTE),
        },
        {
          key: 'linearMass',
          label: 'Linear mass',
          quantity: exampleValue(0.68, 'linearDensity', SEED_NOTE),
        },
        {
          key: 'minimumDRatio',
          label: 'Minimum sheave D:d ratio',
          quantity: exampleValue(18, 'dimensionless', SEED_NOTE),
        },
      ],
    ),
    seedRecord(
      'seed-shackle-10t',
      'shackle',
      'Generic bow shackle, 10 t class (EXAMPLE)',
      'Placeholder rigging shackle for demonstrating WLL checks.',
      [
        {
          key: 'workingLoadLimit',
          label: 'Working load limit',
          quantity: exampleValue(98000, 'force', SEED_NOTE),
        },
        {
          key: 'proofLoad',
          label: 'Proof load',
          quantity: exampleValue(196000, 'force', SEED_NOTE),
        },
        { key: 'mass', label: 'Mass', quantity: exampleValue(6.4, 'mass', SEED_NOTE) },
      ],
    ),
    seedRecord(
      'seed-load-cell-100kn',
      'loadCell',
      'Generic tension load cell, 100 kN (EXAMPLE)',
      'Placeholder inline load cell for instrumentation planning.',
      [
        {
          key: 'ratedCapacity',
          label: 'Rated capacity',
          quantity: exampleValue(100000, 'force', SEED_NOTE),
        },
        { key: 'mass', label: 'Mass', quantity: exampleValue(3.2, 'mass', SEED_NOTE) },
      ],
    ),
    seedRecord(
      'seed-shock-absorber',
      'shockAbsorber',
      'Generic industrial shock absorber (EXAMPLE)',
      'Placeholder energy absorber for brake-package studies.',
      [
        {
          key: 'energyCapacity',
          label: 'Energy capacity per cycle',
          quantity: exampleValue(34000, 'energy', SEED_NOTE),
        },
        {
          key: 'stroke',
          label: 'Stroke',
          quantity: exampleValue(0.61, 'length', SEED_NOTE),
        },
        {
          key: 'forceCapacity',
          label: 'Maximum force',
          quantity: exampleValue(89000, 'force', SEED_NOTE),
        },
      ],
    ),
    seedRecord(
      'seed-ecology-block',
      'ecologyBlock',
      'Generic concrete ecology block (EXAMPLE)',
      'Placeholder ballast block; field-weigh before use.',
      [
        { key: 'mass', label: 'Mass', quantity: exampleValue(1814, 'mass', SEED_NOTE) },
        { key: 'length', label: 'Length', quantity: exampleValue(1.83, 'length', SEED_NOTE) },
        { key: 'width', label: 'Width', quantity: exampleValue(0.61, 'length', SEED_NOTE) },
        { key: 'height', label: 'Height', quantity: exampleValue(0.61, 'length', SEED_NOTE) },
      ],
    ),
  ];

  return { ...lib, records };
}
