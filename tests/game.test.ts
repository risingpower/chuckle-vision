import { describe, expect, it } from 'vitest';
import { DURATION, applyLaughBonus, createGame, currentMove, step, totalScore, trophyTier, type FrameInput, type GameEvent, type GameState } from '../src/core/game';
import { MOVES } from '../src/core/moves';
import { REST, flip, type Observation, type Shape } from '../src/core/shape';

const allSeen = { torso: true, lUpper: true, lFore: true, rUpper: true, rFore: true };
const obs = (shape: Shape, centerX: number, handsUp = false): Observation => ({ shape, seen: { ...allSeen }, centerX, handsUp });
const DT = 1 / 60;

function run(s: GameState, seconds: number, players: (g: GameState) => (Observation | null)[], start = false) {
  const events: GameEvent[] = [];
  for (let t = 0; t < seconds; t += DT) {
    const input: FrameInput = { dt: DT, players: players(s), start: start && t === 0 };
    events.push(...step(s, input));
  }
  return events;
}

const perfect = (s: GameState) => {
  const m = currentMove(s);
  return [obs(m.target, 0.3), obs(m.partner ? flip(m.target) : m.target, 0.7)];
};
const idle = () => [obs(REST, 0.3), obs(REST, 0.7)];

function runUntil(s: GameState, phase: GameState['phase'], players: (g: GameState) => (Observation | null)[]) {
  for (let i = 0; i < 60 * 30 && s.phase !== phase; i++) step(s, { dt: DT, players: players(s), start: false });
  expect(s.phase).toBe(phase);
}

function toFirstHold(s: GameState, players: (g: GameState) => (Observation | null)[] = perfect) {
  run(s, DT, players, true); // attract -> calibrate
  runUntil(s, 'demo', players);
  runUntil(s, 'hold', players);
}

describe('round flow', () => {
  it('starts on the hands-up gesture', () => {
    const s = createGame();
    run(s, 1.2, () => [obs(REST, 0.3, true), obs(REST, 0.7, true)]);
    expect(s.phase).toBe('calibrate');
  });

  it('waits in calibration until both players are in place', () => {
    const s = createGame();
    run(s, DT, idle, true);
    run(s, 3, () => [obs(REST, 0.3), null]);
    expect(s.phase).toBe('calibrate');
    run(s, 2, idle);
    expect(s.phase).toBe('demo');
  });

  it('plays three countdown beats', () => {
    const s = createGame();
    run(s, DT, idle, true);
    runUntil(s, 'demo', idle);
    const events = run(s, DURATION.demo + DURATION.countdown, idle);
    expect(events.filter((e) => e.type === 'beat').map((e) => (e as { n: number }).n)).toEqual([3, 2, 1]);
  });

  it('awards three stars for a perfect copy', () => {
    const s = createGame();
    toFirstHold(s);
    expect(s.phase).toBe('hold');
    const events = run(s, DURATION.hold, perfect);
    const result = events.find((e) => e.type === 'result');
    expect(result && result.type === 'result' && result.result.stars).toBe(3);
    expect(s.phase).toBe('react');
  });

  it('awards no stars when players stand still', () => {
    const s = createGame();
    toFirstHold(s, idle);
    run(s, DURATION.hold, idle);
    expect(s.results[0]!.stars).toBe(0);
    expect(s.results[0]!.points).toBeLessThan(40);
  });

  it('scores a missing player as zero for the team', () => {
    const s = createGame();
    toFirstHold(s);
    run(s, DURATION.hold, (g) => [perfect(g)[0]!, null]);
    expect(s.results[0]!.match).toBeCloseTo(0.5, 1);
  });

  it('plays every move then reaches the final screen', () => {
    const s = createGame();
    toFirstHold(s);
    for (let i = 0; i < MOVES.length; i++) {
      runUntil(s, 'react', perfect);
      runUntil(s, i < MOVES.length - 1 ? 'hold' : 'final', perfect);
    }
    expect(s.phase).toBe('final');
    expect(s.results).toHaveLength(MOVES.length);
    expect(trophyTier(s)).toBe(3);
  });

  it('does not let idle twins pass the partner round', () => {
    const s = createGame();
    s.round = MOVES.findIndex((m) => m.partner);
    s.phase = 'countdown';
    runUntil(s, 'hold', idle);
    runUntil(s, 'react', idle);
    expect(s.results[0]!.stars).toBe(0);
  });

  it('adds the laugh bonus to the total', () => {
    const s = createGame();
    toFirstHold(s);
    run(s, DURATION.hold, perfect);
    const before = totalScore(s);
    applyLaughBonus(s, 0, 2);
    expect(totalScore(s)).toBe(before + 30);
  });

  it('solo mode needs only one player', () => {
    const s = createGame({ solo: true });
    toFirstHold(s, (g) => [obs(currentMove(g).target, 0.5), null]);
    run(s, DURATION.hold, (g) => [obs(currentMove(g).target, 0.5), null]);
    expect(s.results[0]!.stars).toBe(3);
  });
});
