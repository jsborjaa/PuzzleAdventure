import { describe, expect, it } from 'vitest';
import { MemoryStorage, ProgressStore } from './ProgressStore';
import { GRANT_MONTHLY } from '../domain/powerups';

describe('ProgressStore economy', () => {
  it('grants campaign first-clear only when unlock increases', () => {
    const store = new ProgressStore(new MemoryStorage());
    const before = store.getPowerups();
    expect(store.completeLevel(0)).toBe(true);
    expect(store.tryClaimCampaignFirstClear(true, 1, 16, () => 0)).toEqual({ hint: 1 });
    expect(store.getPowerups().hint).toBe(before.hint + 1);
    expect(store.getPowerups().area).toBe(before.area);
    expect(store.completeLevel(0)).toBe(false);
    expect(store.tryClaimCampaignFirstClear(false, 1, 16)).toBeNull();
    expect(store.getPowerups().hint).toBe(before.hint + 1);
  });

  it('claims each event once per period and again after reset', () => {
    const store = new ProgressStore(new MemoryStorage());
    const now = Date.UTC(2026, 7, 31);
    const first = store.tryClaimEventReward('monthly', 'event_monthly', now);
    expect(first).toEqual(GRANT_MONTHLY);
    expect(store.tryClaimEventReward('monthly', 'event_monthly', now)).toBeNull();
    store.resetSpecialEvents();
    expect(store.tryClaimEventReward('monthly', 'event_monthly', now)).toEqual(GRANT_MONTHLY);
  });

  it('caps rewarded ads at 5 per UTC day', () => {
    const store = new ProgressStore(new MemoryStorage());
    const day = Date.UTC(2026, 7, 31, 10);
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const pack = store.tryClaimAdCommon(day, () => 0);
      expect(pack).toEqual({ hint: 1 });
      ids.push('hint');
    }
    expect(store.tryClaimAdCommon(day, () => 0)).toBeNull();
    expect(store.adsRemainingToday(day)).toBe(0);
    expect(store.tryClaimAdCommon(Date.UTC(2026, 8, 1, 10), () => 0)).toEqual({ hint: 1 });
    expect(ids).toHaveLength(5);
  });

  it('crafts from the catalog recipes', () => {
    const store = new ProgressStore(new MemoryStorage());
    store.setPowerups({ ...store.getPowerups(), hint: 6, lucky: 3, reveal_temp: 11, area: 0, reveal_perm: 0 });
    expect(store.craftPowerup('area')).toBe(true);
    expect(store.getPowerups()).toMatchObject({ hint: 0, lucky: 0, reveal_temp: 10, area: 1 });
    expect(store.craftPowerup('reveal_perm')).toBe(true);
    expect(store.getPowerups()).toMatchObject({ reveal_temp: 0, reveal_perm: 1 });
    expect(store.craftPowerup('hint')).toBe(false);
  });

  it('clears the campaign session only for that level', () => {
    const store = new ProgressStore(new MemoryStorage());
    store.saveSession({
      version: 4,
      levelId: 'level_3',
      pieces: [],
      revealPermanent: true,
      elapsedMs: 10,
      lastUpdated: 1,
    });
    store.clearCampaignSessionIf('level_9');
    expect(store.getSession()?.levelId).toBe('level_3');
    store.clearCampaignSessionIf('level_3');
    expect(store.getSession()).toBeNull();
  });

  it('clips nicknames to 24 characters', () => {
    const store = new ProgressStore(new MemoryStorage());
    store.setNickname(`  ${'n'.repeat(30)}  `);
    expect(store.getNickname()).toBe('n'.repeat(24));
  });
});
