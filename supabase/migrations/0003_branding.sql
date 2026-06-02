-- ============================================================
-- White-label branding — per-deployment name & login copy
-- ============================================================
-- Lives on the single app_settings row and is editable in Admin → Settings.
-- app_settings already has a public ("settings readable" using true) SELECT
-- policy, so the logged-out login page can read these too.
alter table public.app_settings
  add column if not exists brand_name     text not null default 'Kickoff',
  add column if not exists brand_tagline  text not null default 'WC26 · Predictor',
  add column if not exists login_headline text not null default 'Call the scoreline. Own the board.',
  add column if not exists login_subtitle text not null default
    'Predict every match before the deadline. Exact scores win big, most-correct lifts the trophy.';
