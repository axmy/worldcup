-- ============================================================
-- Knockout-stage placeholder fixtures (closed until teams known)
-- ============================================================
-- Seeds the 32 knockout matches (Round of 32 → Final) with the official round
-- dates but PLACEHOLDER teams (real teams are unknown until the groups finish).
-- They're kept "closed": submission_open = kickoff_time, so they show as
-- upcoming and aren't predictable until an admin edits each one (set the real
-- teams + open the window) once results come in. Times are placeholders too.
--
-- Labels: R32-1A/R32-1B … (A/B = the two sides of that bracket match).

-- ---------- (a) Add knockouts to the CURRENT data (idempotent) ----------
do $$
begin
  if not exists (select 1 from public.matches where home_team = 'R32-1A') then
    insert into public.matches
      (home_team, away_team, kickoff_time, submission_open, deadline_type, deadline_value, submission_deadline)
    select home, away, kickoff, kickoff, 'minutes_before_kickoff', '75', kickoff
    from (values
      -- Round of 32 (Jun 28 – Jul 3)
      ('R32-1A','R32-1B','2026-06-28 19:00:00+00'::timestamptz),
      ('R32-2A','R32-2B','2026-06-28 23:00:00+00'::timestamptz),
      ('R32-3A','R32-3B','2026-06-29 17:00:00+00'::timestamptz),
      ('R32-4A','R32-4B','2026-06-29 20:00:00+00'::timestamptz),
      ('R32-5A','R32-5B','2026-06-29 23:00:00+00'::timestamptz),
      ('R32-6A','R32-6B','2026-06-30 17:00:00+00'::timestamptz),
      ('R32-7A','R32-7B','2026-06-30 20:00:00+00'::timestamptz),
      ('R32-8A','R32-8B','2026-06-30 23:00:00+00'::timestamptz),
      ('R32-9A','R32-9B','2026-07-01 17:00:00+00'::timestamptz),
      ('R32-10A','R32-10B','2026-07-01 20:00:00+00'::timestamptz),
      ('R32-11A','R32-11B','2026-07-01 23:00:00+00'::timestamptz),
      ('R32-12A','R32-12B','2026-07-02 17:00:00+00'::timestamptz),
      ('R32-13A','R32-13B','2026-07-02 20:00:00+00'::timestamptz),
      ('R32-14A','R32-14B','2026-07-02 23:00:00+00'::timestamptz),
      ('R32-15A','R32-15B','2026-07-03 19:00:00+00'::timestamptz),
      ('R32-16A','R32-16B','2026-07-03 23:00:00+00'::timestamptz),
      -- Round of 16 (Jul 4 – 7)
      ('R16-1A','R16-1B','2026-07-04 19:00:00+00'::timestamptz),
      ('R16-2A','R16-2B','2026-07-04 23:00:00+00'::timestamptz),
      ('R16-3A','R16-3B','2026-07-05 19:00:00+00'::timestamptz),
      ('R16-4A','R16-4B','2026-07-05 23:00:00+00'::timestamptz),
      ('R16-5A','R16-5B','2026-07-06 19:00:00+00'::timestamptz),
      ('R16-6A','R16-6B','2026-07-06 23:00:00+00'::timestamptz),
      ('R16-7A','R16-7B','2026-07-07 19:00:00+00'::timestamptz),
      ('R16-8A','R16-8B','2026-07-07 23:00:00+00'::timestamptz),
      -- Quarter-finals (Jul 9 – 11)
      ('QF-1A','QF-1B','2026-07-09 20:00:00+00'::timestamptz),
      ('QF-2A','QF-2B','2026-07-10 20:00:00+00'::timestamptz),
      ('QF-3A','QF-3B','2026-07-11 16:00:00+00'::timestamptz),
      ('QF-4A','QF-4B','2026-07-11 20:00:00+00'::timestamptz),
      -- Semi-finals (Jul 14 – 15)
      ('SF-1A','SF-1B','2026-07-14 19:00:00+00'::timestamptz),
      ('SF-2A','SF-2B','2026-07-15 19:00:00+00'::timestamptz),
      -- Third place (Jul 18) & Final (Jul 19)
      ('Third-A','Third-B','2026-07-18 20:00:00+00'::timestamptz),
      ('Final-A','Final-B','2026-07-19 19:00:00+00'::timestamptz)
    ) as v(home, away, kickoff);
  end if;
end $$;

-- ---------- (b) Rebuild the seed so a fresh seed includes knockouts ----------
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

  -- Group stage (real times; open per their own deadline rule).
  insert into public.matches
    (home_team, away_team, kickoff_time, deadline_type, deadline_value, submission_deadline)
  values
  ('Mexico','South Africa','2026-06-11 19:00:00+00','minutes_before_kickoff','75',now()),
  ('South Korea','Czech Republic','2026-06-12 02:00:00+00','minutes_before_kickoff','75',now()),
  ('Mexico','South Korea','2026-06-19 01:00:00+00','minutes_before_kickoff','75',now()),
  ('South Africa','Czech Republic','2026-06-18 16:00:00+00','minutes_before_kickoff','75',now()),
  ('Mexico','Czech Republic','2026-06-25 01:00:00+00','minutes_before_kickoff','75',now()),
  ('South Africa','South Korea','2026-06-25 01:00:00+00','minutes_before_kickoff','75',now()),
  ('Canada','Bosnia and Herzegovina','2026-06-12 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Qatar','Switzerland','2026-06-13 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Canada','Qatar','2026-06-18 22:00:00+00','minutes_before_kickoff','75',now()),
  ('Bosnia and Herzegovina','Switzerland','2026-06-18 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Canada','Switzerland','2026-06-24 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Bosnia and Herzegovina','Qatar','2026-06-24 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Brazil','Morocco','2026-06-13 22:00:00+00','minutes_before_kickoff','75',now()),
  ('Haiti','Scotland','2026-06-14 01:00:00+00','minutes_before_kickoff','75',now()),
  ('Brazil','Haiti','2026-06-20 01:00:00+00','minutes_before_kickoff','75',now()),
  ('Morocco','Scotland','2026-06-19 22:00:00+00','minutes_before_kickoff','75',now()),
  ('Brazil','Scotland','2026-06-24 22:00:00+00','minutes_before_kickoff','75',now()),
  ('Morocco','Haiti','2026-06-24 22:00:00+00','minutes_before_kickoff','75',now()),
  ('United States','Paraguay','2026-06-13 01:00:00+00','minutes_before_kickoff','75',now()),
  ('Australia','Turkey','2026-06-13 04:00:00+00','minutes_before_kickoff','75',now()),
  ('United States','Australia','2026-06-19 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Paraguay','Turkey','2026-06-19 04:00:00+00','minutes_before_kickoff','75',now()),
  ('United States','Turkey','2026-06-26 02:00:00+00','minutes_before_kickoff','75',now()),
  ('Paraguay','Australia','2026-06-26 02:00:00+00','minutes_before_kickoff','75',now()),
  ('Germany','Curaçao','2026-06-14 17:00:00+00','minutes_before_kickoff','75',now()),
  ('Ivory Coast','Ecuador','2026-06-14 23:00:00+00','minutes_before_kickoff','75',now()),
  ('Germany','Ivory Coast','2026-06-20 20:00:00+00','minutes_before_kickoff','75',now()),
  ('Curaçao','Ecuador','2026-06-21 00:00:00+00','minutes_before_kickoff','75',now()),
  ('Germany','Ecuador','2026-06-25 20:00:00+00','minutes_before_kickoff','75',now()),
  ('Curaçao','Ivory Coast','2026-06-25 20:00:00+00','minutes_before_kickoff','75',now()),
  ('Netherlands','Japan','2026-06-14 20:00:00+00','minutes_before_kickoff','75',now()),
  ('Sweden','Tunisia','2026-06-15 02:00:00+00','minutes_before_kickoff','75',now()),
  ('Netherlands','Sweden','2026-06-20 17:00:00+00','minutes_before_kickoff','75',now()),
  ('Japan','Tunisia','2026-06-20 04:00:00+00','minutes_before_kickoff','75',now()),
  ('Netherlands','Tunisia','2026-06-25 23:00:00+00','minutes_before_kickoff','75',now()),
  ('Japan','Sweden','2026-06-25 23:00:00+00','minutes_before_kickoff','75',now()),
  ('Belgium','Egypt','2026-06-15 22:00:00+00','minutes_before_kickoff','75',now()),
  ('Iran','New Zealand','2026-06-15 04:00:00+00','minutes_before_kickoff','75',now()),
  ('Belgium','Iran','2026-06-21 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Egypt','New Zealand','2026-06-22 01:00:00+00','minutes_before_kickoff','75',now()),
  ('Belgium','New Zealand','2026-06-27 03:00:00+00','minutes_before_kickoff','75',now()),
  ('Egypt','Iran','2026-06-27 03:00:00+00','minutes_before_kickoff','75',now()),
  ('Spain','Cape Verde','2026-06-15 17:00:00+00','minutes_before_kickoff','75',now()),
  ('Saudi Arabia','Uruguay','2026-06-15 22:00:00+00','minutes_before_kickoff','75',now()),
  ('Spain','Saudi Arabia','2026-06-21 16:00:00+00','minutes_before_kickoff','75',now()),
  ('Cape Verde','Uruguay','2026-06-21 22:00:00+00','minutes_before_kickoff','75',now()),
  ('Spain','Uruguay','2026-06-27 00:00:00+00','minutes_before_kickoff','75',now()),
  ('Cape Verde','Saudi Arabia','2026-06-27 00:00:00+00','minutes_before_kickoff','75',now()),
  ('France','Senegal','2026-06-16 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Iraq','Norway','2026-06-16 22:00:00+00','minutes_before_kickoff','75',now()),
  ('France','Iraq','2026-06-22 21:00:00+00','minutes_before_kickoff','75',now()),
  ('Senegal','Norway','2026-06-23 00:00:00+00','minutes_before_kickoff','75',now()),
  ('France','Norway','2026-06-26 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Senegal','Iraq','2026-06-26 19:00:00+00','minutes_before_kickoff','75',now()),
  ('Argentina','Algeria','2026-06-17 01:00:00+00','minutes_before_kickoff','75',now()),
  ('Austria','Jordan','2026-06-16 04:00:00+00','minutes_before_kickoff','75',now()),
  ('Argentina','Austria','2026-06-22 17:00:00+00','minutes_before_kickoff','75',now()),
  ('Algeria','Jordan','2026-06-23 03:00:00+00','minutes_before_kickoff','75',now()),
  ('Argentina','Jordan','2026-06-28 02:00:00+00','minutes_before_kickoff','75',now()),
  ('Algeria','Austria','2026-06-28 02:00:00+00','minutes_before_kickoff','75',now()),
  ('Portugal','DR Congo','2026-06-17 17:00:00+00','minutes_before_kickoff','75',now()),
  ('Uzbekistan','Colombia','2026-06-18 02:00:00+00','minutes_before_kickoff','75',now()),
  ('Portugal','Uzbekistan','2026-06-23 17:00:00+00','minutes_before_kickoff','75',now()),
  ('DR Congo','Colombia','2026-06-24 02:00:00+00','minutes_before_kickoff','75',now()),
  ('Portugal','Colombia','2026-06-27 23:30:00+00','minutes_before_kickoff','75',now()),
  ('DR Congo','Uzbekistan','2026-06-27 23:30:00+00','minutes_before_kickoff','75',now()),
  ('England','Croatia','2026-06-17 20:00:00+00','minutes_before_kickoff','75',now()),
  ('Ghana','Panama','2026-06-17 23:00:00+00','minutes_before_kickoff','75',now()),
  ('England','Ghana','2026-06-23 20:00:00+00','minutes_before_kickoff','75',now()),
  ('Croatia','Panama','2026-06-23 23:00:00+00','minutes_before_kickoff','75',now()),
  ('England','Panama','2026-06-27 21:00:00+00','minutes_before_kickoff','75',now()),
  ('Croatia','Ghana','2026-06-27 21:00:00+00','minutes_before_kickoff','75',now());

  -- Knockouts (placeholder teams; closed: submission_open = kickoff).
  insert into public.matches
    (home_team, away_team, kickoff_time, submission_open, deadline_type, deadline_value, submission_deadline)
  select home, away, kickoff, kickoff, 'minutes_before_kickoff', '75', kickoff
  from (values
    ('R32-1A','R32-1B','2026-06-28 19:00:00+00'::timestamptz),
    ('R32-2A','R32-2B','2026-06-28 23:00:00+00'::timestamptz),
    ('R32-3A','R32-3B','2026-06-29 17:00:00+00'::timestamptz),
    ('R32-4A','R32-4B','2026-06-29 20:00:00+00'::timestamptz),
    ('R32-5A','R32-5B','2026-06-29 23:00:00+00'::timestamptz),
    ('R32-6A','R32-6B','2026-06-30 17:00:00+00'::timestamptz),
    ('R32-7A','R32-7B','2026-06-30 20:00:00+00'::timestamptz),
    ('R32-8A','R32-8B','2026-06-30 23:00:00+00'::timestamptz),
    ('R32-9A','R32-9B','2026-07-01 17:00:00+00'::timestamptz),
    ('R32-10A','R32-10B','2026-07-01 20:00:00+00'::timestamptz),
    ('R32-11A','R32-11B','2026-07-01 23:00:00+00'::timestamptz),
    ('R32-12A','R32-12B','2026-07-02 17:00:00+00'::timestamptz),
    ('R32-13A','R32-13B','2026-07-02 20:00:00+00'::timestamptz),
    ('R32-14A','R32-14B','2026-07-02 23:00:00+00'::timestamptz),
    ('R32-15A','R32-15B','2026-07-03 19:00:00+00'::timestamptz),
    ('R32-16A','R32-16B','2026-07-03 23:00:00+00'::timestamptz),
    ('R16-1A','R16-1B','2026-07-04 19:00:00+00'::timestamptz),
    ('R16-2A','R16-2B','2026-07-04 23:00:00+00'::timestamptz),
    ('R16-3A','R16-3B','2026-07-05 19:00:00+00'::timestamptz),
    ('R16-4A','R16-4B','2026-07-05 23:00:00+00'::timestamptz),
    ('R16-5A','R16-5B','2026-07-06 19:00:00+00'::timestamptz),
    ('R16-6A','R16-6B','2026-07-06 23:00:00+00'::timestamptz),
    ('R16-7A','R16-7B','2026-07-07 19:00:00+00'::timestamptz),
    ('R16-8A','R16-8B','2026-07-07 23:00:00+00'::timestamptz),
    ('QF-1A','QF-1B','2026-07-09 20:00:00+00'::timestamptz),
    ('QF-2A','QF-2B','2026-07-10 20:00:00+00'::timestamptz),
    ('QF-3A','QF-3B','2026-07-11 16:00:00+00'::timestamptz),
    ('QF-4A','QF-4B','2026-07-11 20:00:00+00'::timestamptz),
    ('SF-1A','SF-1B','2026-07-14 19:00:00+00'::timestamptz),
    ('SF-2A','SF-2B','2026-07-15 19:00:00+00'::timestamptz),
    ('Third-A','Third-B','2026-07-18 20:00:00+00'::timestamptz),
    ('Final-A','Final-B','2026-07-19 19:00:00+00'::timestamptz)
  ) as v(home, away, kickoff);

  get diagnostics v_count = row_count;
  return v_count + 72;
end;
$$;
