-- Puzzle Adventure catalog, anonymous profiles, and global times.
-- Enable Anonymous sign-in in the Supabase dashboard (Authentication → Providers).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  created_at timestamptz not null default now()
);

create table public.levels (
  id text primary key,
  campaign_index integer not null unique,
  piece_count integer not null check (piece_count > 0),
  image_path text not null,
  thumb_path text not null,
  is_published boolean not null default true,
  content_hash text not null default ''
);

create table public.event_puzzles (
  id text primary key,
  event_type text not null check (event_type in ('daily', 'weekly', 'monthly')),
  period_key text not null,
  piece_count integer not null check (piece_count > 0),
  image_path text not null,
  thumb_path text not null,
  content_hash text not null default '',
  unique (event_type, period_key)
);

create table public.scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  level_id text not null,
  best_ms integer not null check (best_ms > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, level_id)
);

create index scores_level_best_idx on public.scores (level_id, best_ms, updated_at);

alter table public.profiles enable row level security;
alter table public.levels enable row level security;
alter table public.event_puzzles enable row level security;
alter table public.scores enable row level security;

create policy "profiles readable" on public.profiles for select using (true);
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);

create policy "levels readable" on public.levels for select using (is_published);
create policy "events readable" on public.event_puzzles for select using (true);
create policy "scores readable" on public.scores for select using (true);
create policy "scores insert own" on public.scores for insert with check (auth.uid() = user_id);
create policy "scores update own" on public.scores for update using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.player_label(p_id uuid, p_nickname text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(trim(p_nickname), ''), 'Player-' || substr(p_id::text, 1, 4));
$$;

create or replace function public.get_level_window(p_around integer, p_radius integer default 10)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', (select count(*)::int from public.levels where is_published),
    'rows', coalesce((
      select jsonb_agg(row_to_json(r))
      from (
        select id, campaign_index, piece_count, image_path, thumb_path, content_hash
        from public.levels
        where is_published
          and campaign_index between greatest(1, p_around - p_radius)
            and (p_around + p_radius)
        order by campaign_index
      ) r
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_current_events(p_daily text, p_weekly text, p_monthly text)
returns setof public.event_puzzles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.event_puzzles
  where (event_type = 'daily' and period_key = p_daily)
     or (event_type = 'weekly' and period_key = p_weekly)
     or (event_type = 'monthly' and period_key = p_monthly);
$$;

create or replace function public.get_leaderboard(p_level_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  my_ms integer;
  my_rank integer;
  my_nick text;
  top jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into top
  from (
    select
      row_number() over (order by s.best_ms asc, s.updated_at asc) as rank,
      public.player_label(s.user_id, p.nickname) as nickname,
      s.best_ms
    from public.scores s
    left join public.profiles p on p.id = s.user_id
    where s.level_id = p_level_id
    order by s.best_ms asc, s.updated_at asc
    limit 10
  ) t;

  if uid is not null then
    select s.best_ms, p.nickname into my_ms, my_nick
    from public.scores s
    left join public.profiles p on p.id = s.user_id
    where s.user_id = uid and s.level_id = p_level_id;

    if my_ms is not null then
      select count(*)::int + 1 into my_rank
      from public.scores
      where level_id = p_level_id and best_ms < my_ms;
    end if;
  end if;

  return jsonb_build_object(
    'top', top,
    'my_rank', my_rank,
    'my_ms', my_ms,
    'my_nickname', case
      when uid is null then null
      else public.player_label(uid, my_nick)
    end
  );
end;
$$;

create or replace function public.submit_score(p_level_id text, p_time_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prev integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_time_ms is null or p_time_ms < 500 then
    raise exception 'time too fast';
  end if;

  select best_ms into prev from public.scores where user_id = uid and level_id = p_level_id;
  if prev is null or p_time_ms < prev then
    insert into public.scores (user_id, level_id, best_ms, updated_at)
    values (uid, p_level_id, p_time_ms, now())
    on conflict (user_id, level_id) do update
      set best_ms = excluded.best_ms, updated_at = excluded.updated_at;
  end if;

  return public.get_leaderboard(p_level_id);
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.levels, public.event_puzzles, public.scores to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update on public.scores to authenticated;

grant execute on function public.get_level_window(integer, integer) to anon, authenticated;
grant execute on function public.get_current_events(text, text, text) to anon, authenticated;
grant execute on function public.get_leaderboard(text) to anon, authenticated;
grant execute on function public.submit_score(text, integer) to authenticated;

insert into storage.buckets (id, name, public)
values ('level-images', 'level-images', true)
on conflict (id) do nothing;

create policy "public read level images"
on storage.objects for select
using (bucket_id = 'level-images');
