import { createClient, getUserId } from "@/lib/supabase/server";
import { LeaguesScreen } from "@/components/LeaguesScreen";
import type { LeagueSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

type MembershipRow = {
  leagues: {
    id: string;
    name: string;
    join_code: string;
    created_by: string | null;
    created_at: string;
    points_exact: number;
    points_outcome: number;
    submission_mode: "single" | "multiple";
    is_global: boolean;
    league_members: { count: number }[];
  } | null;
};

export default async function LeaguesPage() {
  const supabase = await createClient();
  const userId = (await getUserId(supabase))!;

  // Leagues I'm a member of, with each league's total member count.
  const { data } = await supabase
    .from("league_members")
    .select(
      "leagues(id, name, join_code, created_by, created_at, points_exact, points_outcome, submission_mode, is_global, league_members(count))",
    )
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });

  const leagues: LeagueSummary[] = ((data as MembershipRow[] | null) ?? [])
    .map((row) => row.leagues)
    .filter((l): l is NonNullable<MembershipRow["leagues"]> => l !== null)
    .map((l) => ({
      id: l.id,
      name: l.name,
      join_code: l.join_code,
      created_by: l.created_by,
      created_at: l.created_at,
      points_exact: l.points_exact,
      points_outcome: l.points_outcome,
      submission_mode: l.submission_mode,
      is_global: l.is_global,
      member_count: l.league_members?.[0]?.count ?? 0,
    }));

  // Sort the global league first so it's always the obvious entry point.
  leagues.sort((a, b) => Number(b.is_global) - Number(a.is_global));

  const inGlobal = leagues.some((l) => l.is_global);

  return <LeaguesScreen leagues={leagues} meId={userId} inGlobal={inGlobal} />;
}
