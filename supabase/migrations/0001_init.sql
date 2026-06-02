-- ============================================================
-- World Cup Score Predictions — initial schema
-- ============================================================

-- ---------- Settings (single row) ----------
-- Tournament timezone drives the "before 10pm of the day" rule.
-- Change tournament_timezone / scoring weights here in ONE place.
create table public.app_settings (
  id                 int primary key default 1,
  tournament_timezone text not null default 'Indian/Maldives',
  points_exact       int  not null default 3,   -- exact score correct
  points_outcome     int  not null default 1,   -- right winner/draw, wrong score
  constraint single_row check (id = 1)
);
insert into public.app_settings (id) values (1);

-- ---------- Profiles ----------
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------- Matches ----------
create table public.matches (
  id            uuid primary key default gen_random_uuid(),
  home_team     text not null,
  away_team     text not null,
  kickoff_time  timestamptz not null,
  -- Configurable deadline rule:
  deadline_type  text not null check (deadline_type in ('minutes_before_kickoff','fixed_time_of_day')),
  deadline_value text not null,              -- '75' (minutes)  OR  '22:00' (time of day)
  -- Computed cutoff = the single source of truth for the lock:
  submission_deadline timestamptz not null,
  -- Actual result (admin fills after the match):
  home_score    int,
  away_score    int,
  created_at    timestamptz not null default now()
);

-- ---------- Predictions ----------
create table public.predictions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  match_id   uuid not null references public.matches(id) on delete cascade,
  home_score int not null check (home_score >= 0),
  away_score int not null check (away_score >= 0),
  points     int,                            -- computed when result is entered
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)                 -- one prediction per user per match
);

-- ============================================================
-- Helper: admin check (SECURITY DEFINER avoids RLS recursion)
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ============================================================
-- Compute submission_deadline from the rule (runs on insert/update)
-- ============================================================
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
  end if;

  return new;
end;
$$;

create trigger trg_compute_deadline
  before insert or update of kickoff_time, deadline_type, deadline_value
  on public.matches
  for each row execute function public.compute_deadline();

-- ============================================================
-- Auto-create a profile when a user signs up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Scoring: recompute points for a match when its result is set
-- ============================================================
create or replace function public.score_predictions()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  s_exact int;
  s_outcome int;
begin
  if new.home_score is not null and new.away_score is not null then
    select points_exact, points_outcome into s_exact, s_outcome from public.app_settings where id = 1;

    update public.predictions p set points = case
      when p.home_score = new.home_score and p.away_score = new.away_score then s_exact
      when sign(p.home_score - p.away_score) = sign(new.home_score - new.away_score) then s_outcome
      else 0
    end
    where p.match_id = new.id;
  else
    update public.predictions set points = null where match_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_score_predictions
  after update of home_score, away_score on public.matches
  for each row execute function public.score_predictions();

-- ============================================================
-- Leaderboard view (aggregates only — safe to expose)
-- ============================================================
create view public.leaderboard
with (security_invoker = false) as
  select
    p.id           as user_id,
    p.display_name,
    coalesce(sum(pr.points), 0)                                  as total_points,
    count(pr.points) filter (where pr.points is not null)        as scored_matches,
    count(*) filter (
      where pr.points = (select points_exact from public.app_settings where id = 1)
    )                                                            as exact_hits
  from public.profiles p
  left join public.predictions pr on pr.user_id = p.id
  group by p.id, p.display_name;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles    enable row level security;
alter table public.matches     enable row level security;
alter table public.predictions enable row level security;
alter table public.app_settings enable row level security;

-- Profiles: everyone can read display names (leaderboard); users edit only their own.
create policy "profiles readable" on public.profiles
  for select using (true);
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and is_admin = (select is_admin from public.profiles where id = auth.uid()));

-- Matches: anyone signed in can read; only admins can write.
create policy "matches readable" on public.matches
  for select using (true);
create policy "admins manage matches" on public.matches
  for all using (public.is_admin()) with check (public.is_admin());

-- Predictions: users see only their own.
create policy "read own predictions" on public.predictions
  for select using (auth.uid() = user_id);

-- *** THE DEADLINE LOCK ***  insert/update only before the cutoff.
create policy "insert before deadline" on public.predictions
  for insert with check (
    auth.uid() = user_id
    and now() < (select submission_deadline from public.matches where id = match_id)
  );
create policy "update before deadline" on public.predictions
  for update using (
    auth.uid() = user_id
    and now() < (select submission_deadline from public.matches where id = match_id)
  )
  with check (auth.uid() = user_id);

-- Settings: readable by all signed-in users; writable by admins only.
create policy "settings readable" on public.app_settings
  for select using (true);
create policy "admins manage settings" on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Allow read of the leaderboard view to clients.
grant select on public.leaderboard to anon, authenticated;
