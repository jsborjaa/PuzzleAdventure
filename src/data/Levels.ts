import { t } from '../i18n';
import { getDifficultyForLevel } from '../domain/campaignDifficulty';

/** In dev, bypass browser cache so replacing files shows up after reload. */
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
