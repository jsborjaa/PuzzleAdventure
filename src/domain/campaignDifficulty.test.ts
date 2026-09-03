import { describe, expect, it } from 'vitest';
import { getDifficultyForLevel } from './campaignDifficulty';

describe('campaign difficulty curve', () => {
  it('keeps early levels on the original schedule', () => {
    expect(getDifficultyForLevel(1)).toBe(16);
    expect(getDifficultyForLevel(5)).toBe(64);
    expect(getDifficultyForLevel(10)).toBe(64);
  });

  it('is stable for a later decade bag', () => {
    expect(getDifficultyForLevel(11)).toBe(getDifficultyForLevel(11));
    expect([36, 64, 100]).toContain(getDifficultyForLevel(25));
  });
});
