import { describe, expect, it } from 'vitest';
import { localVerdict, parseVerdict } from '../src/core/judging';

describe('judging', () => {
  it('accepts a valid verdict and clamps numbers', () => {
    expect(parseVerdict({ award: '🐔', judges: [12, 7.4, 0], smiles: 5 })).toEqual({
      award: '🐔', judges: [10, 7, 1], smiles: 2, source: 'claude',
    });
  });

  it('rejects awards outside the allowed list', () => {
    expect(parseVerdict({ award: '👍', judges: [5, 5, 5], smiles: 0 })).toBeNull();
    expect(parseVerdict('nope')).toBeNull();
  });

  it('makes the third judge the stingy one', () => {
    const v = localVerdict(0.9, '🤖');
    expect(v.award).toBe('🤖');
    expect(v.judges[2]).toBeLessThan(v.judges[0]);
  });
});
