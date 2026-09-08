import { DEFAULT_POWERUPS, type PowerupKey } from './product';
import { getCraftRecipe } from './powerups';

export type PowerupCounts = Record<PowerupKey, number>;

export function createInventory(initial?: Partial<PowerupCounts>): PowerupCounts {
  return { ...DEFAULT_POWERUPS, ...initial };
}

export function hasCharges(counts: PowerupCounts, key: PowerupKey): boolean {
  return (counts[key] ?? 0) > 0;
}

export function consume(counts: PowerupCounts, key: PowerupKey): PowerupCounts | null {
  if (!hasCharges(counts, key)) return null;
  return { ...counts, [key]: counts[key] - 1 };
}

export function applyPack(counts: PowerupCounts, pack: Partial<PowerupCounts>): PowerupCounts {
  const next = { ...counts };
  (Object.keys(pack) as PowerupKey[]).forEach((key) => {
    const n = pack[key];
    if (!n) return;
    next[key] = (next[key] ?? 0) + n;
  });
  return next;
}

export function canCraft(counts: PowerupCounts, to: PowerupKey): boolean {
  const recipe = getCraftRecipe(to);
  if (!recipe) return false;
  return (Object.keys(recipe.cost) as PowerupKey[]).every((key) => (counts[key] ?? 0) >= (recipe.cost[key] ?? 0));
}

/** Craft a rare from `CRAFT_RECIPES` (multi-ingredient). */
export function craft(counts: PowerupCounts, to: PowerupKey): PowerupCounts | null {
  const recipe = getCraftRecipe(to);
  if (!recipe || !canCraft(counts, to)) return null;
  const next = { ...counts };
  for (const key of Object.keys(recipe.cost) as PowerupKey[]) {
    next[key] = (next[key] ?? 0) - (recipe.cost[key] ?? 0);
  }
  next[recipe.to] = (next[recipe.to] ?? 0) + 1;
  return next;
}
