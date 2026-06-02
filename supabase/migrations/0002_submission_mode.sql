-- ============================================================
-- Submission mode: "single" (one shot) vs "multiple" (edit until deadline)
-- ============================================================
-- Tournament-wide rule, alongside the timezone / scoring weights.
--   'multiple' (default) — users may edit their prediction freely until the deadline.
--   'single'             — the first prediction locks; no edits afterwards.
alter table public.app_settings
  add column if not exists submission_mode text not null default 'multiple'
  check (submission_mode in ('single', 'multiple'));

-- The deadline lock already blocks updates after the cutoff. In 'single' mode we
-- additionally block ALL updates, so a user gets exactly one prediction per match.
-- (The initial INSERT is unaffected — that's the one allowed submission.)
-- A re-submit becomes an ON CONFLICT DO UPDATE, which this policy now rejects.
drop policy "update before deadline" on public.predictions;
create policy "update before deadline" on public.predictions
  for update using (
    auth.uid() = user_id
    and now() < (select submission_deadline from public.matches where id = match_id)
    and (select submission_mode from public.app_settings where id = 1) = 'multiple'
  )
  with check (auth.uid() = user_id);
