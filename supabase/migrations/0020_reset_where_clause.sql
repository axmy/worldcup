-- ============================================================
-- Harden reset_app_data: explicit WHERE clauses
-- ============================================================
-- Some Postgres configs (sql_safe_updates) reject DELETE without a WHERE clause
-- with "DELETE requires a WHERE clause". Add harmless column conditions so the
-- reset works on every database. Behaviour is unchanged: wipes predictions,
-- user-created leagues, and fixtures — KEEPS all user accounts/profiles
-- (including admin@kickoff.local) and the global league with its members.

create or replace function public.reset_app_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;

  delete from public.predictions where id is not null;          -- all predictions
  delete from public.leagues     where not is_global;           -- user leagues (cascades members)
  delete from public.matches     where id is not null;          -- all fixtures
end;
$$;
