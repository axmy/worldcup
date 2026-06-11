-- ============================================================
-- Add outcome_hits to the standings functions (for the stats table)
-- ============================================================
-- The leaderboard now shows a per-player breakdown: MP (scored matches), Exact
-- hits, Outcome hits, Pts. exact_hits already existed; this adds outcome_hits
-- (right winner/draw but wrong scoreline) to all three standings functions.
--
-- Adding an OUT column changes each function's return type, which CREATE OR
-- REPLACE cannot do — drop first, then recreate. Nothing in the DB depends on
-- these (they're called only via supabase.rpc), so dropping is safe.
drop function if exists public.league_standings(uuid);
drop function if exists public.global_standings();
drop function if exists public.global_rank();

-- ---------- Per-league ----------
create or replace function public.league_standings(p_league_id uuid)
returns table (
  user_id        uuid,
  display_name   text,
  total_points   bigint,
  scored_matches bigint,
  exact_hits     bigint,
  outcome_hits   bigint
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
    count(*) filter (where pr.home_score = m.home_score and pr.away_score = m.away_score) as exact_hits,
    count(*) filter (
      where not (pr.home_score = m.home_score and pr.away_score = m.away_score)
        and sign(pr.home_score - pr.away_score) = sign(m.home_score - m.away_score)
    )                                                          as outcome_hits
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

-- ---------- Global ----------
create or replace function public.global_standings()
returns table (
  user_id        uuid,
  display_name   text,
  total_points   bigint,
  scored_matches bigint,
  exact_hits     bigint,
  outcome_hits   bigint
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
    count(*) filter (where pr.home_score = m.home_score and pr.away_score = m.away_score) as exact_hits,
    count(*) filter (
      where not (pr.home_score = m.home_score and pr.away_score = m.away_score)
        and sign(pr.home_score - pr.away_score) = sign(m.home_score - m.away_score)
    )                                                          as outcome_hits
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

-- ---------- Global rank (signed-in user) ----------
create or replace function public.global_rank()
returns table (
  rank           bigint,
  total_points   bigint,
  scored_matches bigint,
  exact_hits     bigint,
  outcome_hits   bigint,
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
      count(*) filter (where pr.home_score = m.home_score and pr.away_score = m.away_score) as exact_hits,
      count(*) filter (
        where not (pr.home_score = m.home_score and pr.away_score = m.away_score)
          and sign(pr.home_score - pr.away_score) = sign(m.home_score - m.away_score)
      )                                                          as outcome_hits
    from public.leagues g
    join public.league_members lm on lm.league_id = g.id
    join public.profiles p on p.id = lm.user_id
    left join public.predictions pr on pr.user_id = p.id
    left join public.matches m
      on m.id = pr.match_id and m.home_score is not null and m.away_score is not null
    where g.is_global and not coalesce(p.is_admin, false)
    group by p.id, g.points_exact, g.points_outcome
  ), ranked as (
    select user_id, total_points, scored_matches, exact_hits, outcome_hits,
      rank() over (order by total_points desc, exact_hits desc) as rank,
      count(*) over ()                                          as total_players
    from board
  )
  select rank, total_points, scored_matches, exact_hits, outcome_hits, total_players
  from ranked where user_id = auth.uid();
$$;
