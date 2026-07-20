import { useAppStore } from '../state/store';
import { computeLayout } from '../calculations/layoutGeometry';
import { formatLength } from '../units/units';

/**
 * Responsive SVG side-elevation of the nominal system layout.
 *
 * NOTE: cable legs are drawn as straight NOMINAL CHORDS (dashed).
 * These are site-layout references only — the true loaded cable profile
 * (sag, tension) is implemented in later milestones and will be drawn
 * as a distinct solid curve.
 */
export function SideView() {
  const scenario = useAppStore((s) => s.scenario);
  const unitSystem = useAppStore((s) => s.unitSystem);

  const site = scenario.site;
  const safe =
    Number.isFinite(site.horizontalSpanM) &&
    site.horizontalSpanM > 0 &&
    Number.isFinite(site.highPointElevationM) &&
    site.highPointElevationM > 0 &&
    Number.isFinite(site.launchAnchorOffsetM) &&
    site.launchAnchorOffsetM > 0;

  if (!safe) {
    return (
      <div className="side-view-error">
        Side view unavailable: correct the geometry input errors listed in the warnings panel.
      </div>
    );
  }

  const layout = computeLayout(site);
  const totalX = layout.brakeAnchor.x;
  const maxY = Math.max(layout.masterNode.y, layout.brakeAnchor.y, 1);

  // world -> viewBox transform (padding in viewBox units)
  const VBW = 1000;
  const VBH = 480;
  const pad = 60;
  const sx = (VBW - 2 * pad) / totalX;
  const sy = (VBH - 2 * pad) / maxY;
  const scale = Math.min(sx, sy);
  const X = (x: number) => pad + x * scale;
  const Y = (y: number) => VBH - pad - y * scale;

  const la = layout.launchAnchor;
  const mn = layout.masterNode;
  const ba = layout.brakeAnchor;

  // Trolley shown at 30% of main span along the nominal chord (illustrative)
  const tFrac = 0.3;
  const trolleyX = mn.x + (ba.x - mn.x) * tFrac;
  const trolleyY = mn.y + (ba.y - mn.y) * tFrac;

  const fmt = (m: number) => formatLength(m, unitSystem, 0);

  return (
    <svg
      className="side-view"
      viewBox={`0 0 ${VBW} ${VBH}`}
      role="img"
      aria-label="Side elevation of the test system layout"
    >
      {/* ground line */}
      <line x1={0} y1={Y(0)} x2={VBW} y2={Y(0)} className="ground" />
      <text x={VBW - pad} y={Y(0) + 18} className="lbl ground-lbl" textAnchor="end">
        Ground
      </text>

      {/* brake + capture zones */}
      <rect
        x={X(layout.brakeZoneStartX)}
        y={Y(0) - 8}
        width={Math.max(site.brakeZoneLengthM * scale, 1)}
        height={8}
        className="brake-zone"
      />
      <rect
        x={X(ba.x - site.brakeZoneLengthM - site.captureZoneLengthM)}
        y={Y(0) - 4}
        width={Math.max(site.captureZoneLengthM * scale, 1)}
        height={4}
        className="capture-zone"
      />
      <text x={X(layout.brakeZoneStartX)} y={Y(0) + 18} className="lbl">
        Brake zone {fmt(site.brakeZoneLengthM)}
      </text>

      {/* crane mast (simplified) */}
      <line x1={X(mn.x)} y1={Y(0)} x2={X(mn.x)} y2={Y(mn.y)} className="crane" />
      <text x={X(mn.x) + 8} y={Y(mn.y / 2)} className="lbl">
        Crane / high point
      </text>

      {/* nominal chords (dashed = NOT the cable profile) */}
      <line x1={X(mn.x)} y1={Y(mn.y)} x2={X(la.x)} y2={Y(la.y)} className="chord backstay" />
      <line x1={X(mn.x)} y1={Y(mn.y)} x2={X(ba.x)} y2={Y(ba.y)} className="chord mainleg" />

      {/* anchors */}
      <g>
        <rect x={X(la.x) - 12} y={Y(la.y) - 10} width={24} height={10} className="anchor" />
        <text x={X(la.x)} y={Y(la.y) + 18} className="lbl" textAnchor="middle">
          Launch anchor
        </text>
      </g>
      <g>
        <rect x={X(ba.x) - 12} y={Y(ba.y) - 10} width={24} height={10} className="anchor" />
        <text x={X(ba.x)} y={Y(ba.y) + 18} className="lbl" textAnchor="middle">
          Brake anchor
        </text>
      </g>

      {/* master node */}
      <circle cx={X(mn.x)} cy={Y(mn.y)} r={6} className="master-node" />

      {/* trolley (illustrative position on nominal chord) */}
      <g>
        <rect x={X(trolleyX) - 8} y={Y(trolleyY) - 5} width={16} height={10} className="trolley" />
        <line
          x1={X(trolleyX)}
          y1={Y(trolleyY) + 5}
          x2={X(trolleyX)}
          y2={Y(Math.max(trolleyY - scenario.trolley.payloadDropM, 0))}
          className="payload-line"
        />
        <circle
          cx={X(trolleyX)}
          cy={Y(Math.max(trolleyY - scenario.trolley.payloadDropM, 0))}
          r={5}
          className="payload"
        />
        <text x={X(trolleyX) + 12} y={Y(trolleyY) - 8} className="lbl">
          Trolley (illustrative)
        </text>
      </g>

      {/* dimensions */}
      <g className="dims">
        {/* height dimension */}
        <line x1={X(mn.x) - 30} y1={Y(0)} x2={X(mn.x) - 30} y2={Y(mn.y)} className="dim" />
        <text x={X(mn.x) - 36} y={Y(mn.y / 2)} className="lbl dim-lbl" textAnchor="end">
          {fmt(site.highPointElevationM)}
        </text>
        {/* span dimension */}
        <line x1={X(mn.x)} y1={Y(0) + 30} x2={X(ba.x)} y2={Y(0) + 30} className="dim" />
        <text x={X((mn.x + ba.x) / 2)} y={Y(0) + 44} className="lbl dim-lbl" textAnchor="middle">
          Span {fmt(site.horizontalSpanM)} — nominal {layout.mainLegNominalAngleDeg.toFixed(1)}°
        </text>
        {/* backstay dimension */}
        <line x1={X(la.x)} y1={Y(0) + 30} x2={X(mn.x)} y2={Y(0) + 30} className="dim alt" />
        <text x={X((la.x + mn.x) / 2)} y={Y(0) + 44} className="lbl dim-lbl" textAnchor="middle">
          {fmt(site.launchAnchorOffsetM)}
        </text>
      </g>

      <text x={pad} y={24} className="lbl note">
        Dashed lines are nominal geometric chords (site layout only) — not the loaded cable profile.
      </text>
    </svg>
  );
}
