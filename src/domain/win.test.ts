import { describe, expect, it } from 'vitest';
import { countSolved, isWon } from './win';

describe('win', () => {
  it('requires every piece solved', () => {
    expect(isWon([{ isSolved: true }, { isSolved: true }])).toBe(true);
    expect(isWon([{ isSolved: true }, { isSolved: false }])).toBe(false);
    expect(isWon([])).toBe(false);
  });

  it('counts progress', () => {
    expect(countSolved([{ isSolved: true }, { isSolved: false }, { isSolved: true }])).toEqual({
      solved: 2,
      total: 3,
    });
  });
});
