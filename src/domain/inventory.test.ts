import { describe, expect, it } from 'vitest';
import { consume, createInventory, hasCharges, applyPack, craft, upgradeReveal } from './inventory';

describe('inventory', () => {
  it('starts with no charges for a new player', () => {
    expect(createInventory()).toEqual({
      reveal_temp: 0,
      area: 0,
      hint: 0,
      sarea: 0,
      reveal_perm: 0,
      lucky: 0,
      solver: 0,
    });
  });

  it('consumes only when charges remain', () => {
    const start = createInventory({ hint: 1, area: 0 });
    expect(hasCharges(start, 'hint')).toBe(true);
    expect(consume(start, 'hint')).toEqual({ ...start, hint: 0 });
    expect(consume(start, 'area')).toBeNull();
  });

  it('crafts Magnet, Magnet+, Fill, and Peek ∞ from the recipes', () => {
    expect(
      craft(createInventory({ hint: 6, lucky: 3, reveal_temp: 1, area: 0 }), 'area'),
    ).toMatchObject({ hint: 0, lucky: 0, reveal_temp: 0, area: 1 });
    expect(craft(createInventory({ hint: 5, lucky: 3, reveal_temp: 1 }), 'area')).toBeNull();
    expect(
      craft(createInventory({ hint: 10, lucky: 6, reveal_temp: 2, sarea: 0 }), 'sarea'),
    ).toMatchObject({ hint: 0, lucky: 0, reveal_temp: 0, sarea: 1 });
    expect(craft(createInventory({ hint: 9, lucky: 5, solver: 0 }), 'solver')).toBeNull();
    expect(craft(createInventory({ hint: 9, lucky: 9, solver: 0 }), 'solver')).toMatchObject({
      hint: 0,
      lucky: 0,
      solver: 1,
    });
    expect(upgradeReveal(createInventory({ reveal_temp: 3, reveal_perm: 0 }))).toBeNull();
    expect(upgradeReveal(createInventory({ reveal_temp: 10, reveal_perm: 0 }))).toMatchObject({
      reveal_temp: 0,
      reveal_perm: 1,
    });
    expect(applyPack(createInventory({ hint: 1 }), { hint: 2, sarea: 1 })).toMatchObject({ hint: 3, sarea: 1 });
  });
});
