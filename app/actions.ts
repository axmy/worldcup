"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

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
  const origin = (await headers()).get("origin") ?? "http://127.0.0.1:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error) throw new Error(error.message);
  if (data.url) redirect(data.url);
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
  await supabase.auth.signOut();
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

export async function createMatch(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("matches").insert({
    home_team: String(formData.get("home_team")),
    away_team: String(formData.get("away_team")),
    kickoff_time: new Date(String(formData.get("kickoff_time"))).toISOString(),
    deadline_type: String(formData.get("deadline_type")),
    deadline_value: String(formData.get("deadline_value")),
    // submission_deadline is computed by the DB trigger; send a placeholder.
    submission_deadline: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/matches");
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
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
}

export async function deleteMatch(formData: FormData) {
  const matchId = String(formData.get("match_id"));
  const supabase = await createClient();
  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/matches");
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
  revalidatePath("/admin");
}
