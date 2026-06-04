-- ============================================================
-- Self-service league creation & owner management
-- ============================================================
-- Any authenticated user can create a league (becoming its owner + first
-- member) and manage the leagues they own — all via SECURITY DEFINER RPCs.
-- Direct table writes stay locked to super-admin RLS ("admins manage leagues");
-- these definer functions are the only self-service write path, mirroring
-- join_league(). Each function's first statement is an explicit owner/auth guard.

-- ---------- Create (owner = creator, auto-joined as first member) ----------
create or replace function public.create_league(
  p_name            text,
  p_points_exact    int  default null,
  p_points_outcome  int  default null,
  p_submission_mode text default null
)
returns public.leagues
language plpgsql security definer
set search_path = public as $$
declare
  l public.leagues;
  d public.app_settings;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'League name is required.' using errcode = '22023';
  end if;
  if p_submission_mode is not null and p_submission_mode not in ('single', 'multiple') then
    raise exception 'Invalid submission mode.' using errcode = '22023';
  end if;

  select * into d from public.app_settings where id = 1;  -- platform defaults

  -- join_code has a DB default + unique constraint; retry on the rare collision.
  for i in 1..5 loop
    begin
      insert into public.leagues (name, created_by, points_exact, points_outcome, submission_mode)
      values (
        trim(p_name),
        auth.uid(),
        greatest(0, coalesce(p_points_exact,   d.points_exact)),
        greatest(0, coalesce(p_points_outcome, d.points_outcome)),
        coalesce(p_submission_mode, d.submission_mode)
      )
      returning * into l;
      exit;
    exception when unique_violation then
      if i = 5 then raise; end if;  -- exhausted join_code retries
    end;
  end loop;

  insert into public.league_members (league_id, user_id)
  values (l.id, auth.uid())
  on conflict do nothing;

  return l;
end;
$$;

-- ---------- Owner guard (creator or super-admin) ----------
create or replace function public.is_league_owner(p_league_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.leagues
    where id = p_league_id and created_by = auth.uid()
  ) or public.is_admin();
$$;

-- ---------- Update settings (name + scoring + mode) ----------
create or replace function public.update_league(
  p_league_id       uuid,
  p_name            text,
  p_points_exact    int,
  p_points_outcome  int,
  p_submission_mode text
)
returns public.leagues
language plpgsql security definer
set search_path = public as $$
declare l public.leagues;
begin
  if not public.is_league_owner(p_league_id) then
    raise exception 'Only the league owner can do that.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'League name is required.' using errcode = '22023';
  end if;
  if p_submission_mode not in ('single', 'multiple') then
    raise exception 'Invalid submission mode.' using errcode = '22023';
  end if;
  update public.leagues set
    name            = trim(p_name),
    points_exact    = greatest(0, p_points_exact),
    points_outcome  = greatest(0, p_points_outcome),
    submission_mode = p_submission_mode
  where id = p_league_id
  returning * into l;
  return l;
end;
$$;

-- ---------- Regenerate join code ----------
create or replace function public.regenerate_join_code(p_league_id uuid)
returns text language plpgsql security definer
set search_path = public as $$
declare v_code text;
begin
  if not public.is_league_owner(p_league_id) then
    raise exception 'Only the league owner can do that.' using errcode = '42501';
  end if;
  for i in 1..5 loop
    begin
      update public.leagues set join_code = public.gen_join_code()
      where id = p_league_id returning join_code into v_code;
      exit;
    exception when unique_violation then
      if i = 5 then raise; end if;
    end;
  end loop;
  return v_code;
end;
$$;

-- ---------- Remove a member (the owner cannot be removed) ----------
create or replace function public.remove_member(p_league_id uuid, p_user_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not public.is_league_owner(p_league_id) then
    raise exception 'Only the league owner can do that.' using errcode = '42501';
  end if;
  if p_user_id = (select created_by from public.leagues where id = p_league_id) then
    raise exception 'The owner cannot be removed.' using errcode = '42501';
  end if;
  delete from public.league_members
  where league_id = p_league_id and user_id = p_user_id;
end;
$$;

-- ---------- Delete league (owner or admin; cascades members + predictions) ----------
create or replace function public.delete_league(p_league_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not public.is_league_owner(p_league_id) then
    raise exception 'Only the league owner can do that.' using errcode = '42501';
  end if;
  delete from public.leagues where id = p_league_id;
end;
$$;

grant execute on function public.create_league(text, int, int, text)       to authenticated;
grant execute on function public.is_league_owner(uuid)                     to authenticated;
grant execute on function public.update_league(uuid, text, int, int, text) to authenticated;
grant execute on function public.regenerate_join_code(uuid)                to authenticated;
grant execute on function public.remove_member(uuid, uuid)                 to authenticated;
grant execute on function public.delete_league(uuid)                       to authenticated;
