-- ============================================================
-- Granular admin maintenance actions
-- ============================================================
-- Separate, targeted resets (each admin-guarded, each returns the row count).
-- All keep admin@kickoff.local and the global league.

-- Clear every match result (un-scores predictions via the scoring trigger).
create or replace function public.clear_scores()
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  update public.matches set home_score = null, away_score = null
    where home_score is not null or away_score is not null;
  get diagnostics v = row_count;
  return v;
end; $$;

-- Delete every prediction (keeps fixtures, leagues, players).
create or replace function public.clear_predictions()
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  delete from public.predictions where id is not null;
  get diagnostics v = row_count;
  return v;
end; $$;

-- Delete user-created leagues (cascades their members; keeps the global league).
create or replace function public.delete_user_leagues()
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  delete from public.leagues where not is_global;
  get diagnostics v = row_count;
  return v;
end; $$;

-- Remove all non-admin players (deletes their auth account; cascades profile,
-- memberships and predictions). Keeps admins (admin@kickoff.local).
create or replace function public.delete_players()
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  delete from auth.users u
    where not exists (select 1 from public.profiles p where p.id = u.id and p.is_admin);
  get diagnostics v = row_count;
  return v;
end; $$;

grant execute on function public.clear_scores()        to authenticated;
grant execute on function public.clear_predictions()   to authenticated;
grant execute on function public.delete_user_leagues() to authenticated;
grant execute on function public.delete_players()      to authenticated;
