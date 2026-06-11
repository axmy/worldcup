-- ============================================================
-- Set the global submission deadline to half-time (45 min after kickoff)
-- ============================================================
-- The platform policy (see 0026) is set to "minutes_after_kickoff = 45": every
-- match accepts/edits predictions until 45 minutes into play, then locks for the
-- second half. Applies to all leagues (predictions are global). Done as a direct
-- UPDATE (not apply_deadline_policy(), which requires an admin session that a
-- migration doesn't have). The compute_deadline trigger recomputes each match's
-- submission_deadline = kickoff_time + 45 min, per row.

update public.app_settings
  set deadline_type = 'minutes_after_kickoff', deadline_value = '45'
  where id = 1;

update public.matches
  set deadline_type = 'minutes_after_kickoff', deadline_value = '45'
  where id is not null;  -- touch every row so the trigger recomputes the deadline
