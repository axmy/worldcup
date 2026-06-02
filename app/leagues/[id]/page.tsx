import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeaderboardScreen } from "@/components/LeaderboardScreen";
import { LeagueHeader } from "@/components/LeagueHeader";
import type { LeaderboardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS only returns the league if the caller is a member (or admin).
  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, join_code")
    .eq("id", id)
    .single();
  if (!league) notFound();

  const { data: rows } = await supabase.rpc("league_standings", { p_league_id: id });

  const board = ((rows as LeaderboardRow[] | null) ?? []).sort(
    (a, b) => b.total_points - a.total_points || b.exact_hits - a.exact_hits,
  );

  return (
    <LeaderboardScreen
      board={board}
      meId={user?.id ?? ""}
      title={league.name}
      subtitle={`${board.length} member${board.length === 1 ? "" : "s"}`}
      header={<LeagueHeader leagueId={league.id} joinCode={league.join_code} />}
    />
  );
}
