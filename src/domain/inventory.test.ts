import { describe, expect, it } from 'vitest';
import { consume, createInventory, hasCharges, applyPack, upgradeArea, upgradeReveal } from './inventory';

describe('inventory', () => {
  it('consumes only when charges remain', () => {
    const start = createInventory({ hint: 1, area: 0 });
    expect(hasCharges(start, 'hint')).toBe(true);
    expect(consume(start, 'hint')).toEqual({ ...start, hint: 0 });
    expect(consume(start, 'area')).toBeNull();
  });

  it('upgrades area 4→sarea and reveal 10→perm', () => {
    expect(upgradeArea(createInventory({ area: 4, sarea: 0 }))).toMatchObject({ area: 0, sarea: 1 });
    expect(upgradeArea(createInventory({ area: 1 }))).toBeNull();
    expect(upgradeReveal(createInventory({ reveal_temp: 3, reveal_perm: 0 }))).toBeNull();
    expect(upgradeReveal(createInventory({ reveal_temp: 10, reveal_perm: 0 }))).toMatchObject({
      reveal_temp: 0,
      reveal_perm: 1,
    });
    expect(applyPack(createInventory({ hint: 1 }), { hint: 2, sarea: 1 })).toMatchObject({ hint: 3, sarea: 1 });
  });
});
