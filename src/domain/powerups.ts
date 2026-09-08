import { campaignRankForPieces } from './campaignDifficulty';
import type { PowerupKey } from './product';

export type PowerupPack = Partial<Record<PowerupKey, number>>;

export type PowerupTier = 'common' | 'rare';
export type PowerupFamily = 'place' | 'gather' | 'reveal';

export interface PowerupDef {
  id: PowerupKey;
  tier: PowerupTier;
  family: PowerupFamily;
}

export interface CraftRecipe {
  to: PowerupKey;
  cost: PowerupPack;
}

export const POWERUP_DEFS: PowerupDef[] = [
  { id: 'hint', tier: 'common', family: 'place' },
  { id: 'lucky', tier: 'common', family: 'place' },
  { id: 'reveal_temp', tier: 'common', family: 'reveal' },
  { id: 'area', tier: 'rare', family: 'gather' },
  { id: 'sarea', tier: 'rare', family: 'gather' },
  { id: 'solver', tier: 'rare', family: 'place' },
  { id: 'reveal_perm', tier: 'rare', family: 'reveal' },
];

export const CRAFT_RECIPES: CraftRecipe[] = [
  { to: 'area', cost: { hint: 6, lucky: 3, reveal_temp: 1 } },
  { to: 'sarea', cost: { hint: 10, lucky: 6, reveal_temp: 2 } },
  { to: 'solver', cost: { hint: 9, lucky: 9 } },
  { to: 'reveal_perm', cost: { reveal_temp: 10 } },
];

export const COMMON_POWERUP_IDS: PowerupKey[] = POWERUP_DEFS.filter((d) => d.tier === 'common').map((d) => d.id);

export function getPowerupDef(id: PowerupKey): PowerupDef | undefined {
  return POWERUP_DEFS.find((d) => d.id === id);
}

export function getCraftRecipe(to: PowerupKey): CraftRecipe | undefined {
  return CRAFT_RECIPES.find((r) => r.to === to);
}

export const CAMPAIGN_CLEAR_BY_LEVEL: Record<number, PowerupPack> = {
  1: { hint: 1 },
  2: { lucky: 1 },
  3: { reveal_temp: 1 },
  4: { hint: 6, lucky: 3, reveal_temp: 1 },
};

export const CAMPAIGN_CLEAR_REWARDS: Record<'C' | 'B' | 'A' | 'S', { randomCommons: number }> = {
  C: { randomCommons: 1 },
  B: { randomCommons: 1 },
  A: { randomCommons: 2 },
  S: { randomCommons: 2 },
};

export function campaignFirstClearPack(
  levelNum: number,
  pieceCount: number,
  rng: () => number = Math.random,
): PowerupPack {
  const scripted = CAMPAIGN_CLEAR_BY_LEVEL[levelNum];
  if (scripted) return { ...scripted };
  const rank = campaignRankForPieces(pieceCount);
  const n = rank ? CAMPAIGN_CLEAR_REWARDS[rank].randomCommons : 1;
  const pack: PowerupPack = {};
  for (let i = 0; i < n; i++) {
    const id = randomCommonId(rng);
    pack[id] = (pack[id] ?? 0) + 1;
  }
  return pack;
}

export function allowCampaignWinDouble(levelNum: number): boolean {
  return levelNum >= 5;
}

export const GRANT_DAILY: PowerupPack = { hint: 2, lucky: 2, reveal_temp: 2 };
export const GRANT_WEEKLY: PowerupPack = { hint: 2, lucky: 4, sarea: 1 };
export const GRANT_MONTHLY: PowerupPack = { hint: 3, reveal_temp: 5, sarea: 2, reveal_perm: 1 };

export const AD_COMMON_DAILY_CAP = 5;

export type StoreSkuId = 'ad_common' | 'pack_handy' | 'pack_rare';
export type IapSkuId = 'pack_handy' | 'pack_rare';

export interface StoreSku {
  id: StoreSkuId;
  kind: 'ad' | 'iap';
  pack: PowerupPack;
}

export const STORE_SKUS: StoreSku[] = [
  { id: 'ad_common', kind: 'ad', pack: {} },
  { id: 'pack_handy', kind: 'iap', pack: { hint: 6, lucky: 6, reveal_temp: 3 } },
  { id: 'pack_rare', kind: 'iap', pack: { area: 2, sarea: 1, reveal_perm: 1, solver: 1 } },
];

export const IAP_SKU_IDS: IapSkuId[] = STORE_SKUS.filter((s): s is StoreSku & { id: IapSkuId; kind: 'iap' } => s.kind === 'iap').map(
  (s) => s.id,
);

export function isIapSkuId(id: string): id is IapSkuId {
  return id === 'pack_handy' || id === 'pack_rare';
}

export function getIapSku(id: IapSkuId): StoreSku | undefined {
  return STORE_SKUS.find((s) => s.id === id);
}

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
