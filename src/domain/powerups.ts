import type { PowerupKey } from './product';

export type PowerupPack = Partial<Record<PowerupKey, number>>;

export type PowerupTier = 'common' | 'rare';
export type PowerupFamily = 'place' | 'gather' | 'reveal';

export interface PowerupDef {
  id: PowerupKey;
  tier: PowerupTier;
  family: PowerupFamily;
  craftsTo?: PowerupKey;
  craftCost?: number;
}

export const POWERUP_DEFS: PowerupDef[] = [
  { id: 'hint', tier: 'common', family: 'place' },
  { id: 'area', tier: 'common', family: 'gather', craftsTo: 'sarea', craftCost: 4 },
  { id: 'reveal_temp', tier: 'common', family: 'reveal', craftsTo: 'reveal_perm', craftCost: 10 },
  { id: 'sarea', tier: 'rare', family: 'gather' },
  { id: 'reveal_perm', tier: 'rare', family: 'reveal' },
];

export const COMMON_POWERUP_IDS: PowerupKey[] = POWERUP_DEFS.filter((d) => d.tier === 'common').map((d) => d.id);

export function getPowerupDef(id: PowerupKey): PowerupDef | undefined {
  return POWERUP_DEFS.find((d) => d.id === id);
}

export function campaignFirstClearPack(rng: () => number = Math.random): PowerupPack {
  return { [randomCommonId(rng)]: 1 };
}

export const GRANT_DAILY: PowerupPack = { hint: 2, area: 2, reveal_temp: 2 };
export const GRANT_WEEKLY: PowerupPack = { hint: 2, area: 4, sarea: 1 };
export const GRANT_MONTHLY: PowerupPack = { hint: 3, reveal_temp: 5, sarea: 2, reveal_perm: 1 };

export const AD_COMMON_DAILY_CAP = 5;

export type StoreSkuId = 'ad_common' | 'pack_handy' | 'pack_rare';

export interface StoreSku {
  id: StoreSkuId;
  kind: 'ad' | 'iap';
  pack: PowerupPack;
}

export const STORE_SKUS: StoreSku[] = [
  { id: 'ad_common', kind: 'ad', pack: {} },
  { id: 'pack_handy', kind: 'iap', pack: { hint: 10, area: 10, reveal_temp: 10 } },
  { id: 'pack_rare', kind: 'iap', pack: { sarea: 3, reveal_perm: 2 } },
];

export function eventGrant(eventType: 'daily' | 'weekly' | 'monthly'): PowerupPack {
  if (eventType === 'daily') return GRANT_DAILY;
  if (eventType === 'weekly') return GRANT_WEEKLY;
  return GRANT_MONTHLY;
}

export function utcDateKey(ms: number = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function monthKey(ms: number = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 7);
}

/** ISO week, e.g. 2026-W36 */
export function isoWeekKey(ms: number = Date.now()): string {
  const date = new Date(ms);
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${week < 10 ? '0' : ''}${week}`;
}

export function eventPeriodKey(eventType: 'daily' | 'weekly' | 'monthly', ms: number = Date.now()): string {
  if (eventType === 'daily') return utcDateKey(ms);
  if (eventType === 'weekly') return isoWeekKey(ms);
  return monthKey(ms);
}

export function randomCommonId(rng: () => number = Math.random): PowerupKey {
  const i = Math.min(COMMON_POWERUP_IDS.length - 1, Math.floor(rng() * COMMON_POWERUP_IDS.length));
  return COMMON_POWERUP_IDS[i]!;
}

export function packHasItems(pack: PowerupPack | null | undefined): boolean {
  if (!pack) return false;
  return Object.values(pack).some((n) => (n ?? 0) > 0);
}

export function packEntries(pack: PowerupPack): { id: PowerupKey; n: number }[] {
  return POWERUP_DEFS.map((def) => ({ id: def.id, n: pack[def.id] ?? 0 })).filter((row) => row.n > 0);
}
