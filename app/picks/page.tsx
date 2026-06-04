import { createClient, getUserId } from "@/lib/supabase/server";
import { getMatchesCached, getSettingsCached } from "@/lib/data";
import { MyPicksScreen } from "@/components/MyPicksScreen";
import type { PredMap } from "@/components/MatchesScreen";
import type { Prediction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PicksPage() {
  const supabase = await createClient();
  const userId = (await getUserId(supabase))!;

  const [matches, settings, { data: predictions }] = await Promise.all([
    getMatchesCached(),
    getSettingsCached(),
    supabase.from("predictions").select("*").eq("user_id", userId),
  ]);

  const predMap: PredMap = {};
  (predictions as Prediction[] | null)?.forEach((p) => {
    predMap[p.match_id] = [p.home_score, p.away_score];
  });

  return (
    <MyPicksScreen
      matches={matches}
      predictions={predMap}
      submissionMode={settings?.submission_mode === "single" ? "single" : "multiple"}
      exactPts={settings?.points_exact ?? 3}
      outcomePts={settings?.points_outcome ?? 1}
    />
  );
}
