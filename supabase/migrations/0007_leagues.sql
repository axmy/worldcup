-- ============================================================
-- Leagues (fantasy-style mini-leagues over the shared fixtures)
-- ============================================================
-- All leagues predict the SAME global matches; a league is just a named,
-- code-joined group with its own standings. Predictions remain global
-- (one per user per match) and count toward every league the user joins.

-- ---------- Tables ----------
create or replace function public.gen_join_code()
returns text language sql volatile as $$
  -- 6 chars from an unambiguous alphabet (no O/0/I/1/L).
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random() * 30) + 1)::int, 1),
    ''
  )
  from generate_series(1, 6);
$$;

create table public.leagues (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  join_code  text not null unique default public.gen_join_code(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index on public.league_members (user_id);

-- ---------- Membership helper (SECURITY DEFINER avoids RLS recursion) ----------
create or replace function public.is_league_member(p_league_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid()
  );
$$;

-- ---------- Join by code (self-service; bypasses RLS via definer) ----------
create or replace function public.join_league(p_code text)
returns public.leagues language plpgsql security definer
set search_path = public as $$
declare
  l public.leagues;
begin
  select * into l from public.leagues where upper(join_code) = upper(trim(p_code));
  if l.id is null then
    raise exception 'No league found for that code.' using errcode = 'no_data_found';
  end if;
  insert into public.league_members (league_id, user_id)
  values (l.id, auth.uid())
  on conflict do nothing;
  return l;
end;
$$;

-- ---------- Per-league standings (membership-checked) ----------
-- SECURITY DEFINER so it can aggregate every member's points despite the
-- per-user predictions RLS — but only returns rows to members or admins.
create or replace function public.league_standings(p_league_id uuid)
returns table (
  user_id       uuid,
  display_name  text,
  total_points  bigint,
  scored_matches bigint,
  exact_hits    bigint
) language sql security definer stable
set search_path = public as $$
  select
    p.id,
    p.display_name,
    coalesce(sum(pr.points), 0)                            as total_points,
    count(pr.points) filter (where pr.points is not null)  as scored_matches,
    count(*) filter (
      where pr.points = (select points_exact from public.app_settings where id = 1)
    )                                                      as exact_hits
  from public.league_members lm
  join public.profiles p on p.id = lm.user_id
  left join public.predictions pr on pr.user_id = p.id
  where lm.league_id = p_league_id
    and (public.is_league_member(p_league_id) or public.is_admin())
  group by p.id, p.display_name;
$$;

-- ---------- Row Level Security ----------
alter table public.leagues        enable row level security;
alter table public.league_members enable row level security;

-- Leagues: visible to members (and admins); only admins write.
create policy "leagues visible to members" on public.leagues
  for select using (public.is_admin() or public.is_league_member(id));
create policy "admins manage leagues" on public.leagues
  for all using (public.is_admin()) with check (public.is_admin());

-- Members: you can see members of leagues you're in (needed for standings);
-- you can leave (delete your own row); admins manage everyone. Self-join is
-- only via join_league() (definer), so direct inserts are admin-only.
create policy "members visible within league" on public.league_members
  for select using (
    user_id = auth.uid() or public.is_admin() or public.is_league_member(league_id)
  );
create policy "admins add members" on public.league_members
  for insert with check (public.is_admin());
create policy "leave or admin remove" on public.league_members
  for delete using (user_id = auth.uid() or public.is_admin());

grant execute on function public.join_league(text)      to authenticated;
grant execute on function public.league_standings(uuid) to authenticated;
