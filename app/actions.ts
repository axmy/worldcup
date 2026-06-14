"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { fetchSchedule } from "@/lib/providers/livescore";
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

  const { data: existingRows } = await supabase
    .from("matches")
    .select("id, external_ref")
    .eq("provider", "livescore")
    .not("external_ref", "is", null);
  const existing = new Map(
    ((existingRows as { id: string; external_ref: string }[] | null) ?? []).map((r) => [r.external_ref, r.id]),
  );

  let inserted = 0;
  let updated = 0;
  for (const f of fixtures) {
    const id = existing.get(f.external_ref);
    if (id) {
      // Updating kickoff_time recomputes submission_deadline via the trigger,
      // preserving the fixture's existing deadline rule.
      const { error } = await supabase
        .from("matches")
        .update({ home_team: f.home_team, away_team: f.away_team, kickoff_time: f.kickoff_time })
        .eq("id", id);
      if (!error) updated++;
    } else {
      const { error } = await supabase.from("matches").insert({
        home_team: f.home_team,
        away_team: f.away_team,
        kickoff_time: f.kickoff_time,
        deadline_type: "minutes_before_kickoff",
        deadline_value: "0",
        submission_deadline: f.kickoff_time, // placeholder; recomputed by trigger
        external_ref: f.external_ref,
        provider: "livescore",
      });
      if (!error) inserted++;
    }
  }

  updateTag("matches");
  revalidatePath("/admin");
  revalidatePath("/matches");
  revalidatePath("/picks");
  return { ok: true, inserted, updated };
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
