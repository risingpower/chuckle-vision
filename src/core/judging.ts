// The judging panel's verdict, from Claude when it answers in time, otherwise
// worked out locally so the game never waits on the network.

/** Awards Claude may hand out. A fixed list keeps every symbol culturally safe. */
export const AWARDS = ['🏆', '🌟', '🔥', '🎭', '🦸', '🤖', '🐔', '🦩', '🐧', '🌈', '🎉', '🚀', '🧊', '🌪️', '👑', '🥇'] as const;
export type Award = (typeof AWARDS)[number];

export interface Verdict {
  award: Award;
  /** Three judges' cards, 1..10. The third judge is the hard-to-please one. */
  judges: [number, number, number];
  /** People visibly smiling or laughing, 0..2. */
  smiles: number;
  source: 'claude' | 'local';
}

const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(hi, Math.max(lo, n));
};

/** Validate whatever came back from the server; null if it isn't usable. */
export function parseVerdict(raw: unknown): Verdict | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const award = AWARDS.find((a) => a === r.award);
  if (!award || !Array.isArray(r.judges) || r.judges.length < 3) return null;
  const j = r.judges.slice(0, 3).map((v) => clampInt(v, 1, 10, 5)) as [number, number, number];
  return { award, judges: j, smiles: clampInt(r.smiles, 0, 2, 0), source: 'claude' };
}

/** Deterministic stand-in when Claude is unavailable. */
export function localVerdict(match: number, moveIcon: string): Verdict {
  const base = 3 + match * 7;
  const card = (v: number) => clampInt(v, 1, 10, 5);
  const award = (AWARDS as readonly string[]).includes(moveIcon) ? (moveIcon as Award) : match >= 0.8 ? '🏆' : '🌟';
  return { award, judges: [card(base + 0.6), card(base), card(base - 2.2)], smiles: 0, source: 'local' };
}
