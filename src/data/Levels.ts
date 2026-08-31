import { t } from '../i18n';

function withBaseUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

/** In dev, bypass browser cache so replacing files in public/ shows up after reload. */
export function withDevCacheBust(url: string): string {
  if (!import.meta.env.DEV) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${Date.now()}`;
}

export interface LevelData {
  id: string;
  difficulty: number;
  imageKey: string;
  imageUrl: string;
  eventType?: 'daily' | 'weekly' | 'monthly';
}

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

function getDifficultyForLevel(levelNum: number): number {
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
  const bag = [36, 36, 36, 36, 64, 64, 64, 64, 100, 100];
  const rng = new SeededRNG(groupIndex + 12345);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag[indexInGroup];
}

const AVAILABLE_IMAGES_COUNT = 14;

function generateLevels(): LevelData[] {
  const levels: LevelData[] = [];
  for (let i = 1; i <= AVAILABLE_IMAGES_COUNT; i++) {
    const diff = getDifficultyForLevel(i);
    levels.push({
      id: `level_${i}`,
      difficulty: diff,
      imageKey: `stage_${i}`,
      imageUrl: `assets/Stage_${i}.jpg`,
    });
  }
  return levels;
}

export const LEVELS: LevelData[] = generateLevels();

export const SPECIAL_LEVELS: LevelData[] = [
  {
    id: 'event_daily',
    difficulty: 200,
    imageKey: 'stage_daily',
    imageUrl: withBaseUrl('esp_events/daily/Stage_D.jpg'),
    eventType: 'daily',
  },
  {
    id: 'event_weekly',
    difficulty: 500,
    imageKey: 'stage_weekly',
    imageUrl: withBaseUrl('esp_events/weekly/Stage_S.jpg'),
    eventType: 'weekly',
  },
  {
    id: 'event_monthly',
    difficulty: 1000,
    imageKey: 'stage_monthly',
    imageUrl: withBaseUrl('esp_events/monthly/Stage_M.jpg'),
    eventType: 'monthly',
  },
];

export function getLevelById(id: string): LevelData | undefined {
  return LEVELS.find((l) => l.id === id) ?? SPECIAL_LEVELS.find((l) => l.id === id);
}

function difficultyKey(n: number) {
  if (n <= 16) return 'difficulty.beginner' as const;
  if (n <= 36) return 'difficulty.easy' as const;
  if (n <= 64) return 'difficulty.medium' as const;
  return 'difficulty.hard' as const;
}

/** Localized title. Call at display time, not when the catalog is built. */
export function getLevelTitle(level: LevelData): string {
  if (level.eventType === 'daily') return t('event.daily');
  if (level.eventType === 'weekly') return t('event.weekly');
  if (level.eventType === 'monthly') return t('event.monthly');
  const n = parseInt(level.id.replace('level_', ''), 10);
  return t('level.titleWithDiff', { n, diff: t(difficultyKey(level.difficulty)) });
}
