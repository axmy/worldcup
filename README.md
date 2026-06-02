# World Cup Score Predictions

Registered users predict the score of each match. The organizer sets a **configurable
submission deadline** per match — either *N minutes before kickoff* or *a fixed time of
day* (e.g. 10pm). Once the deadline passes, submissions are locked. Points are awarded
automatically when the organizer enters the real result, and a live leaderboard ranks
everyone.

**Stack:** Next.js 16 (App Router) · Tailwind CSS v4 · Supabase (Postgres + Auth) · TypeScript.

## How the deadline lock works

- Each match stores a computed `submission_deadline` (a DB trigger derives it from the
  rule the organizer picks).
- A **Row-Level Security policy** rejects any insert/update to `predictions` where
  `now() >= submission_deadline`, using the **database clock** — so it can't be bypassed
  from the browser.
- The UI shows a live countdown and disables inputs at zero (cosmetic; the RLS policy is
  the real gate).

"Before 10pm" is interpreted in the **tournament timezone** set under Admin → Settings.

## Local development

Prerequisites: Node 20.9+, Docker Desktop running.

```bash
npm install
npx supabase start          # boots local Postgres + Auth + Studio (Docker)
# .env.local is created for you; values are also printed by `supabase start`
npm run dev                 # http://localhost:3000
```

Local URLs:
- App: http://localhost:3000
- Supabase Studio (DB UI): http://localhost:54323

### Make yourself an admin

1. Register an account in the app.
2. In Studio's SQL editor run:
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'you@example.com');
   ```
3. Reload — the **Admin** link appears in the nav.

### Useful commands

```bash
npx supabase status         # show local URLs + keys
npx supabase db reset       # re-apply migrations + seed
npx supabase stop           # shut the local stack down
```

## Deploying

- **App:** push to GitHub → import in Vercel (free tier).
- **Database/Auth:** create a project at supabase.com, run the migration
  (`supabase db push`), and set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  in Vercel's env settings.
