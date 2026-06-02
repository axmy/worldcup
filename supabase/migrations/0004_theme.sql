-- ============================================================
-- White-label theming — per-deployment mode & accent color
-- ============================================================
-- Applied at the document root by app/layout.tsx (data-theme + --accent).
-- Editable in Admin → Settings → Branding. Publicly readable via the existing
-- app_settings SELECT policy, so the logged-out login page is themed too.
alter table public.app_settings
  add column if not exists theme  text not null default 'dark'
    check (theme in ('dark', 'light')),
  add column if not exists accent text not null default 'oklch(0.87 0.2 128)';
