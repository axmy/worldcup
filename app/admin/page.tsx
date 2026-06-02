import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminScreen, type Settings } from "@/components/AdminScreen";
import type { LeaderboardRow, LeagueSummary, Match } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user!.id)
    .single();
  if (!profile?.is_admin) redirect("/matches");

  const [{ data: matches }, { data: settings }, { data: players }, { data: leaguesRaw }] = await Promise.all([
    supabase.from("matches").select("*").order("kickoff_time"),
    supabase.from("app_settings").select("*").eq("id", 1).single(),
    supabase.from("leaderboard").select("*").order("total_points", { ascending: false }),
    supabase
      .from("leagues")
      .select("id, name, join_code, created_by, created_at, league_members(count)")
      .order("created_at", { ascending: false }),
  ]);

  const s = (settings ?? {}) as Partial<Settings>;

  type LeagueRaw = Omit<LeagueSummary, "member_count"> & { league_members: { count: number }[] };
  const leagues: LeagueSummary[] = ((leaguesRaw as LeagueRaw[] | null) ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    join_code: l.join_code,
    created_by: l.created_by,
    created_at: l.created_at,
    member_count: l.league_members?.[0]?.count ?? 0,
  }));

  return (
    <AdminScreen
      matches={(matches as Match[] | null) ?? []}
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
    />
  );
}
