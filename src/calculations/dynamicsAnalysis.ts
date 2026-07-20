/**
 * Dynamics Analysis Orchestrator — Milestone 3
 *
 * Builds the trolley path from the Milestone-2 static cable solution,
 * runs the time-step simulation, and evaluates user-entered limits
 * (allowable speed, allowable deceleration, brake capacity, trolley
 * structural rating, dynamic amplification for anchor/cable demand).
 *
 * No rating or dynamic factor is invented: every limit compared here
 * is a user input, and un-entered ratings (0) are reported as
 * "not evaluated" rather than silently passed.
 */

import type { Scenario } from '../models/scenario';
import { GRAVITY } from '../units/units';
import { solveParabolicLeg } from './parabolicCable';
import { buildTrolleyPath, type TrolleyPath } from './trolleyPath';
import { simulateTrolley, type SimulationResult } from './trolleyDynamics';

export type WarnSeverity = 'critical' | 'caution' | 'advisory';

export interface DynamicsWarning {
  severity: WarnSeverity;
  message: string;
}

export interface DynamicsAnalysisResult {
  path: TrolleyPath;
  sim: SimulationResult;
  /** Peak brake force × user DAF: preliminary dynamic demand on brake anchor/cable, N */
  dafAmplifiedBrakeForceN: number;
  /** Peak deceleration in g units */
  peakDecelG: number;
  /** Prioritized warnings (critical first) */
  warnings: DynamicsWarning[];
  assumptions: string[];
}

/**
 * Runs the full dynamic analysis for a scenario.
 * Throws on invalid inputs (callers must validate the scenario first).
 */
export function runDynamicsAnalysis(scenario: Scenario): DynamicsAnalysisResult {
  const { site, cable, trolley, crane, brake, environment, dynamics } = scenario;

  // ── static solution for the unloaded main leg → horizontal tension H ──
  const mainLegElevDiff = site.brakeAnchorElevationM - site.highPointElevationM;
  const staticLeg = solveParabolicLeg({
    spanM: site.horizontalSpanM,
    elevDiffM: mainLegElevDiff,
    linearMassKgPerM: cable.linearMassKgPerM,
    pretensionN: cable.pretensionN,
    minBreakingStrengthN: cable.minBreakingStrengthN,
    designFactor: cable.designFactor,
  });

  const massKg = trolley.trolleyMassKg + trolley.testArticleMassKg;
  const trolleyWeightN = massKg * GRAVITY;

  // ── trolley path along the cable ──
  const path = buildTrolleyPath({
    spanM: site.horizontalSpanM,
    elevDiffM: mainLegElevDiff,
    cableWeightNPerM: cable.linearMassKgPerM * GRAVITY,
    horizontalTensionN: staticLeg.horizontalTensionN,
    trolleyWeightN,
  });

  // ── brake-zone geometry on the path ──
  const brakeStartX = site.horizontalSpanM - site.brakeZoneLengthM;
  const brakeStartSM = path.sAtX(brakeStartX);

  // ── run the simulation ──
  const sim = simulateTrolley({
    path,
    massKg,
    rollingResistanceCoeff: trolley.rollingResistanceCoeff,
    dragAreaM2: trolley.dragAreaM2,
    airDensityKgPerM3: environment.airDensityKgPerM3,
    alongTrackWindMps: environment.alongTrackWindMps,
    releaseSM: path.sAtX(dynamics.releasePositionFrac * site.horizontalSpanM),
    releaseSpeedMps: dynamics.releaseSpeedMps,
    brakeStartSM,
    availableStrokeM: brake.availableStrokeM,
    brake: {
      law: brake.brakeLaw,
      forceN: brake.brakeForceN,
      rampLengthM: brake.availableStrokeM,
      velocityCoeffNsPerM: brake.velocityCoeffNsPerM,
    },
    timeStepS: dynamics.timeStepS,
    maxSimTimeS: dynamics.maxSimTimeS,
  });

  // ── limit checks against user-entered limits ──
  const warnings: DynamicsWarning[] = [];
  const crit = (message: string) => warnings.push({ severity: 'critical', message });
  const caut = (message: string) => warnings.push({ severity: 'caution', message });
  const adv = (message: string) => warnings.push({ severity: 'advisory', message });

  // Carry solver/path warnings through with severity mapping.
  for (const w of [...path.warnings, ...sim.warnings]) {
    if (/STOPPING FAILURE|NUMERICAL ERROR|non-convergent/i.test(w)) crit(w);
    else caut(w);
  }

  if (sim.peakSpeedMps > trolley.maxAllowableSpeedMps) {
    crit(
      `OVERSPEED: peak speed ${sim.peakSpeedMps.toFixed(1)} m/s exceeds the ` +
        `maximum allowable ${trolley.maxAllowableSpeedMps.toFixed(1)} m/s.`,
    );
  } else if (sim.peakSpeedMps > 0.9 * trolley.maxAllowableSpeedMps) {
    caut(
      `Peak speed ${sim.peakSpeedMps.toFixed(1)} m/s is within 10% of the allowable ` +
        `${trolley.maxAllowableSpeedMps.toFixed(1)} m/s.`,
    );
  }

  if (sim.peakDecelMps2 > brake.maxDecelerationMps2) {
    crit(
      `DECELERATION LIMIT EXCEEDED: peak ${(sim.peakDecelMps2 / GRAVITY).toFixed(2)} g exceeds the ` +
        `allowable ${(brake.maxDecelerationMps2 / GRAVITY).toFixed(2)} g.`,
    );
  } else if (sim.peakDecelMps2 > 0.85 * brake.maxDecelerationMps2) {
    caut(
      `Peak deceleration ${(sim.peakDecelMps2 / GRAVITY).toFixed(2)} g is within 15% of the ` +
        `allowable ${(brake.maxDecelerationMps2 / GRAVITY).toFixed(2)} g.`,
    );
  }

  if (brake.brakeCapacityN > 0) {
    if (sim.peakBrakeForceN > brake.brakeCapacityN) {
      crit(
        `BRAKE CAPACITY EXCEEDED: peak brake force ${sim.peakBrakeForceN.toFixed(0)} N exceeds the ` +
          `entered capacity ${brake.brakeCapacityN.toFixed(0)} N.`,
      );
    }
  } else {
    adv('Brake hardware capacity not entered — brake capacity check not evaluated.');
  }

  if (trolley.trolleyStructuralRatingN > 0) {
    if (sim.peakBrakeForceN > trolley.trolleyStructuralRatingN) {
      crit(
        `TROLLEY RATING EXCEEDED: peak brake force ${sim.peakBrakeForceN.toFixed(0)} N exceeds the ` +
          `trolley structural rating ${trolley.trolleyStructuralRatingN.toFixed(0)} N.`,
      );
    }
  } else {
    adv('Trolley structural rating not entered — trolley load check not evaluated.');
  }

  const dafAmplifiedBrakeForceN = sim.peakBrakeForceN * crane.dynamicAmplificationFactor;

  const assumptions = [
    ...sim.assumptions,
    `DAF ${crane.dynamicAmplificationFactor} (user-entered, PROVISIONAL) applied to the peak ` +
      'brake force as a preliminary brake-anchor/cable dynamic demand. Coupled cable–brake ' +
      'transient analysis is a later milestone.',
  ];

  const order: Record<WarnSeverity, number> = { critical: 0, caution: 1, advisory: 2 };
  warnings.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    path,
    sim,
    dafAmplifiedBrakeForceN,
    peakDecelG: sim.peakDecelMps2 / GRAVITY,
    warnings,
    assumptions,
  };
}
