import { useMemo } from 'react';
import { useAppStore } from '../state/store';
import { runStaticAnalysis, type StaticAnalysisResult } from '../calculations/staticAnalysis';
import { validateScenario } from '../validation/validate';
import { formatLength, formatForce } from '../units/units';

/**
 * Responsive SVG side-elevation showing:
 * - Nominal chords (dashed)
 * - Solved parabolic cable profiles (solid) for backstay, unloaded main, loaded main
 * - Force-vector arrows at the master node
 * - Trolley and payload at current position on the loaded cable profile
 */
export function SideView() {
  const scenario = useAppStore((s) => s.scenario);
  const unitSystem = useAppStore((s) => s.unitSystem);
  const trolleyPos = useAppStore((s) => s.trolleyPositionFrac);
  const setTrolleyPos = useAppStore((s) => s.setTrolleyPosition);
  const validation = validateScenario(scenario);

  const site = scenario.site;
  const safe =
    validation.isValid &&
    site.horizontalSpanM > 0 &&
    site.highPointElevationM > 0 &&
    site.launchAnchorOffsetM > 0;

  const result: StaticAnalysisResult | null = useMemo(() => {
    if (!safe) return null;
    try {
      return runStaticAnalysis({ scenario, trolleyPositionFrac: trolleyPos });
    } catch {
      return null;
    }
  }, [scenario, trolleyPos, safe]);

  if (!safe || !result) {
    return (
      <div className="side-view-error">
        Side view unavailable: correct the geometry input errors listed in the warnings panel.
      </div>
    );
  }

  const layout = result.layout;
  const totalX = layout.brakeAnchor.x;
  const maxY = Math.max(layout.masterNode.y, Math.abs(layout.brakeAnchor.y), 1);

  const VBW = 1000;
  const VBH = 520;
  const pad = 60;
  const sx = (VBW - 2 * pad) / totalX;
  const sy = (VBH - 2 * pad) / maxY;
  const scale = Math.min(sx, sy);
  const X = (x: number) => pad + x * scale;
  const Y = (y: number) => VBH - pad - y * scale;

  const la = layout.launchAnchor;
  const mn = layout.masterNode;
  const ba = layout.brakeAnchor;

  const fmt = (m: number) => formatLength(m, unitSystem, 0);
  const fmtF = (n: number) => formatForce(n, unitSystem, 0);

  // Cable profile polylines
  // Backstay: left = launch anchor, right = master node
  // Profile x is from left support, y is relative to left support
  const backstayPath = result.backstay.profile
    .map((p) => `${X(la.x + p.x).toFixed(1)},${Y(la.y + p.y).toFixed(1)}`)
    .join(' ');

  // Main leg unloaded: left = master node (x=mn.x), y relative to node
  const mainUnloadedPath = result.mainLegUnloaded.profile
    .map((p) => `${X(mn.x + p.x).toFixed(1)},${Y(mn.y + p.y).toFixed(1)}`)
    .join(' ');

  // Main leg loaded
  const mainLoadedPath = result.mainLegLoaded.profile
    .map((p) => `${X(mn.x + p.x).toFixed(1)},${Y(mn.y + p.y).toFixed(1)}`)
    .join(' ');

  // Trolley position on loaded cable
  const trolleyPtIdx = Math.min(
    Math.round(trolleyPos * (result.mainLegLoaded.profile.length - 1)),
    result.mainLegLoaded.profile.length - 1,
  );
  const trolleyPt = result.mainLegLoaded.profile[trolleyPtIdx];
  const trolleyAbsX = mn.x + trolleyPt.x;
  const trolleyAbsY = mn.y + trolleyPt.y;

  // Force arrows at master node (scaled for visibility)
  const maxForce = Math.max(
    Math.hypot(result.masterNode.backstayForce.fx, result.masterNode.backstayForce.fy),
    Math.hypot(result.masterNode.mainLegForce.fx, result.masterNode.mainLegForce.fy),
    Math.hypot(result.masterNode.hookReaction.fx, result.masterNode.hookReaction.fy),
    1,
  );
  const arrowScale = 60 / maxForce; // max arrow = 60 SVG units

  function Arrow({ f, color, label }: { f: { fx: number; fy: number }; color: string; label: string }) {
    const dx = f.fx * arrowScale;
    const dy = -f.fy * arrowScale; // SVG y is inverted
    const mag = Math.hypot(dx, dy);
    if (mag < 1) return null;
    return (
      <g>
        <line
          x1={X(mn.x)} y1={Y(mn.y)}
          x2={X(mn.x) + dx} y2={Y(mn.y) + dy}
          stroke={color} strokeWidth={2.5} markerEnd="url(#arrowhead)"
        />
        <text x={X(mn.x) + dx * 1.15} y={Y(mn.y) + dy * 1.15} fill={color} fontSize={10} textAnchor="middle">
          {label}
        </text>
      </g>
    );
  }

  return (
    <div>
      <svg
        className="side-view"
        viewBox={`0 0 ${VBW} ${VBH}`}
        role="img"
        aria-label="Side elevation — static analysis"
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#334155" />
          </marker>
        </defs>

        {/* ground */}
        <line x1={0} y1={Y(0)} x2={VBW} y2={Y(0)} className="ground" />

        {/* brake + capture zones */}
        <rect x={X(layout.brakeZoneStartX)} y={Y(0) - 8}
          width={Math.max(site.brakeZoneLengthM * scale, 1)} height={8} className="brake-zone" />

        {/* nominal chords (dashed reference) */}
        <line x1={X(mn.x)} y1={Y(mn.y)} x2={X(la.x)} y2={Y(la.y)} className="chord backstay" />
        <line x1={X(mn.x)} y1={Y(mn.y)} x2={X(ba.x)} y2={Y(ba.y)} className="chord mainleg" />

        {/* solved cable profiles */}
        <polyline points={backstayPath} className="cable-profile backstay-profile" />
        <polyline points={mainUnloadedPath} className="cable-profile unloaded-profile" />
        <polyline points={mainLoadedPath} className="cable-profile loaded-profile" />

        {/* crane mast */}
        <line x1={X(mn.x)} y1={Y(0)} x2={X(mn.x)} y2={Y(mn.y)} className="crane" />

        {/* anchors */}
        <rect x={X(la.x) - 12} y={Y(la.y) - 10} width={24} height={10} className="anchor" />
        <text x={X(la.x)} y={Y(la.y) + 18} className="lbl" textAnchor="middle">Launch anchor</text>
        <rect x={X(ba.x) - 12} y={Y(ba.y) - 10} width={24} height={10} className="anchor" />
        <text x={X(ba.x)} y={Y(ba.y) + 18} className="lbl" textAnchor="middle">Brake anchor</text>

        {/* master node */}
        <circle cx={X(mn.x)} cy={Y(mn.y)} r={6} className="master-node" />

        {/* force vectors at master node */}
        <Arrow f={result.masterNode.backstayForce} color="#b45309" label={`Backstay ${fmtF(Math.hypot(result.masterNode.backstayForce.fx, result.masterNode.backstayForce.fy))}`} />
        <Arrow f={result.masterNode.mainLegForce} color="#0369a1" label={`Main ${fmtF(Math.hypot(result.masterNode.mainLegForce.fx, result.masterNode.mainLegForce.fy))}`} />
        <Arrow f={result.masterNode.hookReaction} color="#15803d" label={`Hook ${fmtF(result.masterNode.hookResultantN)}`} />

        {/* trolley on loaded cable */}
        <rect x={X(trolleyAbsX) - 8} y={Y(trolleyAbsY) - 5} width={16} height={10} className="trolley" />
        <line x1={X(trolleyAbsX)} y1={Y(trolleyAbsY) + 5}
          x2={X(trolleyAbsX)} y2={Y(Math.max(trolleyAbsY - scenario.trolley.payloadDropM, 0))}
          className="payload-line" />
        <circle cx={X(trolleyAbsX)} cy={Y(Math.max(trolleyAbsY - scenario.trolley.payloadDropM, 0))} r={5} className="payload" />

        {/* dimensions */}
        <g className="dims">
          <line x1={X(mn.x) - 30} y1={Y(0)} x2={X(mn.x) - 30} y2={Y(mn.y)} className="dim" />
          <text x={X(mn.x) - 36} y={Y(mn.y / 2)} className="lbl dim-lbl" textAnchor="end">{fmt(site.highPointElevationM)}</text>
          <line x1={X(mn.x)} y1={Y(0) + 30} x2={X(ba.x)} y2={Y(0) + 30} className="dim" />
          <text x={X((mn.x + ba.x) / 2)} y={Y(0) + 44} className="lbl dim-lbl" textAnchor="middle">
            Span {fmt(site.horizontalSpanM)}
          </text>
        </g>

        {/* legend */}
        <g transform="translate(20,14)" className="lbl">
          <line x1={0} y1={0} x2={30} y2={0} className="chord mainleg" />
          <text x={34} y={4} fontSize={10}>Nominal chord (layout ref)</text>
          <line x1={0} y1={14} x2={30} y2={14} className="cable-profile unloaded-profile" />
          <text x={34} y={18} fontSize={10}>Unloaded cable (parabolic)</text>
          <line x1={0} y1={28} x2={30} y2={28} className="cable-profile loaded-profile" />
          <text x={34} y={32} fontSize={10}>Loaded cable (parabolic)</text>
        </g>
      </svg>

      <div className="trolley-slider">
        <label>
          Trolley position: {(trolleyPos * 100).toFixed(0)}% of main span
          <input
            type="range" min={0} max={1} step={0.01}
            value={trolleyPos}
            onChange={(e) => setTrolleyPos(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
