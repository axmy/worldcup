# World Cup Score Predictions — Technical Documentation

A web app where registered users predict the score of each match before a
**configurable deadline**. The organizer enters real results; points are awarded
automatically and ranked on a live leaderboard. Fully responsive (mobile-first),
built on the dark **"Kickoff"** design system (Saira display type, electric-lime accent).

- **Live (local):** http://localhost:3000
- **Supabase Studio (DB UI):** http://localhost:54323
- **Project root:** `~/Projects/worldcup-predictions`

---

## 1. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Server Components + Server Actions; Turbopack by default |
| Language | **TypeScript** | |
| Styling | **Tailwind CSS v4** + design tokens | Dark "Kickoff" theme (oklch tokens + inline styles); mobile-first |
| Fonts | **Saira** / **Saira Condensed** | Body + display, via `next/font` |
| Database | **Supabase / PostgreSQL** | Local stack runs in Docker |
| Auth | **Supabase Auth** | Email + password (OTP-verified), Google OAuth |
| Auth bridge | **@supabase/ssr** | Cookie-based sessions across server/client |
| Hosting (prod) | Vercel + Supabase Cloud | Both have free tiers |

> **Runtime requirement:** Node **20.9+** (this project is verified on Node 22).
> See [Troubleshooting](#8-troubleshooting) — the machine's default nvm Node is v10,
> which will **not** run Next 16.

---

## 2. How it works (concepts)

1. **Register / log in** → Supabase Auth creates a user; a trigger auto-creates a
   matching `profiles` row. Three entry paths (see [Authentication](#auth)):
   - **Email + password**, then **verify a 6-digit OTP** emailed on signup.
   - **Continue with Google** (OAuth).
2. **Organizer (admin)** adds matches and, per match, picks a **deadline rule**.
3. Each user submits a **prediction** (home/away score) per match. Whether they can
   edit it until the deadline depends on the **submission rule** (see below).
4. When the organizer enters the **actual result**, a DB trigger scores every
   prediction for that match.
5. The **leaderboard** aggregates points across all matches.

### Authentication
<a id="auth"></a>

| Method | Flow |
|---|---|
| Email + password | `signUp` → **email confirmation is on**, so no session is created until the user enters the 6-digit OTP emailed to them (`verifyOtp({ type: "email" })`). The register screen has a built-in "Check your inbox" step with resend. |
| Google OAuth | `signInWithOAuth({ provider: "google" })` → Google → `/auth/callback` route exchanges the code for a session (PKCE). |

The OTP code is surfaced in the email via the `{{ .Token }}` template at
`supabase/templates/confirmation.html`. The `handle_new_user()` trigger falls back to
the email's local-part for `display_name` when one isn't supplied (e.g. Google users).

> **Google credentials:** the provider is enabled in `config.toml` but reads
> `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` from the environment.
> Locally these are **placeholders** (so the stack boots) — real sign-in needs real
> credentials from the Google Cloud Console. See [`.env.local.example`](#5-local-development).

### Submission rule (single vs. multiple)

The organizer chooses one tournament-wide rule in **Admin → Settings**
(`app_settings.submission_mode`):

| Mode | Behaviour |
|---|---|
| `multiple` (default) | Users may **edit** their prediction freely until the deadline. |
| `single` | The **first** prediction locks — no edits afterwards. |

Like the deadline, this is enforced in the **database**, not the browser: the
`predictions` UPDATE RLS policy additionally requires `submission_mode = 'multiple'`,
so in single mode a re-submit (an `ON CONFLICT DO UPDATE`) is rejected by Postgres.
The predict sheet also disables editing once a pick exists in single mode.

### The deadline lock (the core feature)

The deadline is **never** evaluated in the browser. Instead:

- Each match stores a computed `submission_deadline` (absolute timestamp).
- A **Row-Level Security (RLS)** policy on `predictions` rejects any insert/update
  where `now() >= submission_deadline`, using the **database clock**.
- The UI shows a live countdown and disables inputs at zero — but that's only
  cosmetic. Even a crafted API request after the deadline is rejected by Postgres.

This was verified end-to-end: submitting to an open match returns `201`; submitting to
a closed match returns `403` (`new row violates row-level security policy`).

### Configurable deadline rules

The organizer chooses one of two rule types per match:

| Rule type | `deadline_value` example | Meaning |
|---|---|---|
| `minutes_before_kickoff` | `75` | Lock 75 minutes before kickoff |
| `fixed_time_of_day` | `22:00` | Lock at 10pm on the match's date |

A `BEFORE INSERT/UPDATE` trigger (`compute_deadline()`) converts the rule into the
absolute `submission_deadline`. "Fixed time of day" is interpreted in the
**tournament timezone** (Admin → Settings, default `Indian/Maldives`).

> Example verified: a `22:00` rule with the Maldives timezone (UTC+5) produced a
> deadline of `17:00 UTC` — correct.

### Scoring

When a result is entered, `score_predictions()` recomputes points for that match:

| Outcome | Default points | Setting |
|---|---|---|
| Exact score correct | **3** | `app_settings.points_exact` |
| Correct result (W/D/L), wrong score | **1** | `app_settings.points_outcome` |
| Wrong result | 0 | — |

> Changing the point weights only affects matches scored **after** the change.
> Re-save a match's result to recompute it.

---

## 3. Project structure

```
worldcup-predictions/
├─ app/
│  ├─ layout.tsx            # Root layout: fonts, dark theme, fetches chrome data → <Chrome>
│  ├─ page.tsx              # Redirects to /matches or /login
│  ├─ actions.ts            # All Server Actions (auth, OTP, Google, predictions, admin)
│  ├─ login/page.tsx        # <AuthCard mode="login">
│  ├─ register/page.tsx     # <AuthCard mode="register"> (email+password → OTP step)
│  ├─ auth/callback/route.ts # OAuth (Google) code → session exchange
│  ├─ matches/page.tsx      # → <MatchesScreen> (filters, day-grouped cards, predict sheet)
│  ├─ picks/page.tsx        # → <MyPicksScreen> (your predictions + stats)
│  ├─ leaderboard/page.tsx  # → <LeaderboardScreen> (podium + ranked list)
│  └─ admin/page.tsx        # → <AdminScreen> (fixtures, results, players, settings)
├─ components/
│  ├─ ui.tsx                # Kickoff UI kit: Icon, Crest, Avatar, Countdown, Stepper, …
│  ├─ Chrome.tsx            # App shell: header + desktop/mobile nav (full-bleed on auth pages)
│  ├─ AuthCard.tsx          # Login / register / OTP-verify / Google (client)
│  ├─ MatchCard.tsx         # One fixture card
│  ├─ PredictSheet.tsx      # Bottom-sheet score picker → submitPrediction (single/multiple lock)
│  ├─ MatchesScreen.tsx     # Matches list (+ shared Toast)
│  ├─ MyPicksScreen.tsx     # "My Picks" screen
│  ├─ LeaderboardScreen.tsx # Podium + ranked list
│  └─ AdminScreen.tsx       # Organizer console (sub-tabs, create-fixture sheet, settings)
├─ lib/
│  ├─ supabase/client.ts    # Browser client
│  ├─ supabase/server.ts    # Server client (cookie-aware)
│  └─ types.ts              # Shared TS types
├─ supabase/
│  ├─ migrations/0001_init.sql            # Schema, RLS, triggers, leaderboard view
│  ├─ migrations/0002_submission_mode.sql # submission_mode column + UPDATE RLS policy
│  ├─ templates/confirmation.html         # OTP signup email ({{ .Token }})
│  ├─ seed.sql                            # Sample fixtures for local dev
│  └─ config.toml
├─ proxy.ts                 # Auth/session middleware (Next 16 renamed it from middleware.ts)
├─ next.config.ts           # turbopack.root pinned to this dir
├─ .env.local               # Local Supabase URL + key + Google creds (gitignored)
└─ .env.local.example
```

The UI is the dark **"Kickoff"** design system: tokens, keyframes and interaction
classes live in `app/globals.css`; presentational primitives in `components/ui.tsx`.
Pages stay **server components** that fetch data and hand it to **client screen**
components; mutations go through Server Actions in `app/actions.ts`.

---

## 4. Database schema

All tables are in the `public` schema. RLS is enabled on every user-facing table.

### `app_settings` (single row)
`tournament_timezone`, `points_exact`, `points_outcome`, `submission_mode`
(`'multiple'` | `'single'`). Drives deadline math, scoring, and the submission rule.

### `profiles`
`id` (→ `auth.users`), `display_name`, `is_admin`. Auto-created on signup.

### `matches`
`home_team`, `away_team`, `kickoff_time`, `deadline_type`, `deadline_value`,
`submission_deadline` (computed), `home_score`, `away_score` (nullable until played).

### `predictions`
`user_id`, `match_id`, `home_score`, `away_score`, `points` (computed).
Unique on `(user_id, match_id)` — one prediction per user per match.

### `leaderboard` (view)
Aggregates `total_points`, `scored_matches`, `exact_hits` per user. Exposes only
aggregates, so it's safe to read.

### Functions & triggers
| Object | Fires | Purpose |
|---|---|---|
| `is_admin()` | — | SECURITY DEFINER helper used in RLS to avoid recursion |
| `compute_deadline()` | before insert/update on `matches` | Derive `submission_deadline` from the rule |
| `handle_new_user()` | after insert on `auth.users` | Create the `profiles` row |
| `score_predictions()` | after result update on `matches` | Award points to all predictions |

### Key RLS policies
- `predictions` **insert** allowed when `auth.uid() = user_id` **and**
  `now() < submission_deadline` — the deadline lock (the one allowed submission).
- `predictions` **update** additionally requires `submission_mode = 'multiple'`, so in
  `single` mode the first pick can't be edited (migration `0002`).
- `predictions` select: own rows only.
- `matches` / `app_settings`: everyone reads; only admins write (`is_admin()`).

---

## 5. Local development

**Prerequisites:** Node 20.9+ (use Node 22 here), Docker Desktop running.

```bash
cd ~/Projects/worldcup-predictions

# 1. Ensure Node 22 is active (default nvm is v10 — too old)
nvm use 22            # or: nvm alias default 22  (one-time)

# 2. Start the local Supabase stack (Postgres + Auth + Studio, via Docker)
npx supabase start    # prints URLs + keys; values go in .env.local

# 3. Run the app
npm run dev           # http://localhost:3000
```

`.env.local` (already created for local dev):
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key from `supabase status`>

# Google OAuth — placeholders boot the stack; real sign-in needs real values.
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<from Google Cloud Console>
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<from Google Cloud Console>
```
> These Google vars are read by `supabase start` (not Next.js) to configure the local
> Auth server, so **restart the stack** after changing them. Authorized redirect URI:
> `http://127.0.0.1:54321/auth/v1/callback` (local) /
> `https://<project-ref>.supabase.co/auth/v1/callback` (cloud).

### Verifying email OTP locally
Email confirmation is **on** (`config.toml`), so signups must enter a 6-digit code.
Locally, no email is actually sent — open **Mailpit** at http://127.0.0.1:54324 to read
the code. Changing auth settings in `config.toml` requires `npx supabase stop && start`.

### Admin access
Every deployment ships with a **predefined organizer account** (seeded by migration
`0005`):

```
Email:    admin@kickoff.local
Password: ChangeMe123!   ← temporary
```

On first sign-in the app **forces a password change**: `profiles.must_change_password`
is `true`, so `proxy.ts` pins the account to `/change-password` until it sets its own
password (`changePassword` action clears the flag). Change the seeded email/password in
`0005_predefined_admin.sql` before shipping to a client.

To promote any *other* account, flip the flag in Studio (http://localhost:54323) or psql:
```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```
Reload — the **Admin** tab appears.

### Useful commands
```bash
npx supabase status     # show local URLs + keys
npx supabase db reset   # wipe + re-apply migrations + seed
npx supabase stop       # shut down the local stack
```

---

## 6. Admin workflow

The organizer console (**Admin**) has four sub-tabs:

1. **Fixtures → Add fixture:** teams, kickoff (local datetime), deadline rule + value.
   The deadline is computed automatically and shown on each fixture; delete from here too.
2. **Results:** matches awaiting a result get score steppers — **Publish result & score
   players** fires the scoring trigger and updates the leaderboard immediately.
3. **Players:** registered players with their points.
4. **Settings:** tournament timezone, point weights, and the **submission rule**
   (single vs. multiple — see [§2](#configurable-deadline-rules)).

---

## 7. Deployment (when ready to go live)

1. **Supabase Cloud:** create a project at supabase.com.
   ```bash
   npx supabase link --project-ref <your-ref>
   npx supabase db push        # applies supabase/migrations to the cloud DB
   ```
2. **Vercel:** push this repo to GitHub, import in Vercel, and set env vars:
   - `NEXT_PUBLIC_SUPABASE_URL` → your cloud project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your cloud publishable/anon key
3. **Email (OTP):** confirmations are already enabled. In Supabase Cloud, configure an
   SMTP sender (Auth → Email) so the OTP actually sends, and copy the
   `confirmation.html` template into Auth → Templates.
4. **Google OAuth:** in Supabase Cloud → Auth → Providers → Google, paste the client ID
   + secret, and add your production callback (`https://<ref>.supabase.co/auth/v1/callback`)
   to the Google Cloud OAuth client. Set the project's **Site URL** to your Vercel domain.
5. Deploy. Both Supabase and Vercel have free tiers suitable for a prediction pool.

> Review the RLS policies before opening registration.

---

## 8. Troubleshooting

### The dev server won't start / crashes immediately
Symptom: `SyntaxError: Unexpected token ?` and `npm ERR! ELIFECYCLE`.
Cause: an **old Node** is active. The machine's default nvm version is **v10.24.1**,
but Next 16 needs **20.9+**.
Fix:
```bash
nvm use 22                 # for this shell
nvm alias default 22       # make it the default everywhere (recommended)
```
If a detached/background launch ignores nvm, invoke Node 22 by full path:
```bash
PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH" npm run dev
```

### Pages hang on "Compiling…" forever
Cause: orphaned `postcss.js` / `next-server` worker processes from previous runs
pegging the CPU.
Fix:
```bash
pkill -9 -f "worldcup-predictions/.next"
pkill -9 -f "next-server"
pkill -9 -f "postcss.js"
rm -rf .next/dev          # clear stale dev cache
npm run dev
```

### "Could not save — the deadline may have passed, or this pool only allows one submission"
Working as intended: the RLS lock rejected a write — either after the deadline, or a
re-submit while `submission_mode = 'single'`.

### Sign-up OTP / Google login not working
- **No OTP email arrives:** locally, mail isn't sent — read it in **Mailpit**
  (http://127.0.0.1:54324). If auth config changed, `npx supabase stop && start`.
- **OTP rejected:** codes expire (default 1h) and are single-use; use the newest email.
- **Google fails immediately:** the local creds are placeholders. Add real
  `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` values and **restart** the stack (these are read by
  `supabase start`, not Next.js).

### Becoming an admin
There's no "admin login" — admin is a flag on your profile. Register/sign in normally,
then flip `profiles.is_admin = true` (see [§5](#5-local-development)) and reload; the
**Admin** tab appears.

### Workspace-root warning from Turbopack
A stray `~/package-lock.json` confuses root inference. Already handled via
`turbopack: { root: __dirname }` in `next.config.ts`.

### Supabase won't start
Ensure Docker Desktop is running (`docker info`). Then `npx supabase start`.

---

## 9. Notes specific to Next.js 16

This project targets Next.js 16, which has breaking changes vs. earlier versions:
- `middleware.ts` → **`proxy.ts`** (function renamed to `proxy`, runs on Node runtime).
- `cookies()` / `headers()` are **async-only** (`await cookies()`).
- Turbopack is the default bundler (no `--turbopack` flag needed).
- Server Actions used directly as a `<form action={...}>` must return `void` — that's
  why the admin actions throw on error instead of returning an object.

See `node_modules/next/dist/docs/` for the bundled version-specific guides.
