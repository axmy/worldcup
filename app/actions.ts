"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { fetchSchedule } from "@/lib/providers/livescore";
import { fixtureKey } from "@/lib/flags";
import { syncResults } from "@/lib/sync/results";

// The app's public origin for building redirect URLs (OAuth callback, password
// reset link). Prefer an explicit NEXT_PUBLIC_SITE_URL, then the request Origin,
// then Vercel's forwarded host — never falls back to localhost in production.
async function siteOrigin() {
  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host") ?? h.get("host");
  const forwardedProto = h.get("x-forwarded-proto") ?? "https";
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    h.get("origin") ??
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : "http://127.0.0.1:3000")
  );
}

// ---------------- Auth ----------------

// Register returns either an error, or a "verify" step carrying the email so the
// UI can prompt for the OTP. Email confirmation is enabled (see supabase config),
// so signUp creates no session — the user must verify the emailed 6-digit code.
export type RegisterResult =
  | { error: string }
  | { step: "verify"; email: string }
  | void;

export async function register(formData: FormData): Promise<RegisterResult> {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const displayName = String(formData.get("display_name"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) {
    if (/rate limit|too many/i.test(error.message)) {
      return { error: "We're sending too many emails right now. Please wait a minute and try again." };
    }
    return { error: error.message };
  }

  // Anti-enumeration: when the email is already registered, Supabase returns an
  // obfuscated user with an empty `identities` array and sends NO email. Detect
  // that and block it, instead of stranding the user on a verify screen waiting
  // for a code that never arrives.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { error: "An account with this email already exists — try signing in instead." };
  }

  // With email confirmation on, there's no session yet — go verify the OTP.
  if (!data.session) return { step: "verify", email };
  redirect("/matches");
}

// Verify the 6-digit code emailed after registration. On success a session is
// created and we land on /matches.
export async function verifyEmailOtp(formData: FormData) {
  const email = String(formData.get("email"));
  const token = String(formData.get("token")).trim();

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: error.message, step: "verify" as const, email };
  // Guarantee a profile + global-league membership even if the DB triggers
  // didn't fire, so the user lands on /matches with league context.
  await supabase.rpc("ensure_self");
  redirect("/matches");
}

// Resend the verification code (used by the "Resend code" link on the OTP step).
export async function resendEmailOtp(formData: FormData) {
  const email = String(formData.get("email"));
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) return { error: error.message, step: "verify" as const, email };
  return { step: "verify" as const, email };
}

export async function login(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  // Unchecked checkboxes submit nothing, so presence = "remember me" on.
  const remember = formData.get("remember") != null;

  // Record the preference BEFORE creating the client: the sign-in below writes
  // the auth cookies, and createClient reads this to decide whether they should
  // persist across browser restarts (remember on) or be session-only (off).
  const cookieStore = await cookies();
  cookieStore.set("remember", remember ? "1" : "0", {
    path: "/",
    sameSite: "lax",
    ...(remember ? { maxAge: 60 * 60 * 24 * 400 } : {}),
  });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  await supabase.rpc("ensure_self");
  redirect("/matches");
}

// Kick off the Google OAuth (PKCE) flow. Supabase returns the provider URL; we
// redirect the browser to it. Google then sends the user back to /auth/callback,
// which exchanges the code for a session.
export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = await siteOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error) throw new Error(error.message);
  if (data.url) redirect(data.url);
}

// Email a password-reset link to accounts that signed up with a password.
// The link routes through /auth/callback (which exchanges the code for a
// short-lived recovery session) and lands on /reset-password.
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address." };

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset`,
  });
  // Don't reveal whether the email exists — always report "sent".
  if (error && !/rate limit/i.test(error.message)) return { error: error.message };
  return { sent: true };
}

// Set a new password from the recovery session created by the reset link.
export async function resetPassword(formData: FormData) {
  const password = String(formData.get("password"));
  const confirm = String(formData.get("confirm"));
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired — request a new one." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  // Clear the temp-password flag too, in case this account had it set.
  await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);
  redirect("/matches");
}

// Force-change flow: a freshly-seeded admin (must_change_password) sets a new
// password here. Clearing the flag lets proxy.ts stop redirecting to this page.
export async function changePassword(formData: FormData) {
  const password = String(formData.get("password"));
  const confirm = String(formData.get("confirm"));
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);
  redirect("/matches");
}

export async function signOut() {
  const supabase = await createClient();
  // Local scope: clear this browser's session without a global revocation
  // round-trip to the auth server (which was making logout slow).
  await supabase.auth.signOut({ scope: "local" });

  // The proxy verifies the JWT locally (getClaims), so a single lingering
  // auth-cookie chunk would keep the user "signed in" and bounce them back
  // into the app — a logout loop. Delete every Supabase cookie to be sure.
  const cookieStore = await cookies();
  for (const { name } of cookieStore.getAll()) {
    if (name.startsWith("sb-")) cookieStore.delete(name);
  }
  cookieStore.delete("remember");

  redirect("/login");
}

// ---------------- Predictions ----------------
// The deadline lock is enforced by the RLS policy in the database, using the
// DB clock. If the deadline has passed, the insert/update is rejected here.

export async function submitPrediction(formData: FormData) {
  const matchId = String(formData.get("match_id"));
  const home = Number(formData.get("home_score"));
  const away = Number(formData.get("away_score"));

  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
    return { error: "Scores must be whole numbers ≥ 0." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // One prediction per user per match — it counts toward every league they join.
  const { error } = await supabase.from("predictions").upsert(
    {
      user_id: user.id,
      match_id: matchId,
      home_score: home,
      away_score: away,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,match_id" },
  );

  if (error) {
    // RLS rejection: the deadline passed, or edits are off (single-submission mode).
    return {
      error:
        "Could not save — the deadline may have passed, or edits are locked (single-submission mode).",
    };
  }
  revalidatePath("/matches");
  revalidatePath("/picks");
  return { ok: true };
}

// ---------------- Leagues ----------------
// All leagues share the global fixtures; a league is a named, code-joined group
// with its own scoring rules and standings. Any signed-in user can create a
// league (becoming its owner via the create_league RPC) and manage the ones
// they own; users join by code (join_league) and can leave their own.

// Parse the optional scoring overrides from a create/update form. Empty fields
// fall back to the platform defaults (handled inside the RPC for create).
function leagueRuleFields(formData: FormData) {
  const exact = formData.get("points_exact");
  const outcome = formData.get("points_outcome");
  const mode = String(formData.get("submission_mode") ?? "").trim();
  return {
    p_points_exact: exact === null || exact === "" ? null : Number(exact),
    p_points_outcome: outcome === null || outcome === "" ? null : Number(outcome),
    p_submission_mode: mode === "single" || mode === "multiple" ? mode : null,
  };
}

export async function createLeague(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "League name is required." };

  const supabase = await createClient();
  const rules = leagueRuleFields(formData);
  const { data, error } = await supabase.rpc("create_league", { p_name: name, ...rules });
  if (error) {
    if (/not signed in/i.test(error.message)) return { error: "Not signed in." };
    return { error: "Could not create the league." };
  }
  revalidatePath("/leagues");
  const league = Array.isArray(data) ? data[0] : data;
  if (league?.id) redirect(`/leagues/${league.id}`);
  return { ok: true };
}

export async function updateLeagueSettings(formData: FormData) {
  const leagueId = String(formData.get("league_id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "League name is required." };
  const rules = leagueRuleFields(formData);

  // Prizes arrive as a JSON array of strings (index = place). Sanitise here too;
  // clean_prizes() in the RPC is the authoritative trim/cap.
  let prizes: string[] = [];
  try {
    const raw = JSON.parse(String(formData.get("prizes") ?? "[]"));
    if (Array.isArray(raw)) {
      prizes = raw.map((p) => String(p ?? "").trim().slice(0, 80)).filter(Boolean).slice(0, 10);
    }
  } catch {
    /* malformed payload → no prizes */
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_league", {
    p_league_id: leagueId,
    p_name: name,
    p_points_exact: rules.p_points_exact ?? 3,
    p_points_outcome: rules.p_points_outcome ?? 1,
    p_submission_mode: rules.p_submission_mode ?? "multiple",
    p_prizes: prizes,
  });
  if (error) {
    return { error: /owner/i.test(error.message) ? "Only the league owner can do that." : "Could not save settings." };
  }
  revalidatePath("/leagues");
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/manage`);
  revalidatePath("/matches");
  revalidatePath("/picks");
  return { ok: true };
}

export async function regenerateJoinCode(formData: FormData) {
  const leagueId = String(formData.get("league_id"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("regenerate_join_code", { p_league_id: leagueId });
  if (error) {
    return { error: /owner/i.test(error.message) ? "Only the league owner can do that." : "Could not regenerate the code." };
  }
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/manage`);
  return { ok: true, code: data as string };
}

export async function removeMember(formData: FormData) {
  const leagueId = String(formData.get("league_id"));
  const userId = String(formData.get("user_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_league_id: leagueId, p_user_id: userId });
  if (error) {
    return { error: /owner/i.test(error.message) ? "The owner can't be removed." : "Could not remove member." };
  }
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/manage`);
  return { ok: true };
}

export async function joinLeague(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Enter a join code." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_league", { p_code: code });
  if (error) {
    return { error: /no league/i.test(error.message) ? "No league found for that code." : error.message };
  }
  revalidatePath("/leagues");
  const league = Array.isArray(data) ? data[0] : data;
  if (league?.id) redirect(`/leagues/${league.id}`);
  return { ok: true };
}

export async function joinGlobal() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_global");
  if (error) return { error: error.message };
  revalidatePath("/leagues");
  revalidatePath("/leaderboard");
  revalidatePath("/matches");
  revalidatePath("/picks");
  return { ok: true };
}

export async function leaveLeague(formData: FormData) {
  const leagueId = String(formData.get("league_id"));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("league_members").delete().eq("league_id", leagueId).eq("user_id", user.id);
  revalidatePath("/leagues");
  redirect("/leagues");
}

export async function deleteLeague(formData: FormData) {
  const leagueId = String(formData.get("league_id"));
  const supabase = await createClient();
  // RPC permits the league owner (or an admin) to delete; the global league is
  // protected. Direct table delete stays admin-only via RLS.
  const { error } = await supabase.rpc("delete_league", { p_league_id: leagueId });
  if (error) {
    return { error: /owner/i.test(error.message) ? "Only the league owner can do that." : "Could not delete the league." };
  }
  revalidatePath("/admin");
  revalidatePath("/leagues");
  return { ok: true };
}

// ---------------- Admin ----------------

// A fixture's submission window: an optional "opens at" and a required "closes
// at" (the deadline), both absolute datetimes. Close is stored as a
// fixed_datetime deadline so the DB trigger computes submission_deadline from it.
function matchWindowFields(formData: FormData) {
  const open = String(formData.get("submission_open") ?? "").trim();
  const close = String(formData.get("submission_close") ?? "").trim();
  if (!close) throw new Error("A submission close time (deadline) is required.");
  const closeIso = new Date(close).toISOString();
  return {
    home_team: String(formData.get("home_team")),
    away_team: String(formData.get("away_team")),
    kickoff_time: new Date(String(formData.get("kickoff_time"))).toISOString(),
    submission_open: open ? new Date(open).toISOString() : null,
    deadline_type: "fixed_datetime",
    deadline_value: closeIso,
  };
}

export async function createMatch(formData: FormData) {
  const supabase = await createClient();
  const fields = matchWindowFields(formData);
  const { error } = await supabase.from("matches").insert({
    ...fields,
    // submission_deadline is recomputed by the DB trigger; send a placeholder.
    submission_deadline: fields.deadline_value,
  });
  if (error) throw new Error(error.message);
  updateTag("matches");
  revalidatePath("/admin");
  revalidatePath("/matches");
  revalidatePath("/picks");
}

export async function updateMatch(formData: FormData) {
  const matchId = String(formData.get("match_id"));
  const supabase = await createClient();
  // The DB trigger recomputes submission_deadline from deadline_type/value.
  const { error } = await supabase.from("matches").update(matchWindowFields(formData)).eq("id", matchId);
  if (error) throw new Error(error.message);
  updateTag("matches");
  revalidatePath("/admin");
  revalidatePath("/matches");
  revalidatePath("/picks");
}

export async function updateResult(formData: FormData) {
  const matchId = String(formData.get("match_id"));
  const home = formData.get("home_score");
  const away = formData.get("away_score");

  const supabase = await createClient();
  const { error } = await supabase
    .from("matches")
    .update({
      home_score: home === "" ? null : Number(home),
      away_score: away === "" ? null : Number(away),
    })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
  // Entering a result fires the scoring trigger automatically.
  updateTag("matches");
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  revalidatePath("/matches");
  revalidatePath("/picks");
}

export async function deleteMatch(formData: FormData) {
  const matchId = String(formData.get("match_id"));
  const supabase = await createClient();
  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) throw new Error(error.message);
  updateTag("matches");
  revalidatePath("/admin");
  revalidatePath("/matches");
  revalidatePath("/picks");
}

export async function updateSettings(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({
      tournament_timezone: String(formData.get("tournament_timezone")),
      points_exact: Number(formData.get("points_exact")),
      points_outcome: Number(formData.get("points_outcome")),
      submission_mode: String(formData.get("submission_mode")),
      brand_name: String(formData.get("brand_name")),
      brand_tagline: String(formData.get("brand_tagline")),
      login_headline: String(formData.get("login_headline")),
      login_subtitle: String(formData.get("login_subtitle")),
      theme: String(formData.get("theme")),
      accent: String(formData.get("accent")),
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);

  // Platform-wide deadline policy: rewrite every match's rule (the DB recomputes
  // each match's submission_deadline from its kickoff_time).
  const dType = String(formData.get("deadline_type") ?? "");
  const dValue = String(formData.get("deadline_value") ?? "").trim();
  if (
    (dType === "minutes_before_kickoff" || dType === "minutes_after_kickoff") &&
    /^\d+$/.test(dValue)
  ) {
    const { error: dErr } = await supabase.rpc("apply_deadline_policy", {
      p_type: dType,
      p_value: dValue,
    });
    if (dErr) throw new Error(dErr.message);
  }

  updateTag("settings");
  updateTag("matches");
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

// ---------------- Results automation (Livescore) ----------------

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Not signed in." as const };
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return { supabase, error: "Admins only." as const };
  return { supabase, error: null };
}

// Pull the competition schedule from Livescore and upsert fixtures (matched by
// the provider's match id). Runs as the admin (RLS lets admins write matches).
// New fixtures default to "closes at kickoff" — the admin can edit.
export async function importFixtures() {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };

  let fixtures;
  try {
    fixtures = await fetchSchedule();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not reach the data provider." };
  }

  // Reconcile against the EXISTING rows only — never insert. Fixtures are
  // pre-seeded by migrations, so an import just refreshes teams/kickoffs and
  // stamps the provider ref onto the row that already represents each match.
  // Because nothing is inserted, importing is idempotent: clicking it again
  // re-matches by ref and can't create duplicates or re-add a played match.
  const { data: rows } = await supabase
    .from("matches")
    .select("id, home_team, away_team, kickoff_time, external_ref, provider, home_score");
  type Row = { id: string; home_team: string; away_team: string; kickoff_time: string; external_ref: string | null; provider: string; home_score: number | null };
  const all = (rows as Row[] | null) ?? [];

  const byRef = new Map<string, Row>();
  const byKey = new Map<string, Row>();
  for (const r of all) {
    if (r.external_ref) byRef.set(r.external_ref, r);
    const key = fixtureKey(r.home_team, r.away_team, r.kickoff_time);
    // If a match somehow exists twice, prefer the canonical (seeded, non-
    // livescore) row so we reconcile into it rather than a stray copy.
    if (!byKey.has(key) || r.provider !== "livescore") byKey.set(key, r);
  }

  // Ongoing tournament: never touch a match that has already kicked off or has a
  // result. Import only ever adjusts still-upcoming fixtures.
  const nowMs = Date.now();
  const isLocked = (r: Row) => r.home_score !== null || new Date(r.kickoff_time).getTime() <= nowMs;

  const syncedAt = new Date().toISOString();
  let updated = 0; // matched by provider ref (already claimed)
  let claimed = 0; // matched a seeded row by matchup, stamped the ref
  let skipped = 0; // no existing row to reconcile into
  let knockout = 0; // knockout fixtures, left to "Sync knockout teams"
  let locked = 0; // past / in-play matches, deliberately left untouched
  for (const f of fixtures) {
    // Knockouts live in dedicated placeholder rows (R32-1A …) that this matchup
    // reconcile can't key onto, so importing them here would duplicate. They're
    // handled by syncKnockoutFixtures — skip them so import only ever touches the
    // group stage.
    if (f.round !== "group" && f.round !== "other") {
      knockout++;
      continue;
    }
    // Updating kickoff_time recomputes submission_deadline via the DB trigger.
    const refRow = byRef.get(f.external_ref);
    if (refRow) {
      if (isLocked(refRow)) { locked++; continue; }
      const { error } = await supabase
        .from("matches")
        .update({ home_team: f.home_team, away_team: f.away_team, kickoff_time: f.kickoff_time, stage: "group", synced_at: syncedAt })
        .eq("id", refRow.id);
      if (!error) updated++;
      continue;
    }
    const keyRow = byKey.get(fixtureKey(f.home_team, f.away_team, f.kickoff_time));
    if (keyRow) {
      if (isLocked(keyRow)) { locked++; continue; }
      const { error } = await supabase
        .from("matches")
        .update({
          home_team: f.home_team,
          away_team: f.away_team,
          kickoff_time: f.kickoff_time,
          stage: "group",
          external_ref: f.external_ref,
          provider: "livescore",
          synced_at: syncedAt,
        })
        .eq("id", keyRow.id);
      if (!error) {
        claimed++;
        byRef.set(f.external_ref, keyRow); // guard against the feed listing it twice
      }
      continue;
    }
    skipped++;
  }

  updateTag("matches");
  revalidatePath("/admin");
  revalidatePath("/matches");
  revalidatePath("/picks");
  return { ok: true, updated, claimed, skipped, knockout, locked };
}

// One-off cleanup for duplicate fixtures left by an earlier insert-style import
// (the same match stored twice — a seeded row plus an imported copy). Groups
// rows by matchup, keeps the canonical one (most predictions, then the seeded
// non-livescore row, then the oldest), and deletes the empty extras. A duplicate
// that already has predictions is never deleted — it's reported as a conflict so
// the admin can merge it by hand. Safe to run repeatedly.
export async function removeDuplicateFixtures() {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };

  const { data: rows } = await supabase
    .from("matches")
    .select("id, home_team, away_team, kickoff_time, provider, stage, created_at, home_score");
  type Row = { id: string; home_team: string; away_team: string; kickoff_time: string; provider: string; stage: string; created_at: string; home_score: number | null };
  const all = (rows as Row[] | null) ?? [];

  const { data: preds } = await supabase.from("predictions").select("match_id");
  const predCount = new Map<string, number>();
  for (const p of (preds as { match_id: string }[] | null) ?? []) {
    predCount.set(p.match_id, (predCount.get(p.match_id) ?? 0) + 1);
  }

  // Ongoing tournament: a played match (has a result) is never deleted, so past
  // results are always preserved. A row is also kept if it holds predictions.
  const isProtected = (r: Row) => r.home_score !== null || (predCount.get(r.id) ?? 0) > 0;

  const deleted = new Set<string>();
  let removed = 0;
  let conflicts = 0;

  // Step 1 — exact duplicates by matchup key (bridges provider naming and
  // home/away order). Covers group dups and any knockout dup where both copies
  // already carry real team names. Keep the canonical row: the one with a result,
  // then most predictions, then the seeded (non-livescore) row, then the oldest.
  const groups = new Map<string, Row[]>();
  for (const r of all) {
    const k = fixtureKey(r.home_team, r.away_team, r.kickoff_time);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ranked = group.slice().sort((a, b) => {
      const scored = (b.home_score !== null ? 1 : 0) - (a.home_score !== null ? 1 : 0);
      if (scored) return scored;
      const byPreds = (predCount.get(b.id) ?? 0) - (predCount.get(a.id) ?? 0);
      if (byPreds) return byPreds;
      const seeded = (a.provider !== "livescore" ? 0 : 1) - (b.provider !== "livescore" ? 0 : 1);
      if (seeded) return seeded;
      return a.created_at.localeCompare(b.created_at);
    });
    for (const extra of ranked.slice(1)) {
      if (isProtected(extra)) {
        conflicts++; // played or has predictions — leave it for manual merge
        continue;
      }
      const { error } = await supabase.from("matches").delete().eq("id", extra.id);
      if (!error) {
        deleted.add(extra.id);
        removed++;
      }
    }
  }

  // Step 2 — knockout fixtures wrongly imported as standalone rows. The canonical
  // knockout rows are the placeholders (R32-1A …) that "Sync knockout teams"
  // fills. A leftover provider row for a knockout match has a real matchup (so it
  // doesn't key to any seeded GROUP row) and isn't a placeholder. Only act when
  // every placeholder is still present — i.e. no slot has been claimed yet — so a
  // legitimately synced knockout row is never mistaken for an import.
  const live = all.filter((r) => !deleted.has(r.id));
  const placeholdersPresent = live.filter((r) => isPlaceholderName(r.home_team)).length;
  const seededGroupKeys = new Set(
    live.filter((r) => r.stage === "group" && r.provider !== "livescore").map((r) => fixtureKey(r.home_team, r.away_team, r.kickoff_time)),
  );
  if (placeholdersPresent === KNOCKOUT_TOTAL) {
    for (const r of live) {
      if (r.provider !== "livescore" || isPlaceholderName(r.home_team)) continue;
      if (seededGroupKeys.has(fixtureKey(r.home_team, r.away_team, r.kickoff_time))) continue;
      if (isProtected(r)) {
        conflicts++;
        continue;
      }
      const { error } = await supabase.from("matches").delete().eq("id", r.id);
      if (!error) removed++;
    }
  }

  updateTag("matches");
  revalidatePath("/admin");
  revalidatePath("/matches");
  revalidatePath("/picks");
  return { ok: true as const, removed, conflicts };
}

// Fill the knockout placeholder rows (seeded by migration 0024 as 'R32-1A' v
// 'R32-1B', …) with the real teams + kickoff times as the provider resolves the
// bracket. Unlike importFixtures this NEVER inserts or touches group-stage
// fixtures — it only claims/updates the knockout placeholders, so re-running it
// can't bring back the already-played group matches.
//
// Matching: a placeholder is "claimed" the first time we slot a provider fixture
// into it (stamping external_ref); subsequent syncs match that row by
// external_ref. Within a round, fresh provider fixtures fill the remaining
// placeholders in kickoff order — the slot label is internal, so which empty
// slot a match lands in doesn't matter: teams, kickoff and external_ref are
// written as one unit and results later map back by external_ref.
const KNOCKOUT_PREFIX = {
  r32: "R32-",
  r16: "R16-",
  qf: "QF-",
  sf: "SF-",
  third: "Third-",
  final: "Final-",
} as const;
type KnockoutRound = keyof typeof KNOCKOUT_PREFIX;

// Bracket size per round → the full set of knockout placeholder rows (32). Used
// to tell whether any knockout slot has been claimed yet.
const KNOCKOUT_SLOTS: Record<KnockoutRound, number> = { r32: 16, r16: 8, qf: 4, sf: 2, third: 1, final: 1 };
const KNOCKOUT_TOTAL = Object.values(KNOCKOUT_SLOTS).reduce((a, b) => a + b, 0);
const isPlaceholderName = (name: string) => Object.values(KNOCKOUT_PREFIX).some((p) => name.startsWith(p));

export async function syncKnockoutFixtures() {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };

  let fixtures;
  try {
    fixtures = await fetchSchedule();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not reach the data provider." };
  }

  // Only knockout fixtures that have a placeholder round we manage.
  const byRound = new Map<KnockoutRound, typeof fixtures>();
  for (const f of fixtures) {
    if (f.round in KNOCKOUT_PREFIX) {
      const r = f.round as KnockoutRound;
      (byRound.get(r) ?? byRound.set(r, []).get(r)!).push(f);
    }
  }
  if (byRound.size === 0) return { ok: true as const, rounds: [], note: "No knockout fixtures available from the provider yet." };

  // Load the unclaimed placeholder rows for every round in one query.
  // In a PostgREST .or() filter string the LIKE wildcard is '*', not SQL '%'.
  const likeFilters = Object.values(KNOCKOUT_PREFIX).map((p) => `home_team.like.${p}*`).join(",");
  const { data: placeholderRows } = await supabase
    .from("matches")
    .select("id, home_team, kickoff_time")
    .or(likeFilters);
  const placeholders = (placeholderRows as { id: string; home_team: string; kickoff_time: string }[] | null) ?? [];

  // Rows already claimed by one of these provider fixtures (match by ref).
  // home_score lets us leave a knockout match alone once it has been played.
  const allRefs = [...byRound.values()].flat().map((f) => f.external_ref);
  const { data: claimedRows } = await supabase
    .from("matches")
    .select("id, external_ref, home_score")
    .in("external_ref", allRefs.length ? allRefs : ["__none__"]);
  const claimedByRef = new Map(
    ((claimedRows as { id: string; external_ref: string; home_score: number | null }[] | null) ?? []).map((r) => [r.external_ref, r]),
  );

  const syncedAt = new Date().toISOString();
  const rounds: { round: KnockoutRound; claimed: number; updated: number; waiting: number }[] = [];

  for (const round of Object.keys(KNOCKOUT_PREFIX) as KnockoutRound[]) {
    const provFix = (byRound.get(round) ?? []).slice().sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time));
    if (provFix.length === 0) continue;
    const slots = placeholders
      .filter((p) => p.home_team.startsWith(KNOCKOUT_PREFIX[round]))
      .sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time));

    let claimed = 0;
    let updated = 0;
    const toClaim: typeof provFix = [];
    for (const f of provFix) {
      const existing = claimedByRef.get(f.external_ref);
      if (existing) {
        // Already played — leave the result and its fixture untouched.
        if (existing.home_score !== null) continue;
        const { error } = await supabase
          .from("matches")
          .update({ home_team: f.home_team, away_team: f.away_team, kickoff_time: f.kickoff_time, stage: round, synced_at: syncedAt })
          .eq("id", existing.id);
        if (!error) updated++;
      } else {
        toClaim.push(f);
      }
    }
    for (let i = 0; i < toClaim.length && i < slots.length; i++) {
      const f = toClaim[i];
      // Updating kickoff_time recomputes submission_deadline via the trigger;
      // clearing submission_open opens the pick window now that teams are known.
      const { error } = await supabase
        .from("matches")
        .update({
          home_team: f.home_team,
          away_team: f.away_team,
          kickoff_time: f.kickoff_time,
          stage: round,
          submission_open: null,
          external_ref: f.external_ref,
          provider: "livescore",
          synced_at: syncedAt,
        })
        .eq("id", slots[i].id);
      if (!error) claimed++;
    }
    rounds.push({ round, claimed, updated, waiting: Math.max(0, slots.length - claimed) });
  }

  updateTag("matches");
  revalidatePath("/admin");
  revalidatePath("/matches");
  revalidatePath("/picks");
  return { ok: true as const, rounds };
}

// Re-seed the built-in 72 WC2026 fixtures (no API needed). Only inserts when the
// fixtures table is empty — e.g. right after a Reset.
export async function seedFixtures() {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };
  const { data, error } = await supabase.rpc("seed_wc2026_fixtures");
  if (error) return { error: error.message };
  updateTag("matches");
  revalidatePath("/admin");
  revalidatePath("/matches");
  revalidatePath("/picks");
  return { ok: true, inserted: (data as number | null) ?? 0 };
}

// On-demand results sync (same engine the cron uses) — works on any host plan.
export async function syncResultsNow() {
  const { error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };
  try {
    const summary = await syncResults();
    // The engine only revalidateTags (it must also run in the cron Route
    // Handler, where updateTag is forbidden); from this Server Action we can
    // updateTag so the admin's own refresh sees the new scores immediately.
    if (summary.updated > 0 || summary.liveUpdated > 0) updateTag("matches");
    return { ok: true, ...summary };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sync failed." };
  }
}

// Granular admin maintenance — each keeps the admin + global league.
async function runMaintenance(rpc: "clear_scores" | "clear_predictions" | "delete_user_leagues" | "delete_players") {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };
  const { data, error } = await supabase.rpc(rpc);
  if (error) return { error: error.message };
  updateTag("matches");
  revalidatePath("/admin");
  revalidatePath("/matches");
  revalidatePath("/picks");
  revalidatePath("/leagues");
  revalidatePath("/leaderboard");
  return { ok: true, count: (data as number | null) ?? 0 };
}

export async function clearScores() {
  return runMaintenance("clear_scores");
}
export async function clearPredictions() {
  return runMaintenance("clear_predictions");
}
export async function removeLeagues() {
  return runMaintenance("delete_user_leagues");
}
export async function removePlayers() {
  return runMaintenance("delete_players");
}

// DESTRUCTIVE: wipe predictions, results, user leagues and fixtures (keeps users
// and the global league). Guarded by is_admin() in the RPC.
export async function resetData(formData: FormData) {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };
  if (String(formData.get("confirm") ?? "") !== "RESET") {
    return { error: 'Type RESET to confirm.' };
  }
  const { error } = await supabase.rpc("reset_app_data");
  if (error) return { error: error.message };
  updateTag("matches");
  revalidatePath("/admin");
  revalidatePath("/matches");
  revalidatePath("/picks");
  revalidatePath("/leagues");
  revalidatePath("/leaderboard");
  return { ok: true };
}
