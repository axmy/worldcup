import { createClient } from "@/lib/supabase/server";
import { MatchesScreen, type PredMap } from "@/components/MatchesScreen";
import type { LeagueOption } from "@/components/LeagueSwitcher";
import type { Match, Prediction } from "@/lib/types";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { leagues, activeLeagueId } = await resolveLeagues(supabase, user!.id, league);

  const [{ data: matches }, { data: settings }] = await Promise.all([
    supabase.from("matches").select("*").order("kickoff_time", { ascending: true }),
    supabase.from("app_settings").select("submission_mode, points_exact, points_outcome").eq("id", 1).single(),
  ]);

  const predMap: PredMap = {};
  if (activeLeagueId) {
    const { data: predictions } = await supabase
      .from("predictions")
      .select("*")
      .eq("user_id", user!.id)
      .eq("league_id", activeLeagueId);
    (predictions as Prediction[] | null)?.forEach((p) => {
      predMap[p.match_id] = [p.home_score, p.away_score];
    });
  }

  return (
    <MatchesScreen
      matches={(matches as Match[] | null) ?? []}
      predictions={predMap}
      leagues={leagues}
      activeLeagueId={activeLeagueId}
      submissionMode={settings?.submission_mode === "single" ? "single" : "multiple"}
      exactPts={settings?.points_exact ?? 3}
      outcomePts={settings?.points_outcome ?? 1}
    />
  );
}
