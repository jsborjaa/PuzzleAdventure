import { DEFAULT_POWERUPS, type PowerupKey } from './product';
import { getPowerupDef } from './powerups';

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

export function tryUpgrade(
  counts: PowerupCounts,
  from: PowerupKey,
  to: PowerupKey,
  cost: number,
): PowerupCounts | null {
  if ((counts[from] ?? 0) < cost) return null;
  return {
    ...counts,
    [from]: counts[from] - cost,
    [to]: (counts[to] ?? 0) + 1,
  };
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

/** Craft using the catalog (4 Area → sArea, 10×20s → infinite). */
export function craft(counts: PowerupCounts, from: PowerupKey): PowerupCounts | null {
  const def = getPowerupDef(from);
  if (!def?.craftsTo || !def.craftCost) return null;
  return tryUpgrade(counts, from, def.craftsTo, def.craftCost);
}

export function upgradeArea(counts: PowerupCounts): PowerupCounts | null {
  return craft(counts, 'area');
}

export function upgradeReveal(counts: PowerupCounts): PowerupCounts | null {
  return craft(counts, 'reveal_temp');
}
