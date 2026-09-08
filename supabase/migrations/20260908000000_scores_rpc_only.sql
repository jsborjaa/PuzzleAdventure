-- Scores may only be written through submit_score (500ms floor + improve-only).
-- Direct INSERT/UPDATE with RLS auth.uid() = user_id bypassed that check.

drop policy if exists "scores insert own" on public.scores;
drop policy if exists "scores update own" on public.scores;

revoke insert, update on public.scores from authenticated;

alter table public.profiles drop constraint if exists profiles_nickname_len;
alter table public.profiles
  add constraint profiles_nickname_len check (nickname is null or char_length(nickname) <= 24);
