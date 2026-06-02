-- ============================================================
-- 2026 FIFA World Cup — group-stage fixtures (all 72 matches)
-- ============================================================
-- Groups follow the official Final Draw (Washington, D.C., 5 Dec 2025).
-- submission_deadline is recomputed by the compute_deadline() trigger on
-- insert; the value passed here is just a NOT NULL placeholder.
--
-- NOTE: matchups and groups are accurate; kickoff dates/times are a plausible
-- spread across the 11–27 June 2026 window (all UTC) rather than the exact
-- official slots — adjust in Admin → Fixtures if you need the real schedule.
--
-- Idempotent: only seeds when the matches table is empty, so it won't
-- duplicate fixtures an admin has already entered.

do $$
begin
  if exists (select 1 from public.matches) then
    return;
  end if;

  insert into public.matches
    (home_team, away_team, kickoff_time, deadline_type, deadline_value, submission_deadline)
  values
  -- ── Group A ──
  ('Mexico',        'South Africa',          '2026-06-11 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('South Korea',   'Czech Republic',        '2026-06-11 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Mexico',        'South Korea',           '2026-06-16 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('South Africa',  'Czech Republic',        '2026-06-16 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Mexico',        'Czech Republic',        '2026-06-20 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('South Africa',  'South Korea',           '2026-06-20 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  -- ── Group B ──
  ('Canada',        'Bosnia and Herzegovina','2026-06-11 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Qatar',         'Switzerland',           '2026-06-12 01:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Canada',        'Qatar',                 '2026-06-16 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Bosnia and Herzegovina','Switzerland',   '2026-06-17 01:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Canada',        'Switzerland',           '2026-06-20 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Bosnia and Herzegovina','Qatar',         '2026-06-20 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  -- ── Group C ──
  ('Brazil',        'Morocco',               '2026-06-12 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Haiti',         'Scotland',              '2026-06-12 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Brazil',        'Haiti',                 '2026-06-17 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Morocco',       'Scotland',              '2026-06-17 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Brazil',        'Scotland',              '2026-06-21 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Morocco',       'Haiti',                 '2026-06-21 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  -- ── Group D ──
  ('United States', 'Paraguay',              '2026-06-12 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Australia',     'Turkey',                '2026-06-13 01:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('United States', 'Australia',             '2026-06-17 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Paraguay',      'Turkey',                '2026-06-18 01:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('United States', 'Turkey',                '2026-06-21 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Paraguay',      'Australia',             '2026-06-21 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  -- ── Group E ──
  ('Germany',       'Curaçao',               '2026-06-13 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Ivory Coast',   'Ecuador',               '2026-06-13 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Germany',       'Ivory Coast',           '2026-06-18 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Curaçao',       'Ecuador',               '2026-06-18 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Germany',       'Ecuador',               '2026-06-22 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Curaçao',       'Ivory Coast',           '2026-06-22 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  -- ── Group F ──
  ('Netherlands',   'Japan',                 '2026-06-13 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Sweden',        'Tunisia',               '2026-06-14 01:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Netherlands',   'Sweden',                '2026-06-18 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Japan',         'Tunisia',               '2026-06-19 01:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Netherlands',   'Tunisia',               '2026-06-22 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Japan',         'Sweden',                '2026-06-22 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  -- ── Group G ──
  ('Belgium',       'Egypt',                 '2026-06-14 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Iran',          'New Zealand',           '2026-06-14 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Belgium',       'Iran',                  '2026-06-19 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Egypt',         'New Zealand',           '2026-06-19 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Belgium',       'New Zealand',           '2026-06-23 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Egypt',         'Iran',                  '2026-06-23 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  -- ── Group H ──
  ('Spain',         'Cape Verde',            '2026-06-14 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Saudi Arabia',  'Uruguay',               '2026-06-15 01:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Spain',         'Saudi Arabia',          '2026-06-19 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Cape Verde',    'Uruguay',               '2026-06-20 01:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Spain',         'Uruguay',               '2026-06-23 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Cape Verde',    'Saudi Arabia',          '2026-06-23 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  -- ── Group I ──
  ('France',        'Senegal',               '2026-06-15 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Iraq',          'Norway',                '2026-06-15 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('France',        'Iraq',                  '2026-06-20 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Senegal',       'Norway',                '2026-06-20 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('France',        'Norway',                '2026-06-24 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Senegal',       'Iraq',                  '2026-06-24 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  -- ── Group J ──
  ('Argentina',     'Algeria',               '2026-06-15 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Austria',       'Jordan',                '2026-06-16 01:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Argentina',     'Austria',               '2026-06-20 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Algeria',       'Jordan',                '2026-06-21 01:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Argentina',     'Jordan',                '2026-06-24 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Algeria',       'Austria',               '2026-06-24 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  -- ── Group K ──
  ('Portugal',      'DR Congo',              '2026-06-16 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Uzbekistan',    'Colombia',              '2026-06-16 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Portugal',      'Uzbekistan',            '2026-06-21 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('DR Congo',      'Colombia',              '2026-06-21 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Portugal',      'Colombia',              '2026-06-25 16:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('DR Congo',      'Uzbekistan',            '2026-06-25 19:00:00+00', 'minutes_before_kickoff', '75', now()),
  -- ── Group L ──
  ('England',       'Croatia',               '2026-06-16 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Ghana',         'Panama',                '2026-06-17 01:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('England',       'Ghana',                 '2026-06-21 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Croatia',       'Panama',                '2026-06-22 01:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('England',       'Panama',                '2026-06-25 22:00:00+00', 'minutes_before_kickoff', '75', now()),
  ('Croatia',       'Ghana',                 '2026-06-25 22:00:00+00', 'minutes_before_kickoff', '75', now());
end $$;
