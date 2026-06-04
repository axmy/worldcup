-- ============================================================
-- Self-healing membership: guarantee profile + global enrollment
-- ============================================================
-- New signups rely on the on_auth_user_created / trg_enroll_in_global triggers
-- to create a profile and enroll the user in the global league. If those
-- triggers were added after a user signed up (or failed once), the user is left
-- with no profile and no league — so the matches page has no league context and
-- shows nothing. ensure_self() repairs that idempotently, and the app calls it
-- right after authentication (and as a layout safety net).

create or replace function public.ensure_self()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name   text;
  v_global uuid;
begin
  if auth.uid() is null then
    return;
  end if;

  -- Profile — display name from the user's metadata, else the email prefix.
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    select coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1), 'Player')
      into v_name
    from auth.users u
    where u.id = auth.uid();
    insert into public.profiles (id, display_name)
    values (auth.uid(), coalesce(nullif(trim(v_name), ''), 'Player'))
    on conflict (id) do nothing;
  end if;

  -- Global-league membership.
  select id into v_global from public.leagues where is_global;
  if v_global is not null then
    insert into public.league_members (league_id, user_id)
    values (v_global, auth.uid())
    on conflict do nothing;
  end if;
end;
$$;

grant execute on function public.ensure_self() to authenticated;

-- ---------- One-time backfill ----------
-- Profiles for any auth users missing one (fires trg_enroll_in_global).
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1), 'Player')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Make sure every profile is in the global league (covers historic gaps).
insert into public.league_members (league_id, user_id)
select g.id, p.id
from public.leagues g
cross join public.profiles p
where g.is_global
on conflict do nothing;
