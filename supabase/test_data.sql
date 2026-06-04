-- ============================================================
-- LOCAL TEST DATA — controlled match states (NOT a migration)
-- ============================================================
-- Replaces fixtures with a handful of matches in every status (relative to
-- now()), plus two test players with predictions, so you can verify:
--   • OPEN        → can submit / edit
--   • LOCKED      → cannot submit (deadline passed)
--   • UPCOMING    → cannot submit yet (window not open)
--   • FINAL       → scoring shows in standings
--
-- Run against the LOCAL db only:
--   docker exec -i $(docker ps --format '{{.Names}}' | grep supabase_db) \
--     psql -U postgres -d postgres < supabase/test_data.sql
--
-- Test players (email / password): testa@local / Test1234!,  testb@local / Test1234!
-- After running, restart `npm run dev` (the matches list is cached ~5 min).

begin;

-- ---------- Fresh fixtures in controlled states ----------
delete from public.matches;  -- cascades predictions on those matches

insert into public.matches
  (home_team, away_team, kickoff_time, deadline_type, deadline_value, submission_deadline, submission_open)
values
  -- LOCKED: kicked off 30 min ago → deadline (75m before) is well past
  ('Brazil','Argentina',        now() - interval '30 minutes', 'minutes_before_kickoff','75', now(), null),
  -- OPEN: kickoff in 2h → closes in ~45 min
  ('France','Spain',            now() + interval '2 hours',    'minutes_before_kickoff','75', now(), null),
  -- OPEN, CLOSING SOON: kickoff in 80 min → closes in ~5 min
  ('England','Germany',         now() + interval '80 minutes', 'minutes_before_kickoff','75', now(), null),
  -- UPCOMING: predictions open tomorrow, kickoff in 2 days
  ('Portugal','Netherlands',    now() + interval '2 days',     'minutes_before_kickoff','75', now(), now() + interval '1 day'),
  -- FINAL (results set below): kicked off hours ago
  ('Italy','Croatia',           now() - interval '3 hours',    'minutes_before_kickoff','75', now(), null),
  ('Belgium','Morocco',         now() - interval '5 hours',    'minutes_before_kickoff','75', now(), null);

-- ---------- Two test players (auth user → profile + global enrolment via triggers) ----------
do $$
declare ids text[] := array['testa@local','testb@local'];
declare names text[] := array['Test A','Test B'];
declare i int; uid uuid;
begin
  for i in 1..2 loop
    if not exists (select 1 from auth.users where email = ids[i]) then
      uid := gen_random_uuid();
      insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token
      ) values (
        uid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated', ids[i],
        extensions.crypt('Test1234!', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('display_name', names[i]), now(), now(),
        '','','','','','','',''
      );
      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', ids[i], 'email_verified', true), 'email', now(), now(), now());
    end if;
  end loop;
end $$;

-- ---------- Predictions (direct insert bypasses the deadline RLS) ----------
-- Test A: exact on Italy (2-1), draw on Belgium (1-1)
insert into public.predictions (user_id, match_id, home_score, away_score)
select u.id, m.id, 2, 1 from auth.users u, public.matches m
  where u.email='testa@local' and m.home_team='Italy' and m.away_team='Croatia'
on conflict (user_id, match_id) do update set home_score=excluded.home_score, away_score=excluded.away_score;
insert into public.predictions (user_id, match_id, home_score, away_score)
select u.id, m.id, 1, 1 from auth.users u, public.matches m
  where u.email='testa@local' and m.home_team='Belgium' and m.away_team='Morocco'
on conflict (user_id, match_id) do update set home_score=excluded.home_score, away_score=excluded.away_score;

-- Test B: outcome-only on Italy (1-0), exact on Belgium (0-0)
insert into public.predictions (user_id, match_id, home_score, away_score)
select u.id, m.id, 1, 0 from auth.users u, public.matches m
  where u.email='testb@local' and m.home_team='Italy' and m.away_team='Croatia'
on conflict (user_id, match_id) do update set home_score=excluded.home_score, away_score=excluded.away_score;
insert into public.predictions (user_id, match_id, home_score, away_score)
select u.id, m.id, 0, 0 from auth.users u, public.matches m
  where u.email='testb@local' and m.home_team='Belgium' and m.away_team='Morocco'
on conflict (user_id, match_id) do update set home_score=excluded.home_score, away_score=excluded.away_score;

-- ---------- Publish the two finals (fires the scoring trigger) ----------
update public.matches set home_score=2, away_score=1 where home_team='Italy'   and away_team='Croatia';
update public.matches set home_score=0, away_score=0 where home_team='Belgium' and away_team='Morocco';

commit;

-- ---------- Expected global standings (global rules 3/1) ----------
--   Test A: Italy 2-1 exact (+3) + Belgium 1-1 = draw, actual 0-0 draw → outcome (+1) = 4
--   Test B: Italy 1-0 → Italy win, actual 2-1 Italy win → outcome (+1) + Belgium 0-0 exact (+3) = 4
select display_name, total_points, scored_matches, exact_hits
from public.global_standings() order by total_points desc;
