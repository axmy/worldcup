-- ============================================================
-- Provider sync: map fixtures to an external data source
-- ============================================================
-- Results can be auto-fetched from a football data API (API-Football). Each
-- match carries the provider's fixture id so results map exactly — no team-name
-- matching. Writing home_score/away_score still fires the existing scoring
-- trigger, so nothing downstream changes.

alter table public.matches
  add column if not exists external_ref text,
  add column if not exists provider     text not null default 'api-football',
  add column if not exists synced_at     timestamptz;

-- One fixture per (provider, external_ref) — guards against duplicate imports.
create unique index if not exists matches_provider_ref_idx
  on public.matches (provider, external_ref)
  where external_ref is not null;
