/** Piece-count curve for campaign levels. Shared with ingest CLI. */

class SeededRNG {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

export function getDifficultyForLevel(levelNum: number): number {
  if (levelNum === 1) return 16;
  if (levelNum === 2) return 16;
  if (levelNum === 3) return 36;
  if (levelNum === 4) return 36;
  if (levelNum === 5) return 64;
  if (levelNum === 6) return 36;
  if (levelNum === 7) return 16;
  if (levelNum === 8) return 36;
  if (levelNum === 9) return 36;
  if (levelNum === 10) return 64;

  const groupIndex = Math.floor((levelNum - 11) / 10);
  const indexInGroup = (levelNum - 11) % 10;
  const bag = [36, 36, 36, 36, 64, 64, 64, 64, 128, 128];
  const rng = new SeededRNG(groupIndex + 12345);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag[indexInGroup]!;
}

export const EVENT_PIECE_COUNTS = {
  daily: 200,
  weekly: 500,
  monthly: 1000,
} as const;

export type CampaignRank = 'C' | 'B' | 'A' | 'S';

export function campaignRankForPieces(n: number): CampaignRank | null {
  if (n <= 16) return 'C';
  if (n <= 36) return 'B';
  if (n <= 64) return 'A';
  if (n <= 128) return 'S';
  return null;
}

