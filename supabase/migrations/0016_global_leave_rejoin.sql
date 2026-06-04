-- ============================================================
-- Global league: opt-out / opt-in
-- ============================================================
-- Everyone is still auto-enrolled in the global league, but users may now leave
-- it and re-join. (0012 had blocked leaving the global league.)

-- Allow a member to leave ANY league they're in, including the global one.
drop policy "leave or admin remove" on public.league_members;
create policy "leave or admin remove" on public.league_members
  for delete using (user_id = auth.uid() or public.is_admin());

-- Re-join the global league (there's no join code for it). SECURITY DEFINER so
-- it can insert despite the admin-only insert policy on league_members.
create or replace function public.join_global()
returns void language plpgsql security definer
set search_path = public as $$
declare v_global uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  select id into v_global from public.leagues where is_global;
  if v_global is not null then
    insert into public.league_members (league_id, user_id)
    values (v_global, auth.uid())
    on conflict do nothing;
  end if;
end;
$$;

grant execute on function public.join_global() to authenticated;
