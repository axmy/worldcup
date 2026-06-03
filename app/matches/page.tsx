import { createClient, getUserId } from "@/lib/supabase/server";
import { getMatchesCached, getSettingsCached } from "@/lib/data";
import { MatchesScreen, type PredMap } from "@/components/MatchesScreen";
import type { LeagueOption } from "@/components/LeagueSwitcher";
import type { Prediction } from "@/lib/types";

export const dynamic = "force-dynamic";

// Resolve the user's leagues and the one they're currently viewing (?league=),
// defaulting to their first. Predictions are scoped to that league.
async function resolveLeagues(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  requested?: string,
) {
  const { data } = await supabase
    .from("league_members")
    .select("leagues(id, name)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });

  const leagues = ((data as { leagues: LeagueOption | null }[] | null) ?? [])
    .map((r) => r.leagues)
    .filter((l): l is LeagueOption => l !== null);

  const activeLeagueId = leagues.find((l) => l.id === requested)?.id ?? leagues[0]?.id ?? null;
  return { leagues, activeLeagueId };
}

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const { league } = await searchParams;
  const supabase = await createClient();
  const userId = (await getUserId(supabase))!;

  const [{ leagues, activeLeagueId }, matches, settings] = await Promise.all([
    resolveLeagues(supabase, userId, league),
    getMatchesCached(),
    getSettingsCached(),
  ]);

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
    <MatchesScreen
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
