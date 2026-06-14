-- ============================================================
-- League prizes — owners advertise what winners play for
-- ============================================================
-- A league owner can set a prize per finishing place (1st, 2nd, 3rd, …). We
-- store an ORDERED jsonb array of strings where index i is the prize for place
-- i+1, so a league can have as many (or few) prizes as it likes. Display-only —
-- prizes don't affect scoring or standings.

alter table public.leagues
  add column if not exists prizes jsonb not null default '[]'::jsonb;

-- Clean an owner-supplied prizes payload into a tidy text array: keep only
-- string elements, trim them, cap each to 80 chars, drop blanks, and keep at
-- most the first 10. Anything that isn't a json array collapses to '[]'.
create or replace function public.clean_prizes(p_prizes jsonb)
returns jsonb language sql immutable as $$
  select coalesce(
    (
      select jsonb_agg(v order by ord)
      from (
        select left(btrim(elem #>> '{}'), 80) as v, ord
        from jsonb_array_elements(
               case when jsonb_typeof(p_prizes) = 'array' then p_prizes else '[]'::jsonb end
             ) with ordinality as t(elem, ord)
        where jsonb_typeof(elem) = 'string'
          and length(btrim(elem #>> '{}')) > 0
        order by ord
        limit 10
      ) cleaned
    ),
    '[]'::jsonb
  );
$$;

-- Extend update_league with prizes. Drop the old 5-arg signature first so we
-- don't leave a stale overload behind.
drop function if exists public.update_league(uuid, text, int, int, text);

create or replace function public.update_league(
  p_league_id       uuid,
  p_name            text,
  p_points_exact    int,
  p_points_outcome  int,
  p_submission_mode text,
  p_prizes          jsonb default '[]'::jsonb
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
    submission_mode = p_submission_mode,
    prizes          = public.clean_prizes(p_prizes)
  where id = p_league_id
  returning * into l;
  return l;
end;
$$;

grant execute on function public.update_league(uuid, text, int, int, text, jsonb) to authenticated;
