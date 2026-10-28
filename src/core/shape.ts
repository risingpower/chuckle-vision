// Body shapes as limb directions in mirrored screen space.
// Angles are degrees: 0 = pointing right, 90 = down, -90 = up.
// "l" and "r" are screen sides as players see themselves in the mirrored feed,
// so a mascot arm on the screen's left should be copied with the arm that
// appears on the screen's left.

export interface Shape {
  torso: number; // hip centre -> shoulder centre
  lUpper: number; // shoulder -> elbow
  lFore: number; // elbow -> wrist
  rUpper: number;
  rFore: number;
}

export type SegmentKey = keyof Shape;
export const SEGMENTS: readonly SegmentKey[] = ['torso', 'lUpper', 'lFore', 'rUpper', 'rFore'];

export const REST: Shape = { torso: -90, lUpper: 100, lFore: 95, rUpper: 80, rFore: 85 };

/** One tracked player, already converted out of landmark space. */
export interface Observation {
  shape: Shape;
  seen: Record<SegmentKey, boolean>;
  /** Horizontal centre in mirrored feed coordinates (0 = screen left, 1 = screen right). */
  centerX: number;
  /** Both wrists above the nose. */
  handsUp: boolean;
}

export interface Tolerance {
  /** Error in degrees that still counts as perfect. */
  tolerance: number;
  /** Extra degrees over which a segment's score falls from 1 to 0. */
  range: number;
}

export interface Landmark {
  x: number;
  y: number;
  visibility?: number;
}

const WEIGHT: Record<SegmentKey, number> = { torso: 0.6, lUpper: 1, lFore: 0.8, rUpper: 1, rFore: 0.8 };
const UNSEEN_ARM_CREDIT = 0.2;
const MIN_VISIBILITY = 0.5;

export function normAngle(a: number): number {
  let r = a % 360;
  if (r > 180) r -= 360;
  if (r <= -180) r += 360;
  return r;
}

export function angleDiff(a: number, b: number): number {
  return Math.abs(normAngle(a - b));
}

/** Mirror a shape left-to-right: swap sides and reflect every direction. */
export function flip(s: Shape): Shape {
  const m = (a: number) => normAngle(180 - a);
  return { torso: m(s.torso), lUpper: m(s.rUpper), lFore: m(s.rFore), rUpper: m(s.lUpper), rFore: m(s.lFore) };
}

const ALL_SEEN: Record<SegmentKey, boolean> = { torso: true, lUpper: true, lFore: true, rUpper: true, rFore: true };

function segmentScore(diff: number, tol: Tolerance): number {
  return Math.min(1, Math.max(0, 1 - (diff - tol.tolerance) / tol.range));
}

/**
 * How closely `actual` matches `target`, 0..1. A torso the camera can't see is
 * left out (players standing close often lose their hips); an unseen arm
 * segment gets a little credit so one flicker doesn't zero the score.
 */
export function similarity(target: Shape, actual: Shape, seen: Record<SegmentKey, boolean> = ALL_SEEN, tol: Tolerance): number {
  let sum = 0;
  let weight = 0;
  for (const k of SEGMENTS) {
    if (!seen[k]) {
      if (k === 'torso') continue;
      sum += WEIGHT[k] * UNSEEN_ARM_CREDIT;
    } else {
      sum += WEIGHT[k] * segmentScore(angleDiff(target[k], actual[k]), tol);
    }
    weight += WEIGHT[k];
  }
  return weight === 0 ? 0 : sum / weight;
}

/** Match against the target or its mirror image, whichever the player chose. */
export function match(target: Shape, obs: Observation, tol: Tolerance): number {
  return Math.max(similarity(target, obs.shape, obs.seen, tol), similarity(flip(target), obs.shape, obs.seen, tol));
}

/** How alike two players look, allowing either to be the other's mirror image. */
export function sync(a: Observation, b: Observation, tol: Tolerance): number {
  const seen = {} as Record<SegmentKey, boolean>;
  for (const k of SEGMENTS) seen[k] = a.seen[k] && b.seen[k];
  return Math.max(similarity(a.shape, b.shape, seen, tol), similarity(flip(a.shape), b.shape, seen, tol));
}

/** How far the arms are from hanging at rest, 0..1. Stops "both standing still" counting as a match. */
export function energy(s: Shape): number {
  const arms: SegmentKey[] = ['lUpper', 'lFore', 'rUpper', 'rFore'];
  const mean = arms.reduce((acc, k) => acc + angleDiff(s[k], REST[k]), 0) / arms.length;
  return Math.min(1, mean / 90);
}

// MediaPipe pose landmark indices.
const NOSE = 0;
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_ELBOW = 13;
const R_ELBOW = 14;
const L_WRIST = 15;
const R_WRIST = 16;
const L_HIP = 23;
const R_HIP = 24;

/**
 * Convert MediaPipe landmarks (normalised, unmirrored camera image) into an
 * Observation in mirrored screen space. `aspect` is video width / height, so
 * angles are measured in real proportions rather than stretched units.
 */
export function observe(lm: readonly Landmark[], aspect: number): Observation | null {
  const p = (i: number) => {
    const l = lm[i];
    if (!l) return null;
    return { x: (1 - l.x) * aspect, y: l.y, ok: (l.visibility ?? 1) >= MIN_VISIBILITY };
  };
  const ls = p(L_SHOULDER), rs = p(R_SHOULDER), le = p(L_ELBOW), re = p(R_ELBOW);
  const lw = p(L_WRIST), rw = p(R_WRIST), lh = p(L_HIP), rh = p(R_HIP), nose = p(NOSE);
  if (!ls || !rs || !le || !re || !lw || !rw || !lh || !rh || !nose) return null;
  if (!ls.ok || !rs.ok) return null;

  const dir = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  // Subject's left lands on the screen's left once mirrored.
  const shape: Shape = {
    torso: lh.ok && rh.ok ? dir(mid(lh, rh), mid(ls, rs)) : -90,
    lUpper: dir(ls, le),
    lFore: dir(le, lw),
    rUpper: dir(rs, re),
    rFore: dir(re, rw),
  };
  const seen: Record<SegmentKey, boolean> = {
    torso: lh.ok && rh.ok,
    lUpper: le.ok,
    lFore: le.ok && lw.ok,
    rUpper: re.ok,
    rFore: re.ok && rw.ok,
  };
  const handsUp = lw.ok && rw.ok && lw.y < nose.y && rw.y < nose.y;
  return { shape, seen, centerX: (ls.x + rs.x) / 2 / aspect, handsUp };
}
