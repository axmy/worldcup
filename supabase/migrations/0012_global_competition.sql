-- ============================================================
-- Global competition + public leaderboard
-- ============================================================
-- One platform-wide "Global Leaderboard" competition everyone is automatically
-- entered into, with fixed default scoring. It is just a special league
-- (is_global = true), so it reuses all the per-league prediction/scoring
-- machinery. Its standings are PUBLIC (visible to logged-out visitors) via
-- global_standings().

-- ---------- Flag + at-most-one-global guard ----------
alter table public.leagues
  add column if not exists is_global boolean not null default false;

create unique index if not exists leagues_one_global_idx
  on public.leagues (is_global) where is_global;

-- ---------- Seed the global league (idempotent) ----------
do $$
declare
  v_admin uuid;
  d       public.app_settings;
begin
  if not exists (select 1 from public.leagues where is_global) then
    select id into v_admin from public.profiles where is_admin order by created_at limit 1;
    select * into d from public.app_settings where id = 1;

    insert into public.leagues (name, created_by, is_global, points_exact, points_outcome, submission_mode)
    values ('Global Leaderboard', v_admin, true, d.points_exact, d.points_outcome, d.submission_mode);
  end if;
end $$;

-- ---------- Auto-enroll every existing profile ----------
insert into public.league_members (league_id, user_id)
select g.id, p.id
from public.leagues g
cross join public.profiles p
where g.is_global
on conflict do nothing;

-- ---------- Auto-enroll new profiles on signup ----------
create or replace function public.enroll_in_global()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare v_global uuid;
begin
  select id into v_global from public.leagues where is_global;
  if v_global is not null then
    insert into public.league_members (league_id, user_id)
    values (v_global, new.id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enroll_in_global on public.profiles;
create trigger trg_enroll_in_global
  after insert on public.profiles
  for each row execute function public.enroll_in_global();

-- ---------- Public standings for the global league (no membership check) ----------
create or replace function public.global_standings()
returns table (
  user_id        uuid,
  display_name   text,
  total_points   bigint,
  scored_matches bigint,
  exact_hits     bigint
) language sql security definer stable
set search_path = public as $$
  select
    p.id,
    p.display_name,
    coalesce(sum(pr.points), 0)                            as total_points,
    count(pr.points) filter (where pr.points is not null)  as scored_matches,
    count(*) filter (where pr.points = g.points_exact)     as exact_hits
  from public.leagues g
  join public.league_members lm on lm.league_id = g.id
  join public.profiles p on p.id = lm.user_id
  left join public.predictions pr
    on pr.user_id = p.id and pr.league_id = g.id
  where g.is_global
  group by p.id, p.display_name, g.points_exact;
$$;

grant execute on function public.global_standings() to anon, authenticated;

-- ---------- Protect the global league ----------
-- Members can't leave the global league (re-runs of the enroll trigger only fire
-- on profile creation); admins can still manage everyone.
drop policy "leave or admin remove" on public.league_members;
create policy "leave or admin remove" on public.league_members
  for delete using (
    (user_id = auth.uid()
      and not coalesce((select is_global from public.leagues where id = league_id), false))
    or public.is_admin()
  );

-- The global league can never be deleted (even by an admin) through the RPC.
create or replace function public.delete_league(p_league_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not public.is_league_owner(p_league_id) then
    raise exception 'Only the league owner can do that.' using errcode = '42501';
  end if;
  if (select is_global from public.leagues where id = p_league_id) then
    raise exception 'The global league cannot be deleted.' using errcode = '42501';
  end if;
  delete from public.leagues where id = p_league_id;
end;
$$;
