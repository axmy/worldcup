-- ============================================================
-- Admin maintenance: reset app data to a blank slate
-- ============================================================
-- Wipes predictions, results, user-created leagues, and fixtures — but KEEPS all
-- user accounts/profiles and the global league (with its members). SECURITY
-- DEFINER + is_admin() guard because predictions/matches have no admin-delete
-- RLS policy. The admin re-seeds fixtures via Import afterward.

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

  -- All predictions (global + every league).
  delete from public.predictions;
  -- User-created leagues (cascades their members; global league is preserved).
  delete from public.leagues where not is_global;
  -- All fixtures.
  delete from public.matches;
end;
$$;

grant execute on function public.reset_app_data() to authenticated;
