-- ============================================================
-- Per-match submission window: an explicit "opens at" time
-- ============================================================
-- Until now a match accepted predictions from the moment it existed until its
-- deadline. This adds an explicit opening time so submissions are only allowed
-- within [submission_open, submission_deadline]. A null submission_open means
-- "open immediately" — the behaviour the already-seeded fixtures keep until an
-- admin sets a window.

alter table public.matches
  add column submission_open timestamptz;

-- Admins now set the window as explicit wall-clock times, so allow an explicit
-- close datetime alongside the original relative / time-of-day rules.
alter table public.matches drop constraint matches_deadline_type_check;
alter table public.matches
  add constraint matches_deadline_type_check
  check (deadline_type in ('minutes_before_kickoff', 'fixed_time_of_day', 'fixed_datetime'));

create or replace function public.compute_deadline()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  tz text;
  local_date date;
begin
  select tournament_timezone into tz from public.app_settings where id = 1;

  if new.deadline_type = 'minutes_before_kickoff' then
    new.submission_deadline := new.kickoff_time - ((new.deadline_value || ' minutes')::interval);

  elsif new.deadline_type = 'fixed_time_of_day' then
    -- The match's calendar day in the tournament timezone, at the given local time.
    local_date := (new.kickoff_time at time zone tz)::date;
    new.submission_deadline := (local_date + new.deadline_value::time) at time zone tz;

  elsif new.deadline_type = 'fixed_datetime' then
    -- deadline_value is an absolute ISO timestamp set by the admin.
    new.submission_deadline := new.deadline_value::timestamptz;
  end if;

  return new;
end;
$$;

-- ---------- RLS: predictions allowed only inside the window ----------
-- coalesce(submission_open, -infinity): a null open never blocks (legacy fixtures).
drop policy "insert before deadline" on public.predictions;
create policy "insert before deadline" on public.predictions
  for insert with check (
    auth.uid() = user_id
    and public.is_league_member(league_id)
    and now() >= coalesce(
      (select submission_open from public.matches where id = match_id),
      '-infinity'::timestamptz
    )
    and now() < (select submission_deadline from public.matches where id = match_id)
  );

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
    and (select submission_mode from public.app_settings where id = 1) = 'multiple'
  )
  with check (auth.uid() = user_id and public.is_league_member(league_id));
