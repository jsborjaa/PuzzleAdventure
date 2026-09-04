import { describe, expect, it } from 'vitest';
import {
  campaignIndexOf,
  pageBounds,
  pageCount,
  pageForIndex,
  pageQuery,
  shiftPage,
  sliceByPage,
} from './catalogWindow';

describe('campaign map pages', () => {
  it('splits 14 levels into 10 then 4', () => {
    expect(pageCount(14)).toBe(2);
    expect(pageBounds(1, 14)).toEqual({ start: 1, end: 10 });
    expect(pageBounds(2, 14)).toEqual({ start: 11, end: 14 });
    expect(pageBounds(9, 14)).toEqual({ start: 11, end: 14 });
    expect(pageBounds(1, 0)).toEqual({ start: 1, end: 0 });
  });

  it('moves one page at a time', () => {
    expect(shiftPage(1, -1, 14)).toBe(1);
    expect(shiftPage(1, 1, 14)).toBe(2);
    expect(shiftPage(2, 1, 14)).toBe(2);
    expect(pageForIndex(1, 14)).toBe(1);
    expect(pageForIndex(10, 14)).toBe(1);
    expect(pageForIndex(11, 14)).toBe(2);
  });

  it('keeps only the current page of rows', () => {
    const rows = [1, 2, 11, 12, 13, 14].map((n) => ({ id: `level_${n}`, campaignIndex: n }));
    expect(sliceByPage(rows, 1, 14, campaignIndexOf).map((r) => r.campaignIndex)).toEqual([1, 2]);
    expect(sliceByPage(rows, 2, 14, campaignIndexOf).map((r) => r.campaignIndex)).toEqual([
      11, 12, 13, 14,
    ]);
    expect(pageQuery(1, 14)).toEqual({ start: 1, end: 10, around: 5, radius: 5 });
    expect(pageQuery(2, 14)).toEqual({ start: 11, end: 14, around: 12, radius: 2 });
  });
});
