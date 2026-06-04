-- ============================================================
-- Correct WC2026 group-stage kickoff times (real schedule)
-- ============================================================
-- The matchups/groups were correct but kickoff times were placeholders. FIFA
-- publishes kickoff times in ET (UTC-4 in Jun 2026), so stored UTC = ET + 4h.
-- Group A & B verified against the official livescore schedule (Maldives time).
-- This (a) corrects any already-seeded fixtures in place (keeping predictions),
-- and (b) rebuilds seed_wc2026_fixtures() so a fresh seed uses the real times.
--
-- Knockouts are intentionally not seeded here: teams are unknown until the
-- groups finish, and the API-Football import resolves them with real teams.

-- ---------- (a) Correct existing fixtures in place ----------
-- Matched by unordered team pair, so it works regardless of home/away order.
-- Skips rows already mapped to a provider fixture (external_ref) so an API
-- import isn't clobbered.
update public.matches m
set kickoff_time = v.kickoff
from (values
  ('Mexico','South Africa','2026-06-11 19:00:00+00'::timestamptz),
  ('South Korea','Czech Republic','2026-06-12 02:00:00+00'),
  ('Mexico','South Korea','2026-06-19 01:00:00+00'),
  ('South Africa','Czech Republic','2026-06-18 16:00:00+00'),
  ('Mexico','Czech Republic','2026-06-25 01:00:00+00'),
  ('South Africa','South Korea','2026-06-25 01:00:00+00'),
  ('Canada','Bosnia and Herzegovina','2026-06-12 19:00:00+00'),
  ('Qatar','Switzerland','2026-06-13 19:00:00+00'),
  ('Canada','Qatar','2026-06-18 22:00:00+00'),
  ('Bosnia and Herzegovina','Switzerland','2026-06-18 19:00:00+00'),
  ('Canada','Switzerland','2026-06-24 19:00:00+00'),
  ('Bosnia and Herzegovina','Qatar','2026-06-24 19:00:00+00'),
  ('Brazil','Morocco','2026-06-13 22:00:00+00'),
  ('Haiti','Scotland','2026-06-14 01:00:00+00'),
  ('Brazil','Haiti','2026-06-20 01:00:00+00'),
  ('Morocco','Scotland','2026-06-19 22:00:00+00'),
  ('Brazil','Scotland','2026-06-24 22:00:00+00'),
  ('Morocco','Haiti','2026-06-24 22:00:00+00'),
  ('United States','Paraguay','2026-06-13 01:00:00+00'),
  ('Australia','Turkey','2026-06-13 04:00:00+00'),
  ('United States','Australia','2026-06-19 19:00:00+00'),
  ('Paraguay','Turkey','2026-06-19 04:00:00+00'),
  ('United States','Turkey','2026-06-26 02:00:00+00'),
  ('Paraguay','Australia','2026-06-26 02:00:00+00'),
  ('Germany','Curaçao','2026-06-14 17:00:00+00'),
  ('Ivory Coast','Ecuador','2026-06-14 23:00:00+00'),
  ('Germany','Ivory Coast','2026-06-20 20:00:00+00'),
  ('Curaçao','Ecuador','2026-06-21 00:00:00+00'),
  ('Germany','Ecuador','2026-06-25 20:00:00+00'),
  ('Curaçao','Ivory Coast','2026-06-25 20:00:00+00'),
  ('Netherlands','Japan','2026-06-14 20:00:00+00'),
  ('Sweden','Tunisia','2026-06-15 02:00:00+00'),
  ('Netherlands','Sweden','2026-06-20 17:00:00+00'),
  ('Japan','Tunisia','2026-06-20 04:00:00+00'),
  ('Netherlands','Tunisia','2026-06-25 23:00:00+00'),
  ('Japan','Sweden','2026-06-25 23:00:00+00'),
  ('Belgium','Egypt','2026-06-15 22:00:00+00'),
  ('Iran','New Zealand','2026-06-15 04:00:00+00'),
  ('Belgium','Iran','2026-06-21 19:00:00+00'),
  ('Egypt','New Zealand','2026-06-22 01:00:00+00'),
  ('Belgium','New Zealand','2026-06-27 03:00:00+00'),
  ('Egypt','Iran','2026-06-27 03:00:00+00'),
  ('Spain','Cape Verde','2026-06-15 17:00:00+00'),
  ('Saudi Arabia','Uruguay','2026-06-15 22:00:00+00'),
  ('Spain','Saudi Arabia','2026-06-21 16:00:00+00'),
  ('Cape Verde','Uruguay','2026-06-21 22:00:00+00'),
  ('Spain','Uruguay','2026-06-27 00:00:00+00'),
  ('Cape Verde','Saudi Arabia','2026-06-27 00:00:00+00'),
  ('France','Senegal','2026-06-16 19:00:00+00'),
  ('Iraq','Norway','2026-06-16 22:00:00+00'),
  ('France','Iraq','2026-06-22 21:00:00+00'),
  ('Senegal','Norway','2026-06-23 00:00:00+00'),
  ('France','Norway','2026-06-26 19:00:00+00'),
  ('Senegal','Iraq','2026-06-26 19:00:00+00'),
  ('Argentina','Algeria','2026-06-17 01:00:00+00'),
  ('Austria','Jordan','2026-06-16 04:00:00+00'),
  ('Argentina','Austria','2026-06-22 17:00:00+00'),
  ('Algeria','Jordan','2026-06-23 03:00:00+00'),
  ('Argentina','Jordan','2026-06-28 02:00:00+00'),
  ('Algeria','Austria','2026-06-28 02:00:00+00'),
  ('Portugal','DR Congo','2026-06-17 17:00:00+00'),
  ('Uzbekistan','Colombia','2026-06-18 02:00:00+00'),
  ('Portugal','Uzbekistan','2026-06-23 17:00:00+00'),
  ('DR Congo','Colombia','2026-06-24 02:00:00+00'),
  ('Portugal','Colombia','2026-06-27 23:30:00+00'),
  ('DR Congo','Uzbekistan','2026-06-27 23:30:00+00'),
  ('England','Croatia','2026-06-17 20:00:00+00'),
  ('Ghana','Panama','2026-06-17 23:00:00+00'),
  ('England','Ghana','2026-06-23 20:00:00+00'),
  ('Croatia','Panama','2026-06-23 23:00:00+00'),
  ('England','Panama','2026-06-27 21:00:00+00'),
  ('Croatia','Ghana','2026-06-27 21:00:00+00')
) as v(home, away, kickoff)
where m.external_ref is null
  and (
    (lower(m.home_team) = lower(v.home) and lower(m.away_team) = lower(v.away))
    or (lower(m.home_team) = lower(v.away) and lower(m.away_team) = lower(v.home))
  );

-- ---------- (b) Rebuild the runtime seed with the real times ----------
create or replace function public.seed_wc2026_fixtures()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if exists (select 1 from public.matches) then return 0; end if;

  insert into public.matches
    (home_team, away_team, kickoff_time, deadline_type, deadline_value, submission_deadline)
  values
  -- Group A
  ('Mexico','South Africa','2026-06-11 19:00:00+00','minutes_before_kickoff','75',now()),
  ('South Korea','Czech Republic','2026-06-12 02:00:00+00','minutes_before_kickoff','75',now()),
  ('Mexico','South Korea','2026-06-19 01:00:00+00','minutes_before_kickoff','75',now()),
  ('South Africa','Czech Republic','2026-06-18 16:00:00+00','minutes_before_kickoff','75',now()),
  ('Mexico','Czech Republic','2026-06-25 01:00:00+00','minutes_before_kickoff','75',now()),
  ('South Africa','South Korea','2026-06-25 01:00:00+00','minutes_before_kickoff','75',now()),
  -- Group B
  ('Canada','Bosnia and Herzegovina','2026-06-12 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Qatar','Switzerland','2026-06-13 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Canada','Qatar','2026-06-18 22:00:00+00','minutes_before_kickoff','75',now()),
  ('Bosnia and Herzegovina','Switzerland','2026-06-18 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Canada','Switzerland','2026-06-24 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Bosnia and Herzegovina','Qatar','2026-06-24 19:00:00+00','minutes_before_kickoff','75',now()),
  -- Group C
  ('Brazil','Morocco','2026-06-13 22:00:00+00','minutes_before_kickoff','75',now()),
  ('Haiti','Scotland','2026-06-14 01:00:00+00','minutes_before_kickoff','75',now()),
  ('Brazil','Haiti','2026-06-20 01:00:00+00','minutes_before_kickoff','75',now()),
  ('Morocco','Scotland','2026-06-19 22:00:00+00','minutes_before_kickoff','75',now()),
  ('Brazil','Scotland','2026-06-24 22:00:00+00','minutes_before_kickoff','75',now()),
  ('Morocco','Haiti','2026-06-24 22:00:00+00','minutes_before_kickoff','75',now()),
  -- Group D
  ('United States','Paraguay','2026-06-13 01:00:00+00','minutes_before_kickoff','75',now()),
  ('Australia','Turkey','2026-06-13 04:00:00+00','minutes_before_kickoff','75',now()),
  ('United States','Australia','2026-06-19 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Paraguay','Turkey','2026-06-19 04:00:00+00','minutes_before_kickoff','75',now()),
  ('United States','Turkey','2026-06-26 02:00:00+00','minutes_before_kickoff','75',now()),
  ('Paraguay','Australia','2026-06-26 02:00:00+00','minutes_before_kickoff','75',now()),
  -- Group E
  ('Germany','Curaçao','2026-06-14 17:00:00+00','minutes_before_kickoff','75',now()),
  ('Ivory Coast','Ecuador','2026-06-14 23:00:00+00','minutes_before_kickoff','75',now()),
  ('Germany','Ivory Coast','2026-06-20 20:00:00+00','minutes_before_kickoff','75',now()),
  ('Curaçao','Ecuador','2026-06-21 00:00:00+00','minutes_before_kickoff','75',now()),
  ('Germany','Ecuador','2026-06-25 20:00:00+00','minutes_before_kickoff','75',now()),
  ('Curaçao','Ivory Coast','2026-06-25 20:00:00+00','minutes_before_kickoff','75',now()),
  -- Group F
  ('Netherlands','Japan','2026-06-14 20:00:00+00','minutes_before_kickoff','75',now()),
  ('Sweden','Tunisia','2026-06-15 02:00:00+00','minutes_before_kickoff','75',now()),
  ('Netherlands','Sweden','2026-06-20 17:00:00+00','minutes_before_kickoff','75',now()),
  ('Japan','Tunisia','2026-06-20 04:00:00+00','minutes_before_kickoff','75',now()),
  ('Netherlands','Tunisia','2026-06-25 23:00:00+00','minutes_before_kickoff','75',now()),
  ('Japan','Sweden','2026-06-25 23:00:00+00','minutes_before_kickoff','75',now()),
  -- Group G
  ('Belgium','Egypt','2026-06-15 22:00:00+00','minutes_before_kickoff','75',now()),
  ('Iran','New Zealand','2026-06-15 04:00:00+00','minutes_before_kickoff','75',now()),
  ('Belgium','Iran','2026-06-21 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Egypt','New Zealand','2026-06-22 01:00:00+00','minutes_before_kickoff','75',now()),
  ('Belgium','New Zealand','2026-06-27 03:00:00+00','minutes_before_kickoff','75',now()),
  ('Egypt','Iran','2026-06-27 03:00:00+00','minutes_before_kickoff','75',now()),
  -- Group H
  ('Spain','Cape Verde','2026-06-15 17:00:00+00','minutes_before_kickoff','75',now()),
  ('Saudi Arabia','Uruguay','2026-06-15 22:00:00+00','minutes_before_kickoff','75',now()),
  ('Spain','Saudi Arabia','2026-06-21 16:00:00+00','minutes_before_kickoff','75',now()),
  ('Cape Verde','Uruguay','2026-06-21 22:00:00+00','minutes_before_kickoff','75',now()),
  ('Spain','Uruguay','2026-06-27 00:00:00+00','minutes_before_kickoff','75',now()),
  ('Cape Verde','Saudi Arabia','2026-06-27 00:00:00+00','minutes_before_kickoff','75',now()),
  -- Group I
  ('France','Senegal','2026-06-16 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Iraq','Norway','2026-06-16 22:00:00+00','minutes_before_kickoff','75',now()),
  ('France','Iraq','2026-06-22 21:00:00+00','minutes_before_kickoff','75',now()),
  ('Senegal','Norway','2026-06-23 00:00:00+00','minutes_before_kickoff','75',now()),
  ('France','Norway','2026-06-26 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Senegal','Iraq','2026-06-26 19:00:00+00','minutes_before_kickoff','75',now()),
  -- Group J
  ('Argentina','Algeria','2026-06-17 01:00:00+00','minutes_before_kickoff','75',now()),
  ('Austria','Jordan','2026-06-16 04:00:00+00','minutes_before_kickoff','75',now()),
  ('Argentina','Austria','2026-06-22 17:00:00+00','minutes_before_kickoff','75',now()),
  ('Algeria','Jordan','2026-06-23 03:00:00+00','minutes_before_kickoff','75',now()),
  ('Argentina','Jordan','2026-06-28 02:00:00+00','minutes_before_kickoff','75',now()),
  ('Algeria','Austria','2026-06-28 02:00:00+00','minutes_before_kickoff','75',now()),
  -- Group K
  ('Portugal','DR Congo','2026-06-17 17:00:00+00','minutes_before_kickoff','75',now()),
  ('Uzbekistan','Colombia','2026-06-18 02:00:00+00','minutes_before_kickoff','75',now()),
  ('Portugal','Uzbekistan','2026-06-23 17:00:00+00','minutes_before_kickoff','75',now()),
  ('DR Congo','Colombia','2026-06-24 02:00:00+00','minutes_before_kickoff','75',now()),
  ('Portugal','Colombia','2026-06-27 23:30:00+00','minutes_before_kickoff','75',now()),
  ('DR Congo','Uzbekistan','2026-06-27 23:30:00+00','minutes_before_kickoff','75',now()),
  -- Group L
  ('England','Croatia','2026-06-17 20:00:00+00','minutes_before_kickoff','75',now()),
  ('Ghana','Panama','2026-06-17 23:00:00+00','minutes_before_kickoff','75',now()),
  ('England','Ghana','2026-06-23 20:00:00+00','minutes_before_kickoff','75',now()),
  ('Croatia','Panama','2026-06-23 23:00:00+00','minutes_before_kickoff','75',now()),
  ('England','Panama','2026-06-27 21:00:00+00','minutes_before_kickoff','75',now()),
  ('Croatia','Ghana','2026-06-27 21:00:00+00','minutes_before_kickoff','75',now());

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
