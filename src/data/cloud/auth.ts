import { ProgressStore } from '../ProgressStore';
import { getSupabase, isCloudConfigured } from './supabase';

export async function ensureCloudSession(): Promise<void> {
  if (!isCloudConfigured()) return;
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    let userId = data.session?.user.id;
    if (!userId) {
      const signed = await supabase.auth.signInAnonymously();
      userId = signed.data.user?.id ?? undefined;
    }
    if (!userId) return;
    const nickname = ProgressStore.getInstance().getNickname();
    await supabase.from('profiles').upsert({ id: userId, nickname: nickname || null });
  } catch {
    // Offline or anonymous auth not enabled yet.
  }
}

export async function syncNickname(nickname: string): Promise<void> {
  ProgressStore.getInstance().setNickname(nickname);
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user.id;
    if (!id) return;
    await supabase.from('profiles').upsert({ id, nickname: nickname.trim() || null });
  } catch {
    // Keep the local nickname even if the network fails.
  }
}

export function fallbackPlayerName(userId: string | undefined, nickname: string | null): string {
  const trimmed = nickname?.trim();
  if (trimmed) return trimmed;
  if (!userId) return 'Player';
  return `Player-${userId.slice(0, 4)}`;
}
