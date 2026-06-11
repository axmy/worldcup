-- ============================================================
-- In-play data from the results sync (live score + match clock)
-- ============================================================
-- The results cron now also writes while a match is in play: the current
-- score and Livescore's clock/status string ("23'", "45+2'", "HT", …).
-- Final results still land in home_score/away_score — which is what fires
-- the scoring trigger — so live_* is display-only and never scores anything.
--
-- The sync also re-anchors a 'minutes_after_kickoff' submission_deadline to
-- real minutes played (delayed kickoff extends the window, the half-time
-- whistle closes it). It writes submission_deadline directly; that is safe
-- because trg_compute_deadline only fires on kickoff_time / deadline_type /
-- deadline_value changes (see 0001), so the trigger won't overwrite it.

alter table public.matches
  add column if not exists live_home_score int,
  add column if not exists live_away_score int,
  add column if not exists live_status text;
