import { useAppStore } from '../state/store';
import { runStaticAnalysis, type StaticAnalysisResult } from '../calculations/staticAnalysis';
import { validateScenario } from '../validation/validate';
import { formatLength, formatForce } from '../units/units';
import { useMemo } from 'react';

export function ResultsPanel() {
  const scenario = useAppStore((s) => s.scenario);
  const unitSystem = useAppStore((s) => s.unitSystem);
  const trolleyPos = useAppStore((s) => s.trolleyPositionFrac);
  const validation = validateScenario(scenario);

  const result: StaticAnalysisResult | null = useMemo(() => {
    if (!validation.isValid) return null;
    try {
      return runStaticAnalysis({ scenario, trolleyPositionFrac: trolleyPos });
    } catch {
      return null;
    }
  }, [scenario, trolleyPos, validation.isValid]);

  if (!validation.isValid) {
    return (
      <section className="results-panel">
        <h2>Results</h2>
        <p className="blocked">Results withheld — fix input errors first.</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="results-panel">
        <h2>Results</h2>
        <p className="blocked">Solver error — check inputs.</p>
      </section>
    );
  }

  const fmt = (m: number) => formatLength(m, unitSystem, 1);
  const fmtF = (n: number) => formatForce(n, unitSystem, 0);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <section className="results-panel">
      <h2>Static Analysis Results</h2>

      <details open>
        <summary>Layout geometry</summary>
        <table><tbody>
          <Row k="Main-leg chord" v={fmt(result.layout.mainLegChordLengthM)} />
          <Row k="Main-leg nominal angle" v={`${result.layout.mainLegNominalAngleDeg.toFixed(2)}°`} />
          <Row k="Backstay chord" v={fmt(result.layout.backstayChordLengthM)} />
          <Row k="Backstay nominal angle" v={`${result.layout.backstayNominalAngleDeg.toFixed(2)}°`} />
          <Row k="Total site footprint" v={fmt(result.layout.brakeAnchor.x)} />
        </tbody></table>
      </details>

      <details open>
        <summary>Cable tensions (loaded, trolley @ {(trolleyPos * 100).toFixed(0)}%)</summary>
        <table><tbody>
          <Row k="Main leg H (horizontal)" v={fmtF(result.mainLegLoaded.horizontalTensionN)} />
          <Row k="Main leg max tension" v={fmtF(result.mainLegLoaded.maxTensionN)} />
          <Row k="Main leg utilization" v={pct(result.mainLegLoaded.utilization)}
            warn={result.mainLegLoaded.utilization > 0.8} />
          <Row k="Backstay H (horizontal)" v={fmtF(result.backstay.horizontalTensionN)} />
          <Row k="Backstay max tension" v={fmtF(result.backstay.maxTensionN)} />
          <Row k="Backstay utilization" v={pct(result.backstay.utilization)}
            warn={result.backstay.utilization > 0.8} />
          <Row k="Main leg midspan sag" v={fmt(result.mainLegLoaded.midspanSagM)} />
          <Row k="Backstay midspan sag" v={fmt(result.backstay.midspanSagM)} />
        </tbody></table>
      </details>

      <details open>
        <summary>Crane / master node</summary>
        <table><tbody>
          <Row k="Hook resultant (static)" v={fmtF(result.masterNode.hookResultantN)} />
          <Row k="Hook load (w/ DAF)" v={fmtF(result.masterNode.dynamicHookLoadN)} />
          <Row k="Hook angle from vertical" v={`${result.masterNode.hookAngleDeg.toFixed(1)}°`}
            warn={result.masterNode.hookAngleDeg > 3} />
          <Row k="Crane utilization" v={pct(result.masterNode.craneUtilization)}
            warn={result.masterNode.craneUtilization > 0.85} />
          <Row k="Included angle" v={`${result.masterNode.includedAngleDeg.toFixed(1)}°`} />
        </tbody></table>
        <p className="note">Crane capacity is USER-ENTERED (preliminary). Requires crane-company chart verification.</p>
      </details>

      <details open>
        <summary>Anchors</summary>
        <table><tbody>
          <Row k="Launch anchor sliding SF" v={result.launchAnchor.slidingSF === Infinity ? '∞' : result.launchAnchor.slidingSF.toFixed(2)}
            warn={!result.launchAnchor.slidingOk} />
          <Row k="Launch anchor uplift SF" v={result.launchAnchor.upliftSF === Infinity ? '∞' : result.launchAnchor.upliftSF.toFixed(2)}
            warn={!result.launchAnchor.upliftOk} />
          <Row k="Brake anchor sliding SF" v={result.brakeAnchor.slidingSF === Infinity ? '∞' : result.brakeAnchor.slidingSF.toFixed(2)}
            warn={!result.brakeAnchor.slidingOk} />
          <Row k="Brake anchor uplift SF" v={result.brakeAnchor.upliftSF === Infinity ? '∞' : result.brakeAnchor.upliftSF.toFixed(2)}
            warn={!result.brakeAnchor.upliftOk} />
        </tbody></table>
        <p className="note">Anchor masses and friction are PROVISIONAL. Requires field verification and proof-pull testing.</p>
      </details>

      <details open>
        <summary>Ground clearance</summary>
        <table><tbody>
          <Row k="Clearance margin" v={fmt(result.groundClearanceMarginM)}
            warn={result.groundClearanceMarginM < 0} />
        </tbody></table>
      </details>

      <p className="note">
        Results use the parabolic cable approximation (self-weight distributed per
        horizontal projection, no elastic elongation). Loaded cable sag and
        tensions are <strong>preliminary estimates</strong>.
      </p>
    </section>
  );
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <tr className={warn ? 'row-warn' : ''}>
      <td>{k}</td>
      <td className="num">{v}</td>
    </tr>
  );
}
