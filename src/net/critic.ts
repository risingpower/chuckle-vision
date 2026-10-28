// Browser side of the Silent Critic. Never blocks the game: any failure or a
// slow answer resolves to null and the local verdict stands.

import { parseVerdict, type Verdict } from '../core/judging';

const TIMEOUT_MS = 15_000;

export async function askCritic(image: string, move: string): Promise<Verdict | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('/api/critic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, move }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return parseVerdict(await res.json());
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}
