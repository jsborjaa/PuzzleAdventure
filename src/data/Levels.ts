import { t } from '../i18n';
import { BUNDLED_CAMPAIGN_COUNT, getDifficultyForLevel } from '../domain/campaignDifficulty';

function withBaseUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

/** In dev, bypass browser cache so replacing files in public/ shows up after reload. */
export function withDevCacheBust(url: string): string {
  if (!import.meta.env.DEV) return url;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${Date.now()}`;
}

export interface LevelData {
  id: string;
  difficulty: number;
  imageKey: string;
  imageUrl: string;
  thumbUrl?: string;
  campaignIndex?: number;
  eventType?: 'daily' | 'weekly' | 'monthly';
}

export { getDifficultyForLevel };

function generateLevels(): LevelData[] {
  const levels: LevelData[] = [];
  for (let i = 1; i <= BUNDLED_CAMPAIGN_COUNT; i++) {
    const diff = getDifficultyForLevel(i);
    const imageUrl = `assets/Stage_${i}.jpg`;
    levels.push({
      id: `level_${i}`,
      difficulty: diff,
      imageKey: `img_level_${i}`,
      imageUrl,
      thumbUrl: imageUrl,
      campaignIndex: i,
    });
  }
  return levels;
}

export const LEVELS: LevelData[] = generateLevels();

export const SPECIAL_LEVELS: LevelData[] = [
  {
    id: 'event_daily',
    difficulty: 200,
    imageKey: 'img_event_daily',
    imageUrl: withBaseUrl('esp_events/daily/Stage_D.jpg'),
    eventType: 'daily',
  },
  {
    id: 'event_weekly',
    difficulty: 500,
    imageKey: 'img_event_weekly',
    imageUrl: withBaseUrl('esp_events/weekly/Stage_S.jpg'),
    eventType: 'weekly',
  },
  {
    id: 'event_monthly',
    difficulty: 1000,
    imageKey: 'img_event_monthly',
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
  const n = level.campaignIndex ?? parseInt(level.id.replace('level_', ''), 10);
  return t('level.titleWithDiff', { n, diff: t(difficultyKey(level.difficulty)) });
}
