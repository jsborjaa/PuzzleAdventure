import { ensureCloudSession } from './auth';
import { getSupabase } from './supabase';

export interface LeaderboardRow {
  rank: number;
  nickname: string;
  best_ms: number;
}

export type RankingError = 'auth' | 'rpc' | null;

export interface Leaderboard {
  top: LeaderboardRow[];
  my_rank: number | null;
  my_ms: number | null;
  my_nickname: string | null;
}

export interface RankingResult {
  board: Leaderboard | null;
  error: RankingError;
}

function asInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Parse `get_leaderboard` / `submit_score` JSON. Exported for tests. */
export function parseLeaderboard(raw: unknown): Leaderboard | null {
  let data: unknown = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const topRaw = Array.isArray(row.top) ? row.top : [];
  const top: LeaderboardRow[] = topRaw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const r = entry as Record<string, unknown>;
      const rank = asInt(r.rank);
      const best = asInt(r.best_ms);
      if (rank === null || best === null) return null;
      return { rank, nickname: String(r.nickname ?? 'Player'), best_ms: best };
    })
    .filter((entry): entry is LeaderboardRow => entry !== null);
  const nick = row.my_nickname;
  return {
    top,
    my_rank: asInt(row.my_rank),
    my_ms: asInt(row.my_ms),
    my_nickname: typeof nick === 'string' && nick.trim() ? nick : null,
  };
}

export async function fetchLeaderboard(levelId: string): Promise<Leaderboard | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('get_leaderboard', { p_level_id: levelId });
    if (error) {
      console.error('get_leaderboard failed', error.message);
      return null;
    }
    return parseLeaderboard(data);
  } catch (err) {
    console.error('get_leaderboard failed', err);
    return null;
  }
}

function isAuthError(message: string): boolean {
  return /not authenticated|sign-ins are disabled|anonymous/i.test(message);
}

/** Upsert the device best, then return the board. */
export async function submitScore(levelId: string, timeMs: number): Promise<RankingResult> {
  const supabase = getSupabase();
  if (!supabase) return { board: null, error: 'rpc' };
  const ready = await ensureCloudSession();
  if (!ready) {
    return { board: await fetchLeaderboard(levelId), error: 'auth' };
  }
  if (!Number.isFinite(timeMs) || timeMs < 500) {
    return { board: await fetchLeaderboard(levelId), error: null };
  }
  try {
    const { data, error } = await supabase.rpc('submit_score', {
      p_level_id: levelId,
      p_time_ms: Math.round(timeMs),
    });
    if (error) {
      console.error('submit_score failed', error.message);
      return {
        board: await fetchLeaderboard(levelId),
        error: isAuthError(error.message) ? 'auth' : 'rpc',
      };
    }
    return { board: parseLeaderboard(data), error: null };
  } catch (err) {
    console.error('submit_score failed', err);
    return { board: await fetchLeaderboard(levelId), error: 'rpc' };
  }
}
