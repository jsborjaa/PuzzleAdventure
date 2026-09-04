import { describe, expect, it } from 'vitest';
import { boardShape } from './boardShape';

describe('boardShape', () => {
  it('treats near-equal sides as square', () => {
    expect(boardShape(1000, 1000)).toBe('square');
    expect(boardShape(1000, 960)).toBe('square');
    expect(boardShape(0, 0)).toBe('square');
  });

  it('classifies wide and tall photos', () => {
    expect(boardShape(1600, 900)).toBe('landscape');
    expect(boardShape(900, 1600)).toBe('portrait');
  });
});
