import { describe, expect, it } from 'vitest';
import { mergeExtraLevel, shiftCenter, windowBounds } from './catalogWindow';

describe('campaign map window', () => {
  it('clamps a window around the center', () => {
    expect(windowBounds(1, 14, 10)).toEqual({ start: 1, end: 11 });
    expect(windowBounds(14, 14, 10)).toEqual({ start: 4, end: 14 });
    expect(windowBounds(50, 10000, 10)).toEqual({ start: 40, end: 60 });
    expect(windowBounds(1, 0)).toEqual({ start: 1, end: 0 });
  });

  it('shifts without leaving the catalog', () => {
    expect(shiftCenter(1, -20, 100)).toBe(1);
    expect(shiftCenter(1, 20, 100)).toBe(21);
    expect(shiftCenter(90, 20, 100)).toBe(100);
  });

  it('pins last-played when it is outside the window', () => {
    const window = [{ id: 'level_1' }, { id: 'level_2' }];
    expect(mergeExtraLevel(window, { id: 'level_2' })).toEqual(window);
    expect(mergeExtraLevel(window, { id: 'level_40' })).toEqual([...window, { id: 'level_40' }]);
  });
});
