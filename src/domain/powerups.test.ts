import { describe, expect, it } from 'vitest';
import {
  campaignFirstClearPack,
  CRAFT_RECIPES,
  eventGrant,
  eventPeriodKey,
  isoWeekKey,
  monthKey,
  packEntries,
  packHasItems,
  randomCommonId,
  utcDateKey,
} from './powerups';
import { getDifficultyForLevel } from './campaignDifficulty';

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
    expect(['hint', 'lucky', 'reveal_temp']).toContain(randomCommonId(() => 0.99));
    expect(randomCommonId(() => 0.99)).not.toBe('area');
  });

  it('lists grant pack entries', () => {
    expect(packHasItems(eventGrant('weekly'))).toBe(true);
    expect(packEntries(eventGrant('weekly'))).toEqual([
      { id: 'hint', n: 2 },
      { id: 'lucky', n: 4 },
      { id: 'sarea', n: 1 },
    ]);
    expect(packHasItems({})).toBe(false);
  });

  it('scripts first-clear packs for levels 1–4 and random by rank from 5', () => {
    expect(campaignFirstClearPack(1, 16)).toEqual({ hint: 1 });
    expect(campaignFirstClearPack(2, 16)).toEqual({ lucky: 1 });
    expect(campaignFirstClearPack(3, 36)).toEqual({ reveal_temp: 1 });
    expect(campaignFirstClearPack(4, 36)).toEqual({ hint: 6, lucky: 3, reveal_temp: 1 });
    expect(campaignFirstClearPack(5, 64, () => 0)).toEqual({ hint: 2 });
    expect(campaignFirstClearPack(5, 16, () => 0)).toEqual({ hint: 1 });
    expect(campaignFirstClearPack(11, 128, () => 0)).toEqual({ hint: 2 });
  });

  it('has the four craft recipes', () => {
    expect(CRAFT_RECIPES.map((r) => r.to)).toEqual(['area', 'sarea', 'solver', 'reveal_perm']);
    expect(CRAFT_RECIPES.find((r) => r.to === 'area')?.cost).toEqual({ hint: 6, lucky: 3, reveal_temp: 1 });
    expect(CRAFT_RECIPES.find((r) => r.to === 'solver')?.cost).toEqual({ hint: 9, lucky: 9 });
  });

  it('keeps level-5 campaign boards on the A rank used by first-clear', () => {
    expect(getDifficultyForLevel(5)).toBe(64);
  });
});
