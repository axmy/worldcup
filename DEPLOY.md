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

The schema lives in `supabase/migrations/` (`0001`…`0009`), applied in order.

```bash
supabase link --project-ref xfwbnyqimrytrjutfbuu
supabase db push
```

This applies all migrations (and seeds the 72 WC2026 fixtures + the predefined
admin). Re-run `supabase db push` after adding any new migration.

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

---

## 3. Vercel

### 3a. Environment variables  (Project → Settings → Environment Variables)
The app reads only these at runtime:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xfwbnyqimrytrjutfbuu.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the project's anon/public key |
| `NEXT_PUBLIC_SITE_URL` *(optional but recommended)* | `https://scorepredict.xyz` — forces the canonical origin for OAuth/reset redirect URLs regardless of which host the request came in on |

> The `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` vars in `.env.local` are **local-only**
> (`supabase start`). Production Google creds go in the Supabase dashboard (2b),
> not Vercel.

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

## 5. Security checklist
- [ ] Rotate the Google OAuth **client secret** (it was shared in plaintext during development) and update it in the Supabase dashboard.
- [ ] Change the predefined admin password (or confirm the forced-change flow ran).
- [ ] Confirm `.env.local` is gitignored and not committed.
