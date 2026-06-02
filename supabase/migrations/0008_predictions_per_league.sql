-- ============================================================
-- Per-league predictions — each league is an independent contest
-- ============================================================
-- Fixtures stay shared (the global matches), but a prediction now belongs to
-- a (user, league, match): the same user can pick a different scoreline for
-- the same match in different leagues, and each league scores only its own
-- predictions.

-- ---------- Scope predictions to a league ----------
alter table public.predictions
  add column league_id uuid not null references public.leagues(id) on delete cascade;

-- One prediction per user per match PER LEAGUE (was: per user per match).
alter table public.predictions drop constraint if exists predictions_user_id_match_id_key;
alter table public.predictions
  add constraint predictions_user_league_match_key unique (user_id, league_id, match_id);

create index if not exists predictions_league_idx on public.predictions (league_id);

-- ---------- RLS: you may only predict inside leagues you belong to ----------
drop policy if exists "insert before deadline" on public.predictions;
create policy "insert before deadline" on public.predictions
  for insert with check (
    auth.uid() = user_id
    and public.is_league_member(league_id)
    and now() < (select submission_deadline from public.matches where id = match_id)
  );

drop policy if exists "update before deadline" on public.predictions;
create policy "update before deadline" on public.predictions
  for update using (
    auth.uid() = user_id
    and public.is_league_member(league_id)
    and now() < (select submission_deadline from public.matches where id = match_id)
    and (select submission_mode from public.app_settings where id = 1) = 'multiple'
  )
  with check (auth.uid() = user_id and public.is_league_member(league_id));

-- ---------- Standings count only THIS league's predictions ----------
create or replace function public.league_standings(p_league_id uuid)
returns table (
  user_id        uuid,
  display_name   text,
  total_points   bigint,
  scored_matches bigint,
  exact_hits     bigint
) language sql security definer stable
set search_path = public as $$
  select
    p.id,
    p.display_name,
    coalesce(sum(pr.points), 0)                            as total_points,
    count(pr.points) filter (where pr.points is not null)  as scored_matches,
    count(*) filter (
      where pr.points = (select points_exact from public.app_settings where id = 1)
    )                                                      as exact_hits
  from public.league_members lm
  join public.profiles p on p.id = lm.user_id
  -- only this member's predictions made IN this league
  left join public.predictions pr
    on pr.user_id = p.id and pr.league_id = lm.league_id
  where lm.league_id = p_league_id
    and (public.is_league_member(p_league_id) or public.is_admin())
  group by p.id, p.display_name;
$$;
