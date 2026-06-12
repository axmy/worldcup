# Deployment guide

How to take this app live on **Vercel** + **hosted Supabase**. Most go-live
issues are *dashboard configuration*, not code — work through each section.

Stack: Next.js 16 (App Router) · Supabase (Postgres + Auth) · Vercel.

- Hosted Supabase project ref: `xfwbnyqimrytrjutfbuu` → `https://xfwbnyqimrytrjutfbuu.supabase.co`
- Production domain: `https://scorepredict.xyz`

> Pick **one** canonical domain (bare vs `www`) and use it consistently in
> every URL below — a mismatch is a common cause of auth redirect failures.

---

## 1. Database — apply migrations

The schema lives in `supabase/migrations/` (`0001`…`0012`), applied in order.

```bash
supabase link --project-ref xfwbnyqimrytrjutfbuu
supabase db push
```

This applies all migrations (and seeds the 72 WC2026 fixtures + the predefined
admin). Re-run `supabase db push` after adding any new migration.

> **Auto-apply on deploy.** `.github/workflows/db-migrations.yml` runs
> `supabase db push` automatically whenever a push to `main` changes
> `supabase/migrations/**` — so migrations go live alongside the Vercel build,
> no manual step. One-time: add repo secrets `SUPABASE_ACCESS_TOKEN`,
> `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` (Settings → Secrets and
> variables → Actions). You can also trigger it manually from the Actions tab.
> Vercel itself only builds the frontend — it does **not** run migrations.

### Migration reference

| File | What it does |
|------|--------------|
| `0001`…`0009` | Base schema: settings, profiles, matches, predictions, scoring trigger, leaderboard, leagues, per-league predictions, submission windows. |
| `0006_wc2026_fixtures` | Seeds the 72 WC2026 group-stage fixtures (idempotent). |
| `0005_predefined_admin` | Seeds the predefined admin account (see warning below). |
| `0010_per_league_scoring` | Moves scoring config (`points_exact`, `points_outcome`, `submission_mode`) from the global `app_settings` row onto **each league** (backfilled, so existing leagues are unchanged). Rewrites the `score_predictions()` trigger, `league_standings()`, and the predictions update RLS to read per-league values. `app_settings` keeps these columns as **defaults for new leagues**. |
| `0011_league_self_service` | `SECURITY DEFINER` RPCs so **any signed-in user can create and run their own leagues**: `create_league` (creator becomes owner + first member), plus owner-guarded `update_league`, `regenerate_join_code`, `remove_member`, `delete_league`, and the `is_league_owner` helper. Direct table writes stay super-admin-only. |
| `0012_global_competition` | Adds an `is_global` league (unique — only one), seeds the **"Global Leaderboard"** competition, auto-enrolls every existing user, and adds a trigger to auto-enroll new signups. Adds the **public** `global_standings()` RPC (granted to `anon`) used by the logged-out `/leaderboard` page. Protects the global league: members can't leave it and it can't be deleted. |

> These three (`0010`–`0012`) are **forward-only** (no down migrations), matching
> the existing convention — apply them in order and don't hand-run them twice.
> Existing predictions are **not** re-scored on deploy: each league is backfilled
> to the current global scoring, so standings are identical until an organizer
> changes their league's rules (or a result is re-published).

> ⚠️ `0005_predefined_admin.sql` seeds **`admin@kickoff.local` / `ChangeMe123!`**.
> Change it in the SQL before pushing, or rely on the forced first-login
> password change (`proxy.ts` pins that account to `/change-password`).
> Make a real account admin with:
> `update public.profiles set is_admin = true where id = (select id from auth.users where email = 'you@example.com');`

> ⚠️ Do **NOT** run `supabase config push` — it would overwrite the production
> `[auth]` settings (Site URL, redirect URLs, Google creds, email templates)
> with the local/dev values in `config.toml`. Configure those in the dashboard
> (sections 2 below).

---

## 2. Supabase dashboard — Authentication

### 2a. URL configuration  (Authentication → URL Configuration)
Controls where users land after OAuth / password-reset links. **This is the
#1 cause of "redirects to localhost" bugs.**

- **Site URL:** `https://scorepredict.xyz`  (remove any `localhost`)
- **Redirect URLs** (allow-list) — add:
  - `https://scorepredict.xyz/**`
  - `https://www.scorepredict.xyz/**`  (if you serve `www` too)
  - `http://localhost:3000/**`  (keep for local dev)

  These must cover `/auth/callback` (Google), `/auth/reset` (password-reset
  landing) and `/reset-password`. If a redirect target isn't allow-listed,
  Supabase silently falls back to the Site URL — which is why a reset link can
  drop the user straight into the app instead of the set-new-password screen.

### 2b. Google sign-in  (Authentication → Providers → Google)
- Enable Google, paste the **production** OAuth Client ID + Secret **here**
  (not in Vercel env vars — the app uses Supabase Auth, not NextAuth).
- In **Google Cloud Console → Credentials → your OAuth client**, the authorized
  redirect URI must be **Supabase's** callback (not the app domain):
  - Authorized redirect URI: `https://xfwbnyqimrytrjutfbuu.supabase.co/auth/v1/callback`
  - Authorized JavaScript origin: `https://xfwbnyqimrytrjutfbuu.supabase.co`

### 2c. Email confirmation = 6-digit OTP  (Authentication → Emails → Templates → "Confirm signup")
Signup uses an **OTP code** (the app shows a "enter the 6-digit code" screen).
The hosted default template sends a *link* with no code — change it to surface
the token. The repo's `supabase/templates/confirmation.html` only applies to
**local** Supabase, so this must be set in the dashboard.

- **Subject:** `Your verification code`
- **Body:**
  ```html
  <h2>Confirm your email</h2>
  <p>Welcome to World Cup Predictions! Enter this code to verify your email address:</p>
  <p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0">{{ .Token }}</p>
  <p>The code expires shortly. If you didn't create an account, you can ignore this email.</p>
  ```
- The key is **`{{ .Token }}`** (the OTP).
- Keep **"Confirm email"** enabled (Authentication → Settings → "Confirm email").
- **Note:** if the Send Email hook (2d) is enabled, this dashboard template is
  bypassed — the app renders the OTP itself, so you don't need to edit it.

> Leave the **"Reset Password"** template as the **default link** version — the
> forgot-password flow is built around that link (it routes through
> `/auth/callback` into a recovery session). Don't convert it to an OTP.

### 2d. Email delivery — Mailngine via the "Send Email" hook
Supabase's built-in mailer is heavily rate-limited (test-only → "email rate
limit exceeded"). This app sends auth emails through **Mailngine** using
Supabase's **Send Email auth hook**, which POSTs each email to our endpoint
`app/api/auth/send-email/route.ts`. That endpoint verifies the signature,
renders the message (6-digit OTP for signup, reset link for recovery) and calls
Mailngine's REST API. **With the hook enabled, Supabase no longer sends emails
itself — its rate limit and the dashboard email templates (2c) no longer apply.**

Setup:
1. **Authentication → Hooks → "Send Email"** → Enable, set URI to
   `https://scorepredict.xyz/api/auth/send-email`, and **copy the signing secret**
   (looks like `v1,whsec_…`).
2. **Vercel env vars** (Settings → Environment Variables):
   - `SEND_EMAIL_HOOK_SECRET` = the hook secret from step 1
   - `MAILNGINE_API_KEY` = your Mailngine key (`mn_live_…`)
   - `MAIL_FROM` = a verified sender, e.g. `Kickoff <hello@scorepredict.xyz>`
3. Redeploy. Leave the built-in SMTP **off** — the hook overrides sending.

> Sender domain (`scorepredict.xyz`) must be verified in Mailngine.
> Alternative: if you later use an SMTP-capable provider, disable the hook and
> fill Authentication → Settings → SMTP instead.

### 2e. Email rate limits  (Authentication → Rate Limits)
GoTrue throttles auth emails **before** calling the send hook, so these are
Supabase settings, not Mailngine's. The "We're sending too many emails / wait a
minute" error comes from here — usually during rapid testing.
- **Minimum interval between emails** (`max_frequency`): hosted default ≈ 60s →
  this is the "wait a minute". Lower it for testing; keep it modest in prod.
- **Rate limit for sending emails** (per hour): raise it (e.g. 100+). Some plans
  cap this unless custom SMTP is configured.
- Local dev relaxes these in `config.toml` (`email_sent = 60`, `max_frequency =
  "1s"`) — that does **not** carry over to hosted; set them in the dashboard.

---

## 3. Vercel

### 3a. Environment variables  (Project → Settings → Environment Variables)
The app reads only these at runtime:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xfwbnyqimrytrjutfbuu.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the project's anon/public key |
| `NEXT_PUBLIC_SITE_URL` *(recommended)* | `https://scorepredict.xyz` — forces the canonical origin for OAuth/reset redirect URLs, the **social share links**, and the absolute **Open Graph / Twitter preview image** URL. Without it, share links and the OG image fall back to the request host (or localhost), so previews won't unfurl correctly. |
| `API_FOOTBALL_KEY` *(for auto-results)* | api-sports.io key. |
| `API_FOOTBALL_LEAGUE` / `API_FOOTBALL_SEASON` | Competition id + season (e.g. World Cup, `2026`). **Verify the league id** in the API-Football dashboard. |
| `SUPABASE_SERVICE_ROLE_KEY` *(for auto-results)* | Service-role key from the Supabase dashboard. **Bypasses RLS — server-only**, never expose to the client. Used by the results-sync cron to write scores. |
| `CRON_SECRET` | Long random string. Vercel sends it as `Authorization: Bearer <CRON_SECRET>` to the cron route; the route rejects anything else. |

> The `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` vars in `.env.local` are **local-only**
> (`supabase start`). Production Google creds go in the Supabase dashboard (2b),
> not Vercel.

### 3b-bis. Automated results (API-Football → auto-score)
Once results are written to a match, the DB scores all predictions automatically.
`vercel.json` schedules `/api/cron/sync-results` (`*/5 * * * *`) to fetch finished
matches from API-Football and write their scores.

- **Map fixtures first:** in Admin → Fixtures, click **Import** to pull the schedule
  (teams, kickoff times, provider ids). Results sync only touches fixtures that have a
  provider id.
- **Vercel plan:** Hobby runs crons **once/day** only. For live-day polling you need an
  external scheduler hitting the route directly. Options, fastest-to-reliable:
  trigger Admin → Results → **"Sync results now"** manually; **Vercel Pro** (sub-daily
  crons); GitHub Actions; or **cron-job.org** (recommended — free, reliable 1-min cadence).
- **Why not GitHub Actions alone:** the repo ships `.github/workflows/sync-results.yml`
  with `cron: "*/5 * * * *"`, but GitHub **heavily throttles and silently drops**
  high-frequency scheduled workflows under load — observed real gaps of 2–4.5h between
  runs, not 5 min. There is no YAML fix; GitHub does not honour `*/5` reliably. Keep it as
  a *backup* trigger if you like (the route is idempotent), but don't rely on it for
  live-day cadence.
- **Recommended — cron-job.org (free, ~5-min reliable):**
  1. Sign up at <https://cron-job.org> → **Create cronjob**.
  2. **URL:** `https://<your-prod-domain>/api/cron/sync-results` (same value as the
     `SYNC_URL` GitHub secret — the prod domain, following the apex→www redirect).
  3. **Schedule:** every 5 minutes (or every minute during live match windows).
  4. **Request method:** GET. **Headers:** add `Authorization: Bearer <CRON_SECRET>`
     (the exact `CRON_SECRET` value set in Vercel env vars).
  5. Enable **"Follow redirects"** (apex domain 308-redirects to www, like the workflow's
     `curl -L`). Save → the job's execution history shows real cadence + the route's JSON
     response for diagnostics.
- **API quota:** the route makes **no** provider call when no match is in play, so usage
  stays near zero outside match windows (fits the free tier) — running it every minute is
  safe.

### 3b. Region  (`vercel.json`)
`vercel.json` pins serverless functions to a region — put them **next to the
database** to cut query latency.

- Current: `sin1` (Singapore).
- The DB is in **Tokyo**. If it stays there, `hnd1` (Tokyo) is faster
  (intra-region ~1–5ms vs Singapore↔Tokyo ~70–90ms per query). Match the
  region to wherever the Supabase project actually lives.

### 3c. Deploy
Push to `main` (or connect the repo) and Vercel builds automatically. Region +
env changes take effect on the next deploy.

---

## 4. Post-deploy smoke test
- [ ] `/login` loads, themed correctly.
- [ ] **Email signup:** register → the email contains a **6-digit code** → entering it verifies and signs in.
- [ ] **Google sign-in:** completes and lands on `/matches` (not localhost).
- [ ] **Forgot password:** `/forgot-password` → email link → `/reset-password` → new password → signed in.
- [ ] **Logout:** lands on `/login` and stays signed out (no loop).
- [ ] Admin can create/edit fixtures with an open/close window; players can only predict inside it.
- [ ] **Landing page:** logged-out `/` shows the marketing page; logged-in `/` redirects to `/matches`.
- [ ] **Leagues:** a normal user can create a league (becomes owner), set scoring, invite by code; another user can join by code; per-league scoring works.
- [ ] **Global leaderboard:** `/leaderboard` loads logged-out and shows the global competition.
- [ ] **Social preview:** paste the site URL into the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) / X Card Validator — the OG image and title/description unfurl (requires `NEXT_PUBLIC_SITE_URL`).

## 5. Security checklist
- [ ] Rotate the Google OAuth **client secret** (it was shared in plaintext during development) and update it in the Supabase dashboard.
- [ ] Change the predefined admin password (or confirm the forced-change flow ran).
- [ ] Confirm `.env.local` is gitignored and not committed.
