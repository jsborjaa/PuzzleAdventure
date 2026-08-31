import { describe, expect, it } from 'vitest';
import { makePieceId, parsePieceId } from './pieceId';

describe('pieceId', () => {
  it('round-trips level:col:row', () => {
    const id = makePieceId('level_1', 3, 2);
    expect(id).toBe('level_1:3:2');
    expect(parsePieceId(id)).toEqual({ levelId: 'level_1', col: 3, row: 2 });
  });

  it('keeps event ids with underscores', () => {
    const id = makePieceId('event_daily', 10, 4);
    expect(parsePieceId(id)).toEqual({ levelId: 'event_daily', col: 10, row: 4 });
  });
});
