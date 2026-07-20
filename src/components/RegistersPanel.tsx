import { useAppStore } from '../state/store';
import { useDynamics } from '../state/useDynamics';

/**
 * Assumptions and unresolved-input registers, visible in the interface
 * (Milestone 4). Combines the project-level registers with the live
 * solver assumptions for the active scenario.
 */

const PROJECT_ASSUMPTIONS = [
  'Master node horizontal station equals launch-anchor offset from launch station.',
  'Cable legs use the parabolic approximation: load per horizontal projection, no bending stiffness, no elastic elongation, no wind/temperature geometry effects (valid for sag/span < 8% and chord slope < 30°; warnings issued when violated).',
  'Pretension sets H via an iterative solver on the unloaded cable; loaded and dynamic cases reuse that H (geometric stiffening neglected — elastic catenary is a future milestone).',
  'Trolley path is the influence line of the parabolic cable; its gradient is the effective slope (energy-consistent for a quasi-static cable).',
  'Point-mass trolley: payload pendulum, wheel rotating inertia, and lateral sway are neglected.',
  'Brake laws are idealized (constant force / linear ramp / velocity-proportional); real hardware response requires manufacturer data.',
  'User-entered DAF is applied to static hook load and to peak brake force as preliminary dynamic demand.',
  'Ground under the main leg is linearly interpolated between master-node ground and brake-anchor ground.',
];

const UNRESOLVED_INPUTS = [
  'Manufacturer-certified cable properties (MBS, linear mass, stiffness, creep, temperature limits).',
  'Field-verified ecology-block weight and ground friction coefficient.',
  'Crane-company-approved capacity at radius, side-load allowances, dynamic allowances.',
  'Proof-pull procedures and base-level connection details for ecology-block anchor clusters.',
  'Trolley rolling-resistance coefficient and drag area (require rolldown or field test).',
  'Brake hardware capacity and force-vs-stroke curve (require manufacturer data).',
  'Trolley structural rating (requires trolley design and proof test).',
];

export function RegistersPanel() {
  const scenario = useAppStore((s) => s.scenario);
  const { result } = useDynamics(scenario);

  return (
    <section className="results-panel registers-panel">
      <h2>Engineering registers</h2>

      <details open>
        <summary>Assumptions register ({PROJECT_ASSUMPTIONS.length})</summary>
        <ul className="assumptions">
          {PROJECT_ASSUMPTIONS.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </details>

      <details open>
        <summary>Unresolved-input register ({UNRESOLVED_INPUTS.length})</summary>
        <ul className="assumptions unresolved">
          {UNRESOLVED_INPUTS.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </details>

      {result && (
        <details>
          <summary>Active solver assumptions (this scenario)</summary>
          <ul className="assumptions">
            {result.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </details>
      )}

      <p className="note">
        Values marked PROVISIONAL require field measurement, manufacturer data, or professional
        approval before any physical test.
      </p>
    </section>
  );
}
