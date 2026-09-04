import { ProgressStore } from '../ProgressStore';
import { getSupabase, isCloudConfigured } from './supabase';

export async function ensureCloudSession(): Promise<boolean> {
  if (!isCloudConfigured()) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { data } = await supabase.auth.getSession();
    let userId = data.session?.user.id;
    if (!userId) {
      const signed = await supabase.auth.signInAnonymously();
      if (signed.error) {
        console.error('Anonymous sign-in failed', signed.error.message);
        return false;
      }
      userId = signed.data.user?.id ?? undefined;
    }
    if (!userId) return false;
    const nickname = ProgressStore.getInstance().getNickname();
    const { error } = await supabase.from('profiles').upsert({ id: userId, nickname: nickname || null });
    if (error) console.error('Profile upsert failed', error.message);
    return true;
  } catch (err) {
    console.error('Cloud session failed', err);
    return false;
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
