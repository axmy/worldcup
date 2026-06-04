-- ============================================================
-- Scalable global leaderboard: per-user rank lookup
-- ============================================================
-- The global competition can have thousands of players, so the leaderboard
-- pages only render the top N (limit pushed into the query). global_rank()
-- lets the signed-in user see their own position + the total player count
-- without transferring the entire board.

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

grant execute on function public.global_rank() to authenticated;

-- Public total player count (works for logged-out visitors too, where
-- global_rank returns nothing).
create or replace function public.global_player_count()
returns bigint language sql security definer stable
set search_path = public as $$
  select count(*)::bigint
  from public.league_members lm
  join public.leagues g on g.id = lm.league_id
  where g.is_global;
$$;

grant execute on function public.global_player_count() to anon, authenticated;
