-- ============================================================
-- Platform-wide submission deadline policy
-- ============================================================
-- Predictions are global (one pick per match, shared across every league), so
-- the submit deadline must be a single platform setting — not per league. The
-- platform admin picks ONE policy and it applies to every match:
--   • 'minutes_before_kickoff' value N  → closes N min before kickoff
--                                          (N = 0 means "at kickoff")
--   • 'minutes_after_kickoff'  value N  → closes N min INTO the match
--                                          (e.g. 45 = before the second half)
-- The policy lives on app_settings; applying it bulk-rewrites every match's rule
-- (the compute_deadline trigger recomputes submission_deadline per row).

-- ---------- New deadline mode: minutes after kickoff ----------
alter table public.matches drop constraint if exists matches_deadline_type_check;
alter table public.matches
  add constraint matches_deadline_type_check
  check (deadline_type in (
    'minutes_before_kickoff', 'minutes_after_kickoff',
    'fixed_time_of_day', 'fixed_datetime'
  ));

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

  elsif new.deadline_type = 'minutes_after_kickoff' then
    -- Allow edits until N minutes into the match (N=45 → before the second half).
    new.submission_deadline := new.kickoff_time + ((new.deadline_value || ' minutes')::interval);

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

-- ---------- Platform deadline policy (the current default) ----------
alter table public.app_settings
  add column if not exists deadline_type  text not null default 'minutes_before_kickoff',
  add column if not exists deadline_value text not null default '75';

alter table public.app_settings drop constraint if exists app_settings_deadline_type_check;
alter table public.app_settings
  add constraint app_settings_deadline_type_check
  check (deadline_type in ('minutes_before_kickoff', 'minutes_after_kickoff'));

-- ---------- Apply the platform policy to every match ----------
-- Admin-only. Rewrites each match's deadline rule to the platform policy and
-- records it on app_settings. The compute_deadline trigger fires per row, so
-- submission_deadline is recomputed from each match's kickoff_time.
create or replace function public.apply_deadline_policy(p_type text, p_value text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  if p_type not in ('minutes_before_kickoff', 'minutes_after_kickoff') then
    raise exception 'Invalid deadline type: %', p_type;
  end if;
  if p_value !~ '^\d+$' then
    raise exception 'Deadline value must be a whole number of minutes';
  end if;

  update public.app_settings
    set deadline_type = p_type, deadline_value = p_value
    where id = 1;

  update public.matches
    set deadline_type = p_type, deadline_value = p_value
    where id is not null;  -- touch every row (fires compute_deadline per row)
end;
$$;
