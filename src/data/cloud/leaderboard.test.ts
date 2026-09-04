import { describe, expect, it } from 'vitest';
import { parseLeaderboard } from './leaderboard';

describe('parseLeaderboard', () => {
  it('reads jsonb objects and numeric strings', () => {
    const board = parseLeaderboard({
      top: [{ rank: '1', nickname: 'Joshep', best_ms: '12345' }],
      my_rank: '1',
      my_ms: '12345',
      my_nickname: 'Joshep',
    });
    expect(board).toEqual({
      top: [{ rank: 1, nickname: 'Joshep', best_ms: 12345 }],
      my_rank: 1,
      my_ms: 12345,
      my_nickname: 'Joshep',
    });
  });

  it('parses a JSON string payload', () => {
    const board = parseLeaderboard(
      JSON.stringify({
        top: [{ rank: 1, nickname: 'Player-ab12', best_ms: 9000 }],
        my_rank: 1,
        my_ms: 9000,
        my_nickname: 'Player-ab12',
      }),
    );
    expect(board?.top[0]?.best_ms).toBe(9000);
    expect(board?.my_rank).toBe(1);
  });

  it('returns empty top without dropping the payload', () => {
    const board = parseLeaderboard({ top: [], my_rank: null, my_ms: null, my_nickname: null });
    expect(board).toEqual({ top: [], my_rank: null, my_ms: null, my_nickname: null });
  });
});
