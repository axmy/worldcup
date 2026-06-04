import Link from "next/link";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getSettingsCached } from "@/lib/data";
import { LeaderboardScreen } from "@/components/LeaderboardScreen";
import { Brand } from "@/components/ui";
import type { LeaderboardRow } from "@/lib/types";

type RankRow = {
  rank: number;
  total_points: number;
  scored_matches: number;
  exact_hits: number;
  total_players: number;
};

export const dynamic = "force-dynamic";

// The global competition's standings — public, visible to logged-out visitors.
// (Chrome renders bare when signed out, so we add a lightweight top bar with a
// sign-in CTA for that case.)
export default async function LeaderboardPage() {
  const supabase = await createClient();
  const userId = await getUserId(supabase);

  const TOP_N = 50;
  const [{ data: rows }, rankRes, { data: count }, settings] = await Promise.all([
    supabase
      .rpc("global_standings")
      .order("total_points", { ascending: false })
      .order("exact_hits", { ascending: false })
      .limit(TOP_N),
    userId ? supabase.rpc("global_rank") : Promise.resolve({ data: null }),
    supabase.rpc("global_player_count"),
    getSettingsCached(),
  ]);

  const board = (rows as LeaderboardRow[] | null) ?? [];
  const meRow = (rankRes?.data as RankRow[] | null)?.[0] ?? null;
  const total = (count as number | null) ?? meRow?.total_players ?? board.length;

  const screen = (
    <LeaderboardScreen
      board={board}
      meId={userId ?? ""}
      title="Global Leaderboard"
      subtitle={`The official competition · ${total.toLocaleString()} player${total === 1 ? "" : "s"}`}
      meRank={meRow ? { rank: meRow.rank, total_points: meRow.total_points, scored_matches: meRow.scored_matches, exact_hits: meRow.exact_hits } : undefined}
      cappedAt={TOP_N}
    />
  );

  // Signed in: render inside the app chrome (handled by the root layout).
  if (userId) return screen;

  // Signed out: provide our own header + CTA, then the board.
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <header
        style={{
          borderBottom: "1px solid var(--line-soft)",
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "color-mix(in oklab, var(--bg) 84%, transparent)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <Brand name={settings?.brand_name ?? "Kickoff"} tagline={settings?.brand_tagline ?? "WC26 · Predictor"} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/login" className="btn-ghost tap" style={{ padding: "9px 14px", borderRadius: 10, textDecoration: "none", fontSize: 14, color: "var(--text-dim)" }}>
              Sign in
            </Link>
            <Link href="/register" className="btn-sport tap" style={{ padding: "9px 16px", borderRadius: 10, textDecoration: "none", fontSize: 14 }}>
              Join free
            </Link>
          </div>
        </div>
      </header>
      <main>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "22px 18px 60px" }}>{screen}</div>
      </main>
    </div>
  );
}
