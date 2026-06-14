import { notFound } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getSettingsCached } from "@/lib/data";
import { LeaderboardScreen } from "@/components/LeaderboardScreen";
import { LeaderboardTabs } from "@/components/LeaderboardTabs";
import { LeagueHeader } from "@/components/LeagueHeader";
import type { LeaderboardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const userId = await getUserId(supabase);

  // RLS only returns the league if the caller is a member (or admin).
  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, join_code, created_by, is_global, points_exact, points_outcome, submission_mode, prizes")
    .eq("id", id)
    .single();
  if (!league) notFound();

  const isOwner = !!userId && league.created_by === userId;

  const [{ data: rows }, settings] = await Promise.all([
    supabase.rpc("league_standings", { p_league_id: id }),
    getSettingsCached(),
  ]);

  const board = ((rows as LeaderboardRow[] | null) ?? []).sort(
    (a, b) => b.total_points - a.total_points || b.exact_hits - a.exact_hits,
  );

  const deadlineType = settings?.deadline_type ?? "minutes_after_kickoff";
  const deadlineValue = settings?.deadline_value ?? "45";

  return (
    <LeaderboardTabs
      scope="league"
      header={
        <LeagueHeader
          leagueId={league.id}
          joinCode={league.join_code}
          isOwner={isOwner}
          isGlobal={league.is_global}
        />
      }
      info={{
        points_exact: league.points_exact,
        points_outcome: league.points_outcome,
        submission_mode: settings?.submission_mode === "single" ? "single" : "multiple",
        deadline_type: deadlineType,
        deadline_value: deadlineValue,
      }}
      board={
        <LeaderboardScreen
          board={board}
          meId={userId ?? ""}
          title={league.name}
          subtitle={`${board.length} member${board.length === 1 ? "" : "s"}`}
          prizes={(league.prizes as string[] | null) ?? []}
          rules={{
            exact: league.points_exact,
            outcome: league.points_outcome,
            mode: settings?.submission_mode === "single" ? "single" : "multiple",
            deadlineType,
            deadlineValue,
          }}
        />
      }
    />
  );
}
