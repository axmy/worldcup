-- ============================================================
-- Keep the system admin (the predefined "Organizer") off every leaderboard
-- ============================================================
-- The predefined platform account is is_admin = true. It's auto-enrolled in the
-- global league and could otherwise appear in standings. Regular organizers are
-- NOT is_admin, so this filter hides only the system account.

-- ---------- Per-league standings ----------
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
      where pr.points = (select points_exact from public.leagues where id = p_league_id)
    )                                                      as exact_hits
  from public.league_members lm
  join public.profiles p on p.id = lm.user_id
  left join public.predictions pr
    on pr.user_id = p.id and pr.league_id = lm.league_id
  where lm.league_id = p_league_id
    and not coalesce(p.is_admin, false)
    and (public.is_league_member(p_league_id) or public.is_admin())
  group by p.id, p.display_name;
$$;

-- ---------- Global standings ----------
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
    coalesce(sum(pr.points), 0)                            as total_points,
    count(pr.points) filter (where pr.points is not null)  as scored_matches,
    count(*) filter (where pr.points = g.points_exact)     as exact_hits
  from public.leagues g
  join public.league_members lm on lm.league_id = g.id
  join public.profiles p on p.id = lm.user_id
  left join public.predictions pr
    on pr.user_id = p.id and pr.league_id = g.id
  where g.is_global
    and not coalesce(p.is_admin, false)
  group by p.id, p.display_name, g.points_exact;
$$;

-- ---------- Global rank (per-user) ----------
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
      coalesce(sum(pr.points), 0)                            as total_points,
      count(pr.points) filter (where pr.points is not null)  as scored_matches,
      count(*) filter (where pr.points = g.points_exact)     as exact_hits
    from public.leagues g
    join public.league_members lm on lm.league_id = g.id
    join public.profiles p on p.id = lm.user_id
    left join public.predictions pr on pr.user_id = p.id and pr.league_id = g.id
    where g.is_global
      and not coalesce(p.is_admin, false)
    group by p.id, g.points_exact
  ), ranked as (
    select
      user_id, total_points, scored_matches, exact_hits,
      rank() over (order by total_points desc, exact_hits desc) as rank,
      count(*) over ()                                          as total_players
    from board
  )
  select rank, total_points, scored_matches, exact_hits, total_players
  from ranked
  where user_id = auth.uid();
$$;

-- ---------- Global player count ----------
create or replace function public.global_player_count()
returns bigint language sql security definer stable
set search_path = public as $$
  select count(*)::bigint
  from public.league_members lm
  join public.leagues g on g.id = lm.league_id
  join public.profiles p on p.id = lm.user_id
  where g.is_global
    and not coalesce(p.is_admin, false);
$$;
