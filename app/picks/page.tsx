import { createClient, getUserId } from "@/lib/supabase/server";
import { getMatchesCached, getSettingsCached } from "@/lib/data";
import { MyPicksScreen } from "@/components/MyPicksScreen";
import type { PredMap } from "@/components/MatchesScreen";
import type { LeagueOption } from "@/components/LeagueSwitcher";
import type { Prediction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PicksPage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const { league } = await searchParams;
  const supabase = await createClient();
  const userId = (await getUserId(supabase))!;

  const { data: memberships } = await supabase
    .from("league_members")
    .select("leagues(id, name)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });

  const leagues = ((memberships as { leagues: LeagueOption | null }[] | null) ?? [])
    .map((r) => r.leagues)
    .filter((l): l is LeagueOption => l !== null);
  const activeLeagueId = leagues.find((l) => l.id === league)?.id ?? leagues[0]?.id ?? null;

  const [matches, settings] = await Promise.all([getMatchesCached(), getSettingsCached()]);

  const predMap: PredMap = {};
  if (activeLeagueId) {
    const { data: predictions } = await supabase
      .from("predictions")
      .select("*")
      .eq("user_id", userId)
      .eq("league_id", activeLeagueId);
    (predictions as Prediction[] | null)?.forEach((p) => {
      predMap[p.match_id] = [p.home_score, p.away_score];
    });
  }

  return (
    <MyPicksScreen
      matches={matches}
      predictions={predMap}
      leagues={leagues}
      activeLeagueId={activeLeagueId}
      submissionMode={settings?.submission_mode === "single" ? "single" : "multiple"}
      exactPts={settings?.points_exact ?? 3}
      outcomePts={settings?.points_outcome ?? 1}
    />
  );
}
