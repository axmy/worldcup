-- ============================================================
-- League owners can view their members' submitted predictions
-- ============================================================
-- Predictions are private by RLS (each user sees only their own). This adds a
-- SECURITY DEFINER function so a league's OWNER (or a platform admin) can see
-- what every member predicted for each match — but ONLY for matches that have
-- already locked (now >= submission_deadline), so an owner can never peek at
-- live picks before the deadline. Points are computed with THIS league's rules.

create or replace function public.league_member_picks(p_league_id uuid)
returns table (
  match_id     uuid,
  home_team    text,
  away_team    text,
  kickoff_time timestamptz,
  result_home  int,
  result_away  int,
  user_id      uuid,
  display_name text,
  pred_home    int,
  pred_away    int,
  points       int
) language sql security definer stable
set search_path = public as $$
  select
    m.id, m.home_team, m.away_team, m.kickoff_time,
    m.home_score, m.away_score,
    p.id, p.display_name,
    pr.home_score, pr.away_score,
    case
      when m.home_score is null or m.away_score is null then null
      when pr.home_score = m.home_score and pr.away_score = m.away_score then l.points_exact
      when sign(pr.home_score - pr.away_score) = sign(m.home_score - m.away_score) then l.points_outcome
      else 0
    end as points
  from public.leagues l
  join public.league_members lm on lm.league_id = l.id
  join public.profiles p        on p.id = lm.user_id
  join public.predictions pr     on pr.user_id = p.id
  join public.matches m          on m.id = pr.match_id
  where l.id = p_league_id
    and (l.created_by = auth.uid() or public.is_admin())  -- owner/admin only
    and now() >= m.submission_deadline                    -- locked matches only
    and not coalesce(p.is_admin, false)                   -- hide platform admin
  order by m.kickoff_time, p.display_name;
$$;
