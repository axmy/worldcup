"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

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
  if (error) return { error: error.message };

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
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
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
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

  redirect("/login");
}

// ---------------- Predictions ----------------
// The deadline lock is enforced by the RLS policy in the database, using the
// DB clock. If the deadline has passed, the insert/update is rejected here.

export async function submitPrediction(formData: FormData) {
  const matchId = String(formData.get("match_id"));
  const leagueId = String(formData.get("league_id"));
  const home = Number(formData.get("home_score"));
  const away = Number(formData.get("away_score"));

  if (!leagueId) return { error: "Pick a league before predicting." };
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
    return { error: "Scores must be whole numbers ≥ 0." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("predictions").upsert(
    {
      user_id: user.id,
      league_id: leagueId,
      match_id: matchId,
      home_score: home,
      away_score: away,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,league_id,match_id" },
  );

  if (error) {
    // RLS rejection surfaces here: deadline passed, not a member of the league,
    // or a re-submit while the tournament is in "single submission" mode.
    return {
      error:
        "Could not save — the deadline may have passed, or this pool only allows one submission per match.",
    };
  }
  revalidatePath("/matches");
  revalidatePath("/picks");
  return { ok: true };
}

// ---------------- Leagues ----------------
// All leagues share the global fixtures; a league is a named, code-joined
// group with its own standings. Only admins create/delete leagues; users
// join by code (via the join_league RPC) and can leave their own.

export async function createLeague(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "League name is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // join_code has a DB default + unique constraint; retry on the rare collision.
  let lastError = "Could not create the league.";
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from("leagues").insert({ name, created_by: user.id });
    if (!error) {
      revalidatePath("/admin");
      revalidatePath("/leagues");
      return { ok: true };
    }
    lastError = error.message;
    if (error.code !== "23505") break; // not a unique-violation → don't retry
  }
  return { error: lastError };
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
  const { error } = await supabase.from("leagues").delete().eq("id", leagueId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/leagues");
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
  updateTag("settings");
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}
