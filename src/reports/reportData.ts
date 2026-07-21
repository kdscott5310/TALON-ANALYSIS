/**
 * Report data assembly — Milestone 4.
 *
 * Gathers everything the printable engineering report needs into one
 * typed structure so it can be tested independently of React. Checks
 * that were not evaluated keep their 'insufficient' status and a
 * 'NOT ENTERED' marker — missing information is never rendered as
 * zero or acceptable.
 */

import type { Scenario } from '../models/scenario';
import { DISCLAIMER } from '../models/scenario';
import { summarizeScenario, type ScenarioSummary } from '../calculations/statusSummary';
import { validateScenario, type ValidationIssue } from '../validation/validate';
import {
  formatForce,
  formatLength,
  formatMass,
  formatSpeed,
  type UnitSystem,
} from '../units/units';

export interface ReportInputRow {
  label: string;
  value: string;
  provisional?: boolean;
}

export interface ReportInputSection {
  title: string;
  rows: ReportInputRow[];
}

export interface ReportData {
  meta: {
    title: string;
    scenarioName: string;
    appVersion: string;
    generatedAt: string; // ISO date
    schemaVersion: number;
    unverifiedExample: boolean;
  };
  inputs: ReportInputSection[];
  summary: ScenarioSummary;
  validationIssues: ValidationIssue[];
  disclaimer: string;
}

export function buildReportData(
  scenario: Scenario,
  appVersion: string,
  unitSystem: UnitSystem,
): ReportData {
  const u = unitSystem;
  const L = (m: number) => formatLength(m, u, 1);
  const F = (n: number) => formatForce(n, u, 0);
  const M = (kg: number) => formatMass(kg, u, 1);
  const V = (mps: number) => formatSpeed(mps, u, 1);

  const inputs: ReportInputSection[] = [
    {
      title: 'Site geometry',
      rows: [
        { label: 'Horizontal main span', value: L(scenario.site.horizontalSpanM) },
        { label: 'High-point elevation', value: L(scenario.site.highPointElevationM) },
        { label: 'Capture-point elevation', value: L(scenario.site.brakeAnchorElevationM) },
        { label: 'Capture height above ground', value: L(scenario.site.captureHeightAboveGroundM) },
        { label: 'Launch-anchor offset', value: L(scenario.site.launchAnchorOffsetM) },
        { label: 'Brake-zone length', value: L(scenario.site.brakeZoneLengthM) },
        { label: 'Capture-zone length', value: L(scenario.site.captureZoneLengthM) },
        { label: 'Min ground clearance', value: L(scenario.site.minGroundClearanceM) },
      ],
    },
    {
      title: 'Cable',
      rows: [
        { label: 'Material', value: scenario.cable.materialLabel, provisional: true },
        { label: 'Diameter', value: L(scenario.cable.diameterM) },
        { label: 'Linear mass', value: `${scenario.cable.linearMassKgPerM} kg/m`, provisional: true },
        { label: 'Min breaking strength', value: F(scenario.cable.minBreakingStrengthN), provisional: true },
        { label: 'Design factor', value: String(scenario.cable.designFactor) },
        { label: 'Pretension', value: F(scenario.cable.pretensionN) },
      ],
    },
    {
      title: 'Trolley & payload',
      rows: [
        { label: 'Trolley mass', value: M(scenario.trolley.trolleyMassKg) },
        { label: 'Test-article mass', value: M(scenario.trolley.testArticleMassKg) },
        { label: 'Payload drop', value: L(scenario.trolley.payloadDropM) },
        { label: 'Max allowable speed', value: V(scenario.trolley.maxAllowableSpeedMps) },
        { label: 'Rolling resistance coeff.', value: String(scenario.trolley.rollingResistanceCoeff), provisional: true },
        { label: 'Drag area Cd·A', value: `${scenario.trolley.dragAreaM2} m²`, provisional: true },
        {
          label: 'Structural rating',
          value: scenario.trolley.trolleyStructuralRatingN > 0 ? F(scenario.trolley.trolleyStructuralRatingN) : 'NOT ENTERED',
          provisional: true,
        },
      ],
    },
    {
      title: 'Crane & rigging',
      rows: [
        { label: 'Rated capacity @ radius', value: F(scenario.crane.ratedCapacityAtRadiusN), provisional: true },
        { label: 'Hook height', value: L(scenario.crane.hookHeightM) },
        { label: 'Hook radius', value: L(scenario.crane.hookRadiusM) },
        { label: 'Rigging mass', value: M(scenario.crane.riggingMassKg), provisional: true },
        { label: 'Dynamic amplification factor', value: String(scenario.crane.dynamicAmplificationFactor), provisional: true },
      ],
    },
    {
      title: 'Anchors',
      rows: [
        { label: 'Blocks per anchor', value: String(scenario.anchors.blocksPerAnchor) },
        { label: 'Block mass', value: M(scenario.anchors.blockMassKg), provisional: true },
        { label: 'Ground friction coefficient', value: String(scenario.anchors.groundFrictionCoefficient), provisional: true },
        { label: 'Required sliding SF', value: String(scenario.anchors.slidingSafetyFactor) },
      ],
    },
    {
      title: 'Brake & dynamics',
      rows: [
        { label: 'Brake type', value: scenario.brake.brakeType },
        { label: 'Brake law (simulation)', value: scenario.brake.brakeLaw },
        { label: 'Brake force', value: F(scenario.brake.brakeForceN), provisional: true },
        { label: 'Velocity coefficient', value: `${scenario.brake.velocityCoeffNsPerM} N·s/m`, provisional: true },
        {
          label: 'Brake capacity',
          value: scenario.brake.brakeCapacityN > 0 ? F(scenario.brake.brakeCapacityN) : 'NOT ENTERED',
          provisional: true,
        },
        { label: 'Max deceleration', value: `${scenario.brake.maxDecelerationMps2.toFixed(2)} m/s²` },
        { label: 'Available stroke', value: L(scenario.brake.availableStrokeM) },
        { label: 'Release position', value: `${(scenario.dynamics.releasePositionFrac * 100).toFixed(0)}% of span` },
        { label: 'Release speed', value: V(scenario.dynamics.releaseSpeedMps) },
        { label: 'Time step', value: `${scenario.dynamics.timeStepS} s` },
      ],
    },
    {
      title: 'Environment',
      rows: [
        { label: 'Steady crosswind', value: V(scenario.environment.steadyCrosswindMps) },
        { label: 'Gust', value: V(scenario.environment.gustMps) },
        { label: 'Along-track wind', value: V(scenario.environment.alongTrackWindMps) },
        { label: 'Air density', value: `${scenario.environment.airDensityKgPerM3} kg/m³` },
        { label: 'Temperature', value: `${scenario.environment.temperatureC} °C` },
      ],
    },
  ];

  return {
    meta: {
      title: 'CUFTS Preliminary Engineering Report',
      scenarioName: scenario.name,
      appVersion,
      generatedAt: new Date().toISOString(),
      schemaVersion: scenario.schemaVersion,
      unverifiedExample: scenario.isUnverifiedExample,
    },
    inputs,
    summary: summarizeScenario(scenario),
    validationIssues: validateScenario(scenario).issues,
    disclaimer: DISCLAIMER,
  };
}
