// The move library. Each move is stored once: the same target Shape animates
// the mascot during the demo and is what players are scored against.
//
// Cultural guardrails (see docs/SPEC.md): no hand signs, no pointing, no
// touching, no hip or chest moves, no pig/dog/cow impressions, no prayer poses.

import { REST, flip, type Shape, type SegmentKey } from './shape';

export type MoveStyle = 'pump' | 'jerk' | 'flap' | 'punch' | 'wobble' | 'mirror' | 'arch';

export interface Move {
  id: string;
  /** Icon shown beside the mascot; symbols only, never words. */
  icon: string;
  style: MoveStyle;
  target: Shape;
  /** Scored on how alike the two players are, not on matching the mascot. */
  partner?: boolean;
  /** Shown as two mascots facing each other (left one does `target`, right one its mirror). */
  duo?: boolean;
}

export const MOVES: readonly Move[] = [
  {
    id: 'starfish',
    icon: '⭐',
    style: 'pump',
    target: { torso: -90, lUpper: -150, lFore: -150, rUpper: -30, rFore: -30 },
  },
  {
    id: 'robot',
    icon: '🤖',
    style: 'jerk',
    target: { torso: -90, lUpper: 180, lFore: -90, rUpper: 0, rFore: -90 },
  },
  {
    id: 'chicken',
    icon: '🐔',
    style: 'flap',
    target: { torso: -90, lUpper: 160, lFore: -20, rUpper: 20, rFore: -160 },
  },
  {
    id: 'superhero',
    icon: '🦸',
    style: 'punch',
    target: { torso: -90, lUpper: -95, lFore: -92, rUpper: 45, rFore: 135 },
  },
  {
    id: 'dodge',
    icon: '💨',
    style: 'wobble',
    target: { torso: -62, lUpper: -125, lFore: -165, rUpper: -25, rFore: 15 },
  },
  {
    id: 'partner',
    icon: '🪞',
    style: 'mirror',
    target: { torso: -90, lUpper: -140, lFore: -60, rUpper: 30, rFore: 80 },
    partner: true,
    duo: true,
  },
  {
    id: 'arch',
    icon: '🌈',
    style: 'arch',
    target: { torso: -65, lUpper: 135, lFore: 45, rUpper: -70, rFore: -20 },
    duo: true,
  },
];

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function lerpShape(a: Shape, b: Shape, k: number): Shape {
  const out = { ...a };
  for (const key of Object.keys(a) as SegmentKey[]) {
    let d = b[key] - a[key];
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    out[key] = a[key] + d * k;
  }
  return out;
}

function add(s: Shape, delta: Partial<Shape>): Shape {
  const out = { ...s };
  for (const key of Object.keys(delta) as SegmentKey[]) out[key] += delta[key] ?? 0;
  return out;
}

const SETTLE = 0.8;

/**
 * The mascot's pose `t` seconds into a demo lasting `duration`. It eases out of
 * rest, performs the move's flourish, then settles exactly on the target so the
 * freeze frame players copy is the scored shape.
 */
export function demoShape(move: Move, t: number, duration: number): Shape {
  const enter = ease(t / 0.7);
  const base = lerpShape(REST, move.target, enter);
  const settle = ease((duration - t) / SETTLE);
  const w = Math.min(enter, settle);
  const wave = (hz: number, amp: number) => Math.sin(t * hz * Math.PI * 2) * amp * w;
  switch (move.style) {
    case 'pump':
      return add(base, { lUpper: wave(2.5, 14), lFore: wave(2.5, 18), rUpper: -wave(2.5, 14), rFore: -wave(2.5, 18) });
    case 'jerk': {
      const step = Math.floor(t / 0.35) % 2 === 0 ? 1 : -1;
      return add(base, { lFore: step * 22 * w, rFore: -step * 22 * w, torso: step * 4 * w });
    }
    case 'flap':
      return add(base, { lUpper: wave(4, 28), rUpper: -wave(4, 28), torso: wave(2, 5) });
    case 'punch':
      return add(base, { lUpper: wave(2, 10), lFore: wave(2, 16), torso: wave(1, 4) });
    case 'wobble':
      return add(base, { torso: wave(0.6, 14), lFore: wave(1.2, 30), rFore: wave(1.4, 30) });
    case 'arch':
      return add(base, { torso: wave(0.8, 8), rUpper: wave(0.8, 10) });
    case 'mirror':
      return add(base, { lUpper: wave(1, 25), rFore: wave(1.3, 35) });
  }
}

/** Shape for the right-hand mascot of a duo: always the mirror of the left one. */
export function duoPartner(s: Shape): Shape {
  return flip(s);
}
