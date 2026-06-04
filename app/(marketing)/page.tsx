import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getSettingsCached } from "@/lib/data";
import { getSiteUrl } from "@/lib/site";
import { LandingScreen } from "@/components/LandingScreen";
import type { LeaderboardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// Public marketing landing page at "/". Signed-in users go straight to the app;
// everyone else sees the pitch (Chrome renders this full-bleed when signed out).
export default async function Home() {
  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (userId) redirect("/matches");

  const [settings, { data: rows }, shareUrl] = await Promise.all([
    getSettingsCached(),
    supabase.rpc("global_standings"),
    getSiteUrl(),
  ]);

  const topPlayers = ((rows as LeaderboardRow[] | null) ?? [])
    .sort((a, b) => b.total_points - a.total_points || b.exact_hits - a.exact_hits)
    .slice(0, 5);

  return (
    <LandingScreen
      brandName={settings?.brand_name ?? "Kickoff"}
      brandTagline={settings?.brand_tagline ?? "WC26 · Predictor"}
      topPlayers={topPlayers}
      shareUrl={shareUrl || undefined}
    />
  );
}
