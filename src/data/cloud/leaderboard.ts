import { getSupabase } from './supabase';

export interface LeaderboardRow {
  rank: number;
  nickname: string;
  best_ms: number;
}

export interface Leaderboard {
  top: LeaderboardRow[];
  my_rank: number | null;
  my_ms: number | null;
  my_nickname: string | null;
}

function parseBoard(raw: unknown): Leaderboard | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const topRaw = Array.isArray(data.top) ? data.top : [];
  const top: LeaderboardRow[] = topRaw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const rank = Number(r.rank);
      const best = Number(r.best_ms);
      if (!Number.isFinite(rank) || !Number.isFinite(best)) return null;
      return { rank, nickname: String(r.nickname ?? 'Player'), best_ms: best };
    })
    .filter((row): row is LeaderboardRow => row !== null);
  return {
    top,
    my_rank: typeof data.my_rank === 'number' ? data.my_rank : null,
    my_ms: typeof data.my_ms === 'number' ? data.my_ms : null,
    my_nickname: typeof data.my_nickname === 'string' ? data.my_nickname : null,
  };
}

export async function fetchLeaderboard(levelId: string): Promise<Leaderboard | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('get_leaderboard', { p_level_id: levelId });
    if (error) return null;
    return parseBoard(data);
  } catch {
    return null;
  }
}

/** Upsert a personal best, then return the board. No-ops without cloud. */
export async function submitScore(levelId: string, timeMs: number): Promise<Leaderboard | null> {
  const supabase = getSupabase();
  if (!supabase) return fetchLeaderboard(levelId);
  try {
    const { data, error } = await supabase.rpc('submit_score', {
      p_level_id: levelId,
      p_time_ms: Math.round(timeMs),
    });
    if (error) return fetchLeaderboard(levelId);
    return parseBoard(data);
  } catch {
    return fetchLeaderboard(levelId);
  }
}
