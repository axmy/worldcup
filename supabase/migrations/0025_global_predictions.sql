-- ============================================================
-- One global prediction per match (scored by each league's rules)
-- ============================================================
-- Predictions stop being per-league. A user predicts a match ONCE; every league
-- they've joined scores that single prediction using its own points rules,
-- computed on read in the standings functions. Editability (single vs multiple)
-- becomes a platform setting again, since there's only one prediction.

-- ---------- Collapse to one prediction per (user, match) ----------
-- Keep the global-league row if present, else the most recently updated.
with ranked as (
  select id, row_number() over (
    partition by user_id, match_id
    order by (league_id = (select id from public.leagues where is_global)) desc, updated_at desc
  ) as rn
  from public.predictions
)
delete from public.predictions where id in (select id from ranked where rn > 1);

-- ---------- Make predictions league-agnostic ----------
-- Drop the league-aware RLS policies first (they reference league_id, which
-- would otherwise block dropping the column). Recreated below.
drop policy if exists "insert before deadline" on public.predictions;
drop policy if exists "update before deadline" on public.predictions;

alter table public.predictions drop constraint if exists predictions_user_league_match_key;
alter table public.predictions drop column if exists league_id;  -- cascades its FK + index
alter table public.predictions
  add constraint predictions_user_match_key unique (user_id, match_id);

-- ---------- Scoring trigger: platform-default points (league-agnostic) ----------
-- predictions.points now holds the points under the platform's default rules,
-- used by the leaderboard view + header total. Per-league standings compute
-- their own points below.
create or replace function public.score_predictions()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare s_exact int; s_outcome int;
begin
  if new.home_score is not null and new.away_score is not null then
    select points_exact, points_outcome into s_exact, s_outcome from public.app_settings where id = 1;
    update public.predictions p set points = case
      when p.home_score = new.home_score and p.away_score = new.away_score then s_exact
      when sign(p.home_score - p.away_score) = sign(new.home_score - new.away_score) then s_outcome
      else 0
    end
    where p.match_id = new.id;
  else
    update public.predictions set points = null where match_id = new.id;
  end if;
  return new;
end;
$$;

-- ---------- Per-league standings: score each member's single prediction ----------
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
    coalesce(sum(case
      when pr.home_score = m.home_score and pr.away_score = m.away_score
        then (select points_exact from public.leagues where id = p_league_id)
      when sign(pr.home_score - pr.away_score) = sign(m.home_score - m.away_score)
        then (select points_outcome from public.leagues where id = p_league_id)
      else 0 end), 0)                                          as total_points,
    count(m.id)                                                as scored_matches,
    count(*) filter (where pr.home_score = m.home_score and pr.away_score = m.away_score) as exact_hits
  from public.league_members lm
  join public.profiles p on p.id = lm.user_id
  left join public.predictions pr on pr.user_id = p.id
  left join public.matches m
    on m.id = pr.match_id and m.home_score is not null and m.away_score is not null
  where lm.league_id = p_league_id
    and not coalesce(p.is_admin, false)
    and (public.is_league_member(p_league_id) or public.is_admin())
  group by p.id, p.display_name;
$$;

-- ---------- Global standings (the global league's own rules) ----------
create or replace function public.global_standings()
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
    coalesce(sum(case
      when pr.home_score = m.home_score and pr.away_score = m.away_score then g.points_exact
      when sign(pr.home_score - pr.away_score) = sign(m.home_score - m.away_score) then g.points_outcome
      else 0 end), 0)                                          as total_points,
    count(m.id)                                                as scored_matches,
    count(*) filter (where pr.home_score = m.home_score and pr.away_score = m.away_score) as exact_hits
  from public.leagues g
  join public.league_members lm on lm.league_id = g.id
  join public.profiles p on p.id = lm.user_id
  left join public.predictions pr on pr.user_id = p.id
  left join public.matches m
    on m.id = pr.match_id and m.home_score is not null and m.away_score is not null
  where g.is_global
    and not coalesce(p.is_admin, false)
  group by p.id, p.display_name, g.points_exact, g.points_outcome;
$$;

-- ---------- Global rank for the signed-in user ----------
create or replace function public.global_rank()
returns table (
  rank           bigint,
  total_points   bigint,
  scored_matches bigint,
  exact_hits     bigint,
  total_players  bigint
) language sql security definer stable
set search_path = public as $$
  with board as (
    select
      p.id as user_id,
      coalesce(sum(case
        when pr.home_score = m.home_score and pr.away_score = m.away_score then g.points_exact
        when sign(pr.home_score - pr.away_score) = sign(m.home_score - m.away_score) then g.points_outcome
        else 0 end), 0)                                          as total_points,
      count(m.id)                                                as scored_matches,
      count(*) filter (where pr.home_score = m.home_score and pr.away_score = m.away_score) as exact_hits
    from public.leagues g
    join public.league_members lm on lm.league_id = g.id
    join public.profiles p on p.id = lm.user_id
    left join public.predictions pr on pr.user_id = p.id
    left join public.matches m
      on m.id = pr.match_id and m.home_score is not null and m.away_score is not null
    where g.is_global and not coalesce(p.is_admin, false)
    group by p.id, g.points_exact, g.points_outcome
  ), ranked as (
    select user_id, total_points, scored_matches, exact_hits,
      rank() over (order by total_points desc, exact_hits desc) as rank,
      count(*) over ()                                          as total_players
    from board
  )
  select rank, total_points, scored_matches, exact_hits, total_players
  from ranked where user_id = auth.uid();
$$;

-- ---------- Predictions RLS: own prediction, within the match window ----------
-- (Old policies dropped above before the column drop.)
create policy "insert before deadline" on public.predictions
  for insert with check (
    auth.uid() = user_id
    and now() >= coalesce(
      (select submission_open from public.matches where id = match_id),
      '-infinity'::timestamptz
    )
    and now() < (select submission_deadline from public.matches where id = match_id)
  );

create policy "update before deadline" on public.predictions
  for update using (
    auth.uid() = user_id
    and now() >= coalesce(
      (select submission_open from public.matches where id = match_id),
      '-infinity'::timestamptz
    )
    and now() < (select submission_deadline from public.matches where id = match_id)
    and (select submission_mode from public.app_settings where id = 1) = 'multiple'
  )
  with check (auth.uid() = user_id);
