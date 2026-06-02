import { createClient } from "@/lib/supabase/server";
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
    league_members: { count: number }[];
  } | null;
};

export default async function LeaguesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Leagues I'm a member of, with each league's total member count.
  const { data } = await supabase
    .from("league_members")
    .select("leagues(id, name, join_code, created_by, created_at, league_members(count))")
    .eq("user_id", user!.id)
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
      member_count: l.league_members?.[0]?.count ?? 0,
    }));

  return <LeaguesScreen leagues={leagues} />;
}
