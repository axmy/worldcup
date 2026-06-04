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

  // Only the top 5 are shown — push the ordering + limit into the query so we
  // never transfer the whole (possibly huge) global board for a teaser.
  const [settings, { data: rows }, shareUrl] = await Promise.all([
    getSettingsCached(),
    supabase
      .rpc("global_standings")
      .order("total_points", { ascending: false })
      .order("exact_hits", { ascending: false })
      .limit(5),
    getSiteUrl(),
  ]);

  const topPlayers = (rows as LeaderboardRow[] | null) ?? [];

  return (
    <LandingScreen
      brandName={settings?.brand_name ?? "Kickoff"}
      brandTagline={settings?.brand_tagline ?? "WC26 · Predictor"}
      topPlayers={topPlayers}
      shareUrl={shareUrl || undefined}
    />
  );
}
