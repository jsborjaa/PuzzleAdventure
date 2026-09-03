import { describe, expect, it } from 'vitest';
import {
  eventGrant,
  eventPeriodKey,
  isoWeekKey,
  monthKey,
  packEntries,
  packHasItems,
  randomCommonId,
  utcDateKey,
  campaignFirstClearPack,
} from './powerups';

describe('powerups catalog', () => {
  it('builds UTC day / month / ISO week period keys', () => {
    const monday = Date.UTC(2026, 7, 31, 15);
    const sunday = Date.UTC(2026, 8, 6, 15);
    const nextMonday = Date.UTC(2026, 8, 7, 15);
    expect(utcDateKey(monday)).toBe('2026-08-31');
    expect(monthKey(monday)).toBe('2026-08');
    expect(eventPeriodKey('daily', monday)).toBe('2026-08-31');
    expect(eventPeriodKey('monthly', monday)).toBe('2026-08');
    expect(isoWeekKey(monday)).toBe(isoWeekKey(sunday));
    expect(isoWeekKey(nextMonday)).not.toBe(isoWeekKey(monday));
    expect(eventPeriodKey('weekly', monday)).toBe(isoWeekKey(monday));
  });

  it('picks a common from the catalog', () => {
    expect(randomCommonId(() => 0)).toBe('hint');
    expect(['hint', 'area', 'reveal_temp']).toContain(randomCommonId(() => 0.99));
  });

  it('lists grant pack entries', () => {
    expect(packHasItems(eventGrant('weekly'))).toBe(true);
    expect(packEntries(eventGrant('weekly'))).toEqual([
      { id: 'hint', n: 2 },
      { id: 'area', n: 4 },
      { id: 'sarea', n: 1 },
    ]);
    expect(packHasItems({})).toBe(false);
    expect(packEntries(campaignFirstClearPack(() => 0))).toEqual([{ id: 'hint', n: 1 }]);
  });
});
