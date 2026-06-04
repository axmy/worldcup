-- ============================================================
-- Per-league scoring & submission mode
-- ============================================================
-- Going public means every organizer runs their own contest rules. Scoring
-- weights and the single-vs-multiple submission rule move from the single
-- global app_settings row onto each league. app_settings KEEPS these columns —
-- they become the platform DEFAULTS applied to newly created leagues.

-- ---------- Per-league scoring columns ----------
alter table public.leagues
  add column if not exists points_exact    int  not null default 3,
  add column if not exists points_outcome  int  not null default 1,
  add column if not exists submission_mode text not null default 'multiple'
    check (submission_mode in ('single', 'multiple'));

-- Backfill existing leagues from the current global defaults so in-flight
-- contests keep their exact current behaviour (nothing re-scores differently).
update public.leagues l set
  points_exact    = s.points_exact,
  points_outcome  = s.points_outcome,
  submission_mode = s.submission_mode
from public.app_settings s
where s.id = 1;

-- ---------- Scoring trigger now reads EACH prediction's league ----------
-- The trg_score_predictions binding from 0001 stays; only the body changes so a
-- prediction is scored with its own league's weights.
create or replace function public.score_predictions()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.home_score is not null and new.away_score is not null then
    update public.predictions p
    set points = case
      when p.home_score = new.home_score and p.away_score = new.away_score then l.points_exact
      when sign(p.home_score - p.away_score) = sign(new.home_score - new.away_score) then l.points_outcome
      else 0
    end
    from public.leagues l
    where p.match_id = new.id
      and p.league_id = l.id;
  else
    update public.predictions set points = null where match_id = new.id;
  end if;
  return new;
end;
$$;

-- ---------- Standings: exact_hits uses THIS league's points_exact ----------
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
  -- only this member's predictions made IN this league
  left join public.predictions pr
    on pr.user_id = p.id and pr.league_id = lm.league_id
  where lm.league_id = p_league_id
    and (public.is_league_member(p_league_id) or public.is_admin())
  group by p.id, p.display_name;
$$;

-- ---------- Predictions UPDATE gate reads the LEAGUE's submission_mode ----------
-- Rebuilds the policy from 0009 with one change: submission_mode now comes from
-- the league, not app_settings. (The insert policy is unchanged.)
drop policy "update before deadline" on public.predictions;
create policy "update before deadline" on public.predictions
  for update using (
    auth.uid() = user_id
    and public.is_league_member(league_id)
    and now() >= coalesce(
      (select submission_open from public.matches where id = match_id),
      '-infinity'::timestamptz
    )
    and now() < (select submission_deadline from public.matches where id = match_id)
    and (select submission_mode from public.leagues where id = league_id) = 'multiple'
  )
  with check (auth.uid() = user_id and public.is_league_member(league_id));
