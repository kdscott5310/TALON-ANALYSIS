import { useAppStore } from '../state/store';
import { NumberField } from './NumberField';
import {
  ftToM,
  mToFt,
  lbToKg,
  kgToLb,
  lbfToN,
  nToLbf,
  mphToMps,
  mpsToMph,
  inToM,
  mToIn,
  ft2ToM2,
  m2ToFt2,
} from '../units/units';
import type { BrakeLaw, Scenario } from '../models/scenario';

type Conv = { toSi: (v: number) => number; fromSi: (v: number) => number; us: string; si: string };
const LEN: Conv = { toSi: ftToM, fromSi: mToFt, us: 'ft', si: 'm' };
const LEN_IN: Conv = { toSi: inToM, fromSi: mToIn, us: 'in', si: 'm' };
const MASS: Conv = { toSi: lbToKg, fromSi: kgToLb, us: 'lb', si: 'kg' };
const FORCE: Conv = { toSi: lbfToN, fromSi: nToLbf, us: 'lbf', si: 'N' };
const SPEED: Conv = { toSi: mphToMps, fromSi: mpsToMph, us: 'mph', si: 'm/s' };
const AREA: Conv = { toSi: ft2ToM2, fromSi: m2ToFt2, us: 'ft²', si: 'm²' };
const NONE: Conv = { toSi: (v) => v, fromSi: (v) => v, us: '—', si: '—' };

export function InputPanel() {
  const scenario = useAppStore((s) => s.scenario);
  const unitSystem = useAppStore((s) => s.unitSystem);
  const update = useAppStore((s) => s.updateScenario);

  function field(
    label: string,
    tooltip: string,
    conv: Conv,
    get: (s: Scenario) => number,
    set: (s: Scenario, siValue: number) => Scenario,
  ) {
    const isUS = unitSystem === 'us';
    return (
      <NumberField
        label={label}
        unitLabel={isUS ? conv.us : conv.si}
        tooltip={tooltip}
        value={isUS ? conv.fromSi(get(scenario)) : get(scenario)}
        onChange={(display) => update((s) => set(s, isUS ? conv.toSi(display) : display))}
      />
    );
  }

  return (
    <aside className="input-panel">
      <h2>Inputs</h2>

      <details open>
        <summary>Site geometry</summary>
        {field('Horizontal main span', 'Horizontal distance from high point to brake anchor (500–2,000 ft typical).', LEN,
          (s) => s.site.horizontalSpanM,
          (s, v) => ({ ...s, site: { ...s.site, horizontalSpanM: v } }))}
        {field('High-point elevation', 'Master-node height above launch-station ground (25–250 ft typical).', LEN,
          (s) => s.site.highPointElevationM,
          (s, v) => ({ ...s, site: { ...s.site, highPointElevationM: v } }))}
        {field('Capture-point elevation', 'Elevation of the capture point / downhill cable terminus relative to launch station (+ up). This is where the trolley is caught, not necessarily the ground.', LEN,
          (s) => s.site.brakeAnchorElevationM,
          (s, v) => ({ ...s, site: { ...s.site, brakeAnchorElevationM: v } }))}
        {field('Capture height above ground', 'How high the capture point sits above local grade (0 = on the ground). Raise it for elevated capture per site terrain.', LEN,
          (s) => s.site.captureHeightAboveGroundM,
          (s, v) => ({ ...s, site: { ...s.site, captureHeightAboveGroundM: v } }))}
        {field('Launch-anchor offset', 'Horizontal offset of launch-side backstay anchor from the high point.', LEN,
          (s) => s.site.launchAnchorOffsetM,
          (s, v) => ({ ...s, site: { ...s.site, launchAnchorOffsetM: v } }))}
        {field('Brake-zone length', 'Length of the progressive braking zone.', LEN,
          (s) => s.site.brakeZoneLengthM,
          (s, v) => ({ ...s, site: { ...s.site, brakeZoneLengthM: v } }))}
        {field('Capture-zone length', 'Length of the final capture zone beyond the brake zone.', LEN,
          (s) => s.site.captureZoneLengthM,
          (s, v) => ({ ...s, site: { ...s.site, captureZoneLengthM: v } }))}
        {field('Min ground clearance', 'Required minimum payload ground clearance.', LEN,
          (s) => s.site.minGroundClearanceM,
          (s, v) => ({ ...s, site: { ...s.site, minGroundClearanceM: v } }))}
      </details>

      <details>
        <summary>Cable (provisional data)</summary>
        {field('Diameter', 'Cable diameter. Verify against manufacturer data.', LEN_IN,
          (s) => s.cable.diameterM,
          (s, v) => ({ ...s, cable: { ...s.cable, diameterM: v } }))}
        {field('Min breaking strength', 'PROVISIONAL — verify with manufacturer certificate.', FORCE,
          (s) => s.cable.minBreakingStrengthN,
          (s, v) => ({ ...s, cable: { ...s.cable, minBreakingStrengthN: v } }))}
        {field('Design factor', 'MBS divided by max working tension. Project target 5:1.', NONE,
          (s) => s.cable.designFactor,
          (s, v) => ({ ...s, cable: { ...s.cable, designFactor: v } }))}
        {field('Pretension', 'Initial static line pretension.', FORCE,
          (s) => s.cable.pretensionN,
          (s, v) => ({ ...s, cable: { ...s.cable, pretensionN: v } }))}
      </details>

      <details>
        <summary>Trolley &amp; payload</summary>
        {field('Trolley mass', 'Bare trolley mass.', MASS,
          (s) => s.trolley.trolleyMassKg,
          (s, v) => ({ ...s, trolley: { ...s.trolley, trolleyMassKg: v } }))}
        {field('Test-article mass', 'Payload / test-article mass.', MASS,
          (s) => s.trolley.testArticleMassKg,
          (s, v) => ({ ...s, trolley: { ...s.trolley, testArticleMassKg: v } }))}
        {field('Payload drop', 'Vertical drop of payload below trolley.', LEN,
          (s) => s.trolley.payloadDropM,
          (s, v) => ({ ...s, trolley: { ...s.trolley, payloadDropM: v } }))}
        {field('Max allowable speed', 'Speed limit for the test article.', SPEED,
          (s) => s.trolley.maxAllowableSpeedMps,
          (s, v) => ({ ...s, trolley: { ...s.trolley, maxAllowableSpeedMps: v } }))}
        {field('Rolling resistance coeff.', 'PROVISIONAL — dimensionless C_rr for cable wheels; verify by test.', NONE,
          (s) => s.trolley.rollingResistanceCoeff,
          (s, v) => ({ ...s, trolley: { ...s.trolley, rollingResistanceCoeff: v } }))}
        {field('Drag area (Cd·A)', 'PROVISIONAL — drag coefficient × frontal area of trolley + payload.', AREA,
          (s) => s.trolley.dragAreaM2,
          (s, v) => ({ ...s, trolley: { ...s.trolley, dragAreaM2: v } }))}
        {field('Structural rating', 'Max force the trolley may carry. 0 = not entered (check skipped).', FORCE,
          (s) => s.trolley.trolleyStructuralRatingN,
          (s, v) => ({ ...s, trolley: { ...s.trolley, trolleyStructuralRatingN: v } }))}
      </details>

      <details>
        <summary>Crane (chart data required)</summary>
        {field('Rated capacity @ radius', 'From crane load chart at working radius. Requires crane-company confirmation.', FORCE,
          (s) => s.crane.ratedCapacityAtRadiusN,
          (s, v) => ({ ...s, crane: { ...s.crane, ratedCapacityAtRadiusN: v } }))}
        {field('Hook height', 'Crane hook height above ground.', LEN,
          (s) => s.crane.hookHeightM,
          (s, v) => ({ ...s, crane: { ...s.crane, hookHeightM: v } }))}
        {field('Hook radius', 'Horizontal crane radius at the hook.', LEN,
          (s) => s.crane.hookRadiusM,
          (s, v) => ({ ...s, crane: { ...s.crane, hookRadiusM: v } }))}
        {field('Rigging mass', 'Master ring + load cell + rigging mass. PROVISIONAL.', MASS,
          (s) => s.crane.riggingMassKg,
          (s, v) => ({ ...s, crane: { ...s.crane, riggingMassKg: v } }))}
        {field('Dynamic amplification', 'Preliminary dynamic amplification factor (≥ 1).', NONE,
          (s) => s.crane.dynamicAmplificationFactor,
          (s, v) => ({ ...s, crane: { ...s.crane, dynamicAmplificationFactor: v } }))}
      </details>

      <details>
        <summary>Anchors (provisional data)</summary>
        {field('Blocks per anchor', 'Number of ecology blocks per anchor cluster.', NONE,
          (s) => s.anchors.blocksPerAnchor,
          (s, v) => ({ ...s, anchors: { ...s.anchors, blocksPerAnchor: Math.round(v) } }))}
        {field('Block mass', 'PROVISIONAL — verify block weight in the field.', MASS,
          (s) => s.anchors.blockMassKg,
          (s, v) => ({ ...s, anchors: { ...s.anchors, blockMassKg: v } }))}
        {field('Ground friction coeff.', 'PROVISIONAL placeholder (0.5 default). Requires site measurement.', NONE,
          (s) => s.anchors.groundFrictionCoefficient,
          (s, v) => ({ ...s, anchors: { ...s.anchors, groundFrictionCoefficient: v } }))}
        {field('Sliding safety factor', 'Required safety factor against anchor sliding.', NONE,
          (s) => s.anchors.slidingSafetyFactor,
          (s, v) => ({ ...s, anchors: { ...s.anchors, slidingSafetyFactor: v } }))}
      </details>

      <details>
        <summary>Brake &amp; dynamics</summary>
        <label className="field">
          <span className="field-label" title="Idealized preliminary brake law used by the simulation.">
            Brake law
          </span>
          <select
            value={scenario.brake.brakeLaw}
            onChange={(e) =>
              update((s) => ({ ...s, brake: { ...s.brake, brakeLaw: e.target.value as BrakeLaw } }))
            }
          >
            <option value="constant-force">Constant force</option>
            <option value="linear-ramp">Linear ramp</option>
            <option value="velocity-proportional">Velocity proportional</option>
          </select>
        </label>
        {field('Brake force', 'Constant force, or peak force at full ramp stroke.', FORCE,
          (s) => s.brake.brakeForceN,
          (s, v) => ({ ...s, brake: { ...s.brake, brakeForceN: v } }))}
        {field('Velocity coeff. (N·s/m)', 'c in F = c·v for the velocity-proportional law. SI value.', NONE,
          (s) => s.brake.velocityCoeffNsPerM,
          (s, v) => ({ ...s, brake: { ...s.brake, velocityCoeffNsPerM: v } }))}
        {field('Brake capacity', 'Hardware max allowable force. 0 = not entered (check skipped).', FORCE,
          (s) => s.brake.brakeCapacityN,
          (s, v) => ({ ...s, brake: { ...s.brake, brakeCapacityN: v } }))}
        {field('Max deceleration (m/s²)', 'Allowable deceleration for the test article. SI value.', NONE,
          (s) => s.brake.maxDecelerationMps2,
          (s, v) => ({ ...s, brake: { ...s.brake, maxDecelerationMps2: v } }))}
        {field('Available stroke', 'Stopping distance available in the brake zone.', LEN,
          (s) => s.brake.availableStrokeM,
          (s, v) => ({ ...s, brake: { ...s.brake, availableStrokeM: v } }))}
        {field('Release position (0–1)', 'Release point as a fraction of the main span from the master node.', NONE,
          (s) => s.dynamics.releasePositionFrac,
          (s, v) => ({ ...s, dynamics: { ...s.dynamics, releasePositionFrac: v } }))}
        {field('Release speed', 'Initial speed at release (0 = from rest).', SPEED,
          (s) => s.dynamics.releaseSpeedMps,
          (s, v) => ({ ...s, dynamics: { ...s.dynamics, releaseSpeedMps: v } }))}
        {field('Time step (s)', 'RK4 integration step. Smaller = more accurate, slower.', NONE,
          (s) => s.dynamics.timeStepS,
          (s, v) => ({ ...s, dynamics: { ...s.dynamics, timeStepS: v } }))}
      </details>

      <details>
        <summary>Environment</summary>
        {field('Steady crosswind', 'Steady crosswind at test elevation.', SPEED,
          (s) => s.environment.steadyCrosswindMps,
          (s, v) => ({ ...s, environment: { ...s.environment, steadyCrosswindMps: v } }))}
        {field('Gust', 'Gust speed.', SPEED,
          (s) => s.environment.gustMps,
          (s, v) => ({ ...s, environment: { ...s.environment, gustMps: v } }))}
        {field('Along-track wind', 'Wind along the main span; positive = tailwind pushing the trolley downhill.', SPEED,
          (s) => s.environment.alongTrackWindMps,
          (s, v) => ({ ...s, environment: { ...s.environment, alongTrackWindMps: v } }))}
        {field('Air density (kg/m³)', 'Default 1.225 (standard sea level). SI value.', NONE,
          (s) => s.environment.airDensityKgPerM3,
          (s, v) => ({ ...s, environment: { ...s.environment, airDensityKgPerM3: v } }))}
      </details>
    </aside>
  );
}
