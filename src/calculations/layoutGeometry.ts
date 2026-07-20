/**
 * Layout geometry helpers for the Milestone 1 system-layout view.
 *
 * Scope note: per MILESTONE_01, no cable-force equations are implemented.
 * These functions produce only straight-line reference geometry (nominal
 * chords), which is site-layout information, NOT the operating cable
 * profile. Later milestones replace the chords with solved cable shapes.
 */
import type { SiteGeometry } from '../models/scenario';

export interface Point {
  x: number; // m, horizontal, positive downrange from launch station
  y: number; // m, elevation above launch-station ground
}

export interface LayoutGeometry {
  launchAnchor: Point;
  masterNode: Point;
  brakeAnchor: Point;
  /** Nominal chord angle of the main (downhill) leg, degrees below horizontal */
  mainLegNominalAngleDeg: number;
  /** Nominal chord angle of the launch-side backstay, degrees below horizontal */
  backstayNominalAngleDeg: number;
  /** Straight-line chord length of the main leg, m */
  mainLegChordLengthM: number;
  /** Straight-line chord length of the backstay, m */
  backstayChordLengthM: number;
  /** Downrange start of the brake zone, m */
  brakeZoneStartX: number;
}

export function chordLength(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Angle of the line from a (higher) to b (lower), degrees below horizontal. */
export function depressionAngleDeg(a: Point, b: Point): number {
  const dx = Math.abs(b.x - a.x);
  const dy = a.y - b.y;
  if (dx === 0) return dy === 0 ? 0 : 90;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Computes nominal layout geometry from site inputs.
 * Master node sits at x = launchAnchorOffset (station of the crane high point),
 * launch anchor at x = 0, brake anchor at x = launchAnchorOffset + span.
 */
export function computeLayout(site: SiteGeometry): LayoutGeometry {
  const launchAnchor: Point = { x: 0, y: 0 };
  const masterNode: Point = {
    x: site.launchAnchorOffsetM,
    y: site.highPointElevationM,
  };
  const brakeAnchor: Point = {
    x: site.launchAnchorOffsetM + site.horizontalSpanM,
    y: site.brakeAnchorElevationM,
  };

  return {
    launchAnchor,
    masterNode,
    brakeAnchor,
    mainLegNominalAngleDeg: depressionAngleDeg(masterNode, brakeAnchor),
    backstayNominalAngleDeg: depressionAngleDeg(masterNode, launchAnchor),
    mainLegChordLengthM: chordLength(masterNode, brakeAnchor),
    backstayChordLengthM: chordLength(masterNode, launchAnchor),
    brakeZoneStartX: brakeAnchor.x - site.brakeZoneLengthM,
  };
}
