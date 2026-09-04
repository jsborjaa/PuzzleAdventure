import { describe, expect, it } from 'vitest';
import { campaignRankForPieces, getDifficultyForLevel } from './campaignDifficulty';

describe('campaign difficulty curve', () => {
  it('keeps early levels on the original schedule', () => {
    expect(getDifficultyForLevel(1)).toBe(16);
    expect(getDifficultyForLevel(5)).toBe(64);
    expect(getDifficultyForLevel(10)).toBe(64);
  });

  it('is stable for a later decade bag and only uses 36/64/128', () => {
    expect(getDifficultyForLevel(11)).toBe(getDifficultyForLevel(11));
    expect([36, 64, 128]).toContain(getDifficultyForLevel(25));
    for (let n = 11; n <= 110; n++) {
      const count = getDifficultyForLevel(n);
      expect([36, 64, 128]).toContain(count);
      expect(count).not.toBe(100);
    }
  });

  it('maps piece counts to C/B/A/S', () => {
    expect(campaignRankForPieces(16)).toBe('C');
    expect(campaignRankForPieces(36)).toBe('B');
    expect(campaignRankForPieces(64)).toBe('A');
    expect(campaignRankForPieces(128)).toBe('S');
    expect(campaignRankForPieces(200)).toBeNull();
  });
});
