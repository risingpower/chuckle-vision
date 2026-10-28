import { describe, expect, it } from 'vitest';
import { REST, angleDiff, energy, flip, match, observe, similarity, sync, type Observation, type Shape } from '../src/core/shape';
import { DIFFICULTY } from '../src/core/game';
import { MOVES, demoShape } from '../src/core/moves';

const tol = DIFFICULTY.normal;
const allSeen = { torso: true, lUpper: true, lFore: true, rUpper: true, rFore: true };
const obs = (shape: Shape, centerX = 0.3): Observation => ({ shape, seen: { ...allSeen }, centerX, handsUp: false });
const starfish = MOVES.find((m) => m.id === 'starfish')!.target;
const superhero = MOVES.find((m) => m.id === 'superhero')!.target;

describe('shape matching', () => {
  it('scores an exact copy as perfect', () => {
    expect(similarity(starfish, starfish, allSeen, tol)).toBe(1);
  });

  it('scores standing at rest poorly against an active move', () => {
    expect(match(starfish, obs(REST), tol)).toBeLessThan(0.3);
  });

  it('accepts the mirror image of an asymmetric move', () => {
    expect(match(superhero, obs(flip(superhero)), tol)).toBe(1);
  });

  it('tolerates small errors', () => {
    const near = { ...starfish, lUpper: starfish.lUpper + 15, rFore: starfish.rFore - 15 };
    expect(match(starfish, obs(near), tol)).toBe(1);
  });

  it('flip is its own inverse', () => {
    const back = flip(flip(superhero));
    for (const k of Object.keys(superhero) as (keyof Shape)[]) expect(back[k]).toBeCloseTo(superhero[k]);
  });

  it('ignores an unseen torso instead of penalising it', () => {
    const o = obs({ ...starfish, torso: 0 });
    o.seen.torso = false;
    expect(match(starfish, o, tol)).toBe(1);
  });

  it('measures sync between mirror-image players', () => {
    expect(sync(obs(superhero), obs(flip(superhero)), tol)).toBe(1);
  });

  it('gives resting arms no energy', () => {
    expect(energy(REST)).toBe(0);
    expect(energy(starfish)).toBeGreaterThan(0.5);
  });
});

describe('mascot demo', () => {
  it('ends every demo exactly on the scored target', () => {
    for (const m of MOVES) {
      const s = demoShape(m, 4, 4);
      for (const k of Object.keys(m.target) as (keyof Shape)[]) expect(angleDiff(s[k], m.target[k])).toBeCloseTo(0, 5);
    }
  });
});

describe('observe', () => {
  // Build landmarks for a person with arms straight out sideways (a T shape), unmirrored camera image.
  function tPose() {
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
    lm[0] = { x: 0.5, y: 0.2, visibility: 1 }; // nose
    lm[11] = { x: 0.6, y: 0.35, visibility: 1 }; // subject's left shoulder is on image right
    lm[12] = { x: 0.4, y: 0.35, visibility: 1 };
    lm[13] = { x: 0.7, y: 0.35, visibility: 1 };
    lm[14] = { x: 0.3, y: 0.35, visibility: 1 };
    lm[15] = { x: 0.8, y: 0.35, visibility: 1 };
    lm[16] = { x: 0.2, y: 0.35, visibility: 1 };
    lm[23] = { x: 0.57, y: 0.7, visibility: 1 };
    lm[24] = { x: 0.43, y: 0.7, visibility: 1 };
    return lm;
  }

  it('maps the subject\'s left arm to the screen left after mirroring', () => {
    const o = observe(tPose(), 16 / 9)!;
    expect(Math.abs(o.shape.lUpper)).toBeCloseTo(180);
    expect(o.shape.rUpper).toBeCloseTo(0);
    expect(o.shape.torso).toBeCloseTo(-90);
    expect(o.centerX).toBeCloseTo(0.5);
  });

  it('detects hands above the head', () => {
    const lm = tPose();
    lm[15] = { x: 0.62, y: 0.1, visibility: 1 };
    lm[16] = { x: 0.38, y: 0.1, visibility: 1 };
    expect(observe(lm, 16 / 9)!.handsUp).toBe(true);
    expect(observe(tPose(), 16 / 9)!.handsUp).toBe(false);
  });

  it('returns null when shoulders are not visible', () => {
    const lm = tPose();
    lm[11] = { ...lm[11]!, visibility: 0.1 };
    expect(observe(lm, 16 / 9)).toBeNull();
  });
});
