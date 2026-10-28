// Round state machine and team scoring. Pure: no DOM, camera or timers.
// The shell feeds it time and the latest observations and reacts to events.

import { MOVES, type Move } from './moves';
import { energy, match, sync, type Observation, type Tolerance } from './shape';

export type Phase = 'attract' | 'calibrate' | 'demo' | 'countdown' | 'hold' | 'react' | 'replay' | 'final';

export const DURATION = { demo: 4, countdown: 1.8, hold: 4, react: 3.2, replay: 4.6 } as const;
export const BEAT_TIMES = [0, 0.6, 1.2] as const;
const CALIBRATE_STABLE = 1.5;
const GESTURE_HOLD = 1;
const FINAL_GESTURE_HOLD = 2;
const FINAL_GESTURE_DELAY = 6;
const PEAK_WINDOW = 0.6;
/** Partner round: arms must move at least this far from rest to earn full sync credit. */
const PARTNER_ENERGY = 0.35;

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTY: Record<Difficulty, Tolerance> = {
  easy: { tolerance: 25, range: 70 },
  normal: { tolerance: 18, range: 60 },
  hard: { tolerance: 12, range: 45 },
};
export const STAR_THRESHOLDS = [0.5, 0.65, 0.8] as const;
const SYNC_BONUS = 40;
export const LAUGH_BONUS = 15;

export interface RoundResult {
  moveId: string;
  /** Best rolling team match during the hold, 0..1. */
  match: number;
  /** Rolling sync between the players at that moment, 0..1. */
  sync: number;
  stars: number;
  points: number;
  laughBonus: number;
  /** Seconds into the hold when the peak happened. */
  peakAt: number;
}

export interface GameState {
  phase: Phase;
  /** Seconds since the phase began. */
  t: number;
  round: number;
  results: RoundResult[];
  solo: boolean;
  difficulty: Difficulty;
  /** Timer for whatever the current phase is waiting on (players in place, hands up). */
  ready: number;
  samples: { t: number; team: number; sync: number }[];
  best: { team: number; sync: number; at: number };
  /** Live per-frame values for the HUD. */
  live: { players: number[]; sync: number; team: number };
}

export type GameEvent =
  | { type: 'phase'; phase: Phase }
  | { type: 'beat'; n: number }
  | { type: 'result'; result: RoundResult };

export interface FrameInput {
  dt: number;
  /** Slot 0 = player on the screen's left, slot 1 = right. */
  players: (Observation | null)[];
  /** Host pressed the start key. */
  start: boolean;
}

export function createGame(opts: { solo?: boolean; difficulty?: Difficulty } = {}): GameState {
  return {
    phase: 'attract',
    t: 0,
    round: 0,
    results: [],
    solo: opts.solo ?? false,
    difficulty: opts.difficulty ?? 'easy',
    ready: 0,
    samples: [],
    best: { team: 0, sync: 0, at: 0 },
    live: { players: [0, 0], sync: 0, team: 0 },
  };
}

export function currentMove(s: GameState): Move {
  return MOVES[Math.min(s.round, MOVES.length - 1)]!;
}

export function starsFor(score: number): number {
  return STAR_THRESHOLDS.filter((th) => score >= th).length;
}

export function totalScore(s: GameState): number {
  return s.results.reduce((acc, r) => acc + r.points + r.laughBonus, 0);
}

/** Final trophy: 3 gold, 2 silver, 1 bronze, 0 tin can. */
export function trophyTier(s: GameState): number {
  if (s.results.length === 0) return 0;
  const avg = totalScore(s) / s.results.length;
  if (avg >= 95) return 3;
  if (avg >= 72) return 2;
  if (avg >= 48) return 1;
  return 0;
}

/** Add the Claude-judged laugh bonus to a finished round. */
export function applyLaughBonus(s: GameState, round: number, smiles: number): number {
  const r = s.results[round];
  if (!r) return 0;
  r.laughBonus = Math.max(0, Math.min(2, Math.round(smiles))) * LAUGH_BONUS;
  return r.laughBonus;
}

function requiredPlayers(s: GameState): number {
  return s.solo ? 1 : 2;
}

function present(input: FrameInput): Observation[] {
  return input.players.filter((p): p is Observation => p !== null);
}

function enter(s: GameState, phase: Phase, events: GameEvent[]) {
  s.phase = phase;
  s.t = 0;
  s.ready = 0;
  events.push({ type: 'phase', phase });
}

/** Team score for one frame, plus each player's own score and their sync. */
export function scoreFrame(s: GameState, players: (Observation | null)[]) {
  const tol = DIFFICULTY[s.difficulty];
  const move = currentMove(s);
  const need = requiredPlayers(s);
  const slots = s.solo ? [players.find((p) => p) ?? null] : players.slice(0, 2);
  const a = slots[0] ?? null;
  const b = slots[1] ?? null;
  const pairSync = a && b ? sync(a, b, tol) : 0;

  if (move.partner) {
    if (s.solo) {
      const e = a ? Math.min(1, energy(a.shape) / PARTNER_ENERGY) : 0;
      return { team: e, players: [e, 0], sync: 0 };
    }
    if (!a || !b) return { team: 0, players: [0, 0], sync: pairSync };
    const e = Math.min(1, Math.min(energy(a.shape), energy(b.shape)) / PARTNER_ENERGY);
    const team = pairSync * e;
    return { team, players: [team, team], sync: pairSync };
  }

  const each = slots.map((p) => (p ? match(move.target, p, tol) : 0));
  const team = each.reduce((acc, v) => acc + v, 0) / need;
  return { team, players: [each[0] ?? 0, each[1] ?? 0], sync: pairSync };
}

function rollingPeak(s: GameState, team: number, syncNow: number) {
  s.samples.push({ t: s.t, team, sync: syncNow });
  while (s.samples.length && s.samples[0]!.t < s.t - PEAK_WINDOW) s.samples.shift();
  if (s.t < PEAK_WINDOW * 0.5) return; // wait for a few frames before trusting the average
  const n = s.samples.length;
  const avgTeam = s.samples.reduce((acc, x) => acc + x.team, 0) / n;
  const avgSync = s.samples.reduce((acc, x) => acc + x.sync, 0) / n;
  if (avgTeam > s.best.team) s.best = { team: avgTeam, sync: avgSync, at: s.t };
}

function finishRound(s: GameState): RoundResult {
  const move = currentMove(s);
  const stars = starsFor(s.best.team);
  const syncBonus = move.partner || s.solo || stars === 0 ? 0 : Math.round(s.best.sync * SYNC_BONUS);
  return {
    moveId: move.id,
    match: s.best.team,
    sync: s.best.sync,
    stars,
    points: Math.round(s.best.team * 100) + syncBonus,
    laughBonus: 0,
    peakAt: s.best.at,
  };
}

export function step(s: GameState, input: FrameInput): GameEvent[] {
  const events: GameEvent[] = [];
  const prevT = s.t;
  s.t += input.dt;
  const here = present(input);

  switch (s.phase) {
    case 'attract': {
      const enough = here.length >= requiredPlayers(s);
      s.ready = enough && here.every((p) => p.handsUp) ? s.ready + input.dt : 0;
      if (input.start || s.ready >= GESTURE_HOLD) enter(s, 'calibrate', events);
      break;
    }
    case 'calibrate': {
      const ok = s.solo ? here.length >= 1 : input.players[0] != null && input.players[1] != null;
      s.ready = ok ? s.ready + input.dt : 0;
      if (s.ready >= CALIBRATE_STABLE || input.start) {
        s.round = 0;
        s.results = [];
        enter(s, 'demo', events);
      }
      break;
    }
    case 'demo':
      if (s.t >= DURATION.demo || input.start) enter(s, 'countdown', events);
      break;
    case 'countdown':
      BEAT_TIMES.forEach((bt, i) => {
        if (prevT <= bt && s.t > bt) events.push({ type: 'beat', n: BEAT_TIMES.length - i });
      });
      if (s.t >= DURATION.countdown) {
        s.samples = [];
        s.best = { team: 0, sync: 0, at: 0 };
        enter(s, 'hold', events);
      }
      break;
    case 'hold': {
      const f = scoreFrame(s, input.players);
      s.live = f;
      rollingPeak(s, f.team, f.sync);
      if (s.t >= DURATION.hold) {
        const result = finishRound(s);
        s.results.push(result);
        events.push({ type: 'result', result });
        enter(s, 'react', events);
      }
      break;
    }
    case 'react':
      if (s.t >= DURATION.react || input.start) enter(s, 'replay', events);
      break;
    case 'replay':
      if (s.t >= DURATION.replay || input.start) {
        if (s.round + 1 >= MOVES.length) enter(s, 'final', events);
        else {
          s.round += 1;
          enter(s, 'demo', events);
        }
      }
      break;
    case 'final': {
      // Ignore celebrating arms for the first few seconds of the final screen.
      const gesture = s.t > FINAL_GESTURE_DELAY && here.length > 0 && here.every((p) => p.handsUp);
      s.ready = gesture ? s.ready + input.dt : 0;
      if (input.start || s.ready >= FINAL_GESTURE_HOLD) {
        const fresh = createGame({ solo: s.solo, difficulty: s.difficulty });
        Object.assign(s, fresh);
        events.push({ type: 'phase', phase: 'attract' });
      }
      break;
    }
  }
  return events;
}
