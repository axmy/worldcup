import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getMatchesCached, getSettingsCached } from "@/lib/data";
import { AdminScreen, type Settings } from "@/components/AdminScreen";
import type { LeaderboardRow, LeagueSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const userId = (await getUserId(supabase))!;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();
  if (!profile?.is_admin) redirect("/matches");

  const USER_CAP = 200;
  const [matches, settings, { data: players }, { count: totalUsers }, { data: leaguesRaw }, { data: memberships }] = await Promise.all([
    getMatchesCached(),
    getSettingsCached(),
    // Cap the rendered list; show the true total separately so the page stays
    // fast even with thousands of users.
    supabase.from("leaderboard").select("*").order("total_points", { ascending: false }).limit(USER_CAP),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("leagues")
      .select("id, name, join_code, created_by, created_at, points_exact, points_outcome, submission_mode, is_global, league_members(count)")
      .order("created_at", { ascending: false }),
    supabase.from("league_members").select("user_id"),
  ]);

  // How many leagues each user belongs to — shown in the global user list.
  const leagueCounts: Record<string, number> = {};
  ((memberships as { user_id: string }[] | null) ?? []).forEach((m) => {
    leagueCounts[m.user_id] = (leagueCounts[m.user_id] ?? 0) + 1;
  });

  const s = (settings ?? {}) as Partial<Settings>;

  type LeagueRaw = Omit<LeagueSummary, "member_count"> & { league_members: { count: number }[] };
  const leagues: LeagueSummary[] = ((leaguesRaw as LeagueRaw[] | null) ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    join_code: l.join_code,
    created_by: l.created_by,
    created_at: l.created_at,
    points_exact: l.points_exact,
    points_outcome: l.points_outcome,
    submission_mode: l.submission_mode,
    is_global: l.is_global,
    member_count: l.league_members?.[0]?.count ?? 0,
  }));

  return (
    <AdminScreen
      matches={matches}
      settings={{
        tournament_timezone: s.tournament_timezone ?? "Indian/Maldives",
        points_exact: s.points_exact ?? 3,
        points_outcome: s.points_outcome ?? 1,
        submission_mode: s.submission_mode === "single" ? "single" : "multiple",
        brand_name: s.brand_name ?? "Kickoff",
        brand_tagline: s.brand_tagline ?? "WC26 · Predictor",
        login_headline: s.login_headline ?? "Call the scoreline. Own the board.",
        login_subtitle: s.login_subtitle ?? "",
        theme: s.theme === "light" ? "light" : "dark",
        accent: s.accent ?? "oklch(0.87 0.2 128)",
      }}
      players={(players as LeaderboardRow[] | null) ?? []}
      leagues={leagues}
      leagueCounts={leagueCounts}
      totalUsers={totalUsers ?? 0}
    />
  );
}
