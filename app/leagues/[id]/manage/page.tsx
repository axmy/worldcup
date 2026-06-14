import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";
import { ManageLeagueScreen, type ManageLeague, type ManageMember, type MemberPick } from "@/components/ManageLeagueScreen";
import type { LeaderboardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type MemberRow = { user_id: string; profiles: { display_name: string } | null };

export default async function ManageLeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const userId = (await getUserId(supabase))!;

  // RLS returns the league only to members/admins; managing requires ownership.
  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, join_code, created_by, is_global, points_exact, points_outcome, submission_mode, prizes")
    .eq("id", id)
    .single();

  if (!league) redirect("/leagues");

  // Only the owner (or a super-admin) may manage; everyone else goes to standings.
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", userId).single();
  const isOwner = league.created_by === userId || !!profile?.is_admin;
  if (!isOwner) redirect(`/leagues/${id}`);

  const [{ data: memberRows }, { data: standings }, { data: pickRows }] = await Promise.all([
    supabase.from("league_members").select("user_id, profiles(display_name)").eq("league_id", id),
    supabase.rpc("league_standings", { p_league_id: id }),
    supabase.rpc("league_member_picks", { p_league_id: id }),
  ]);

  // Each participant's points in THIS league, so the organizer sees how they're doing.
  const points: Record<string, number> = {};
  ((standings as LeaderboardRow[] | null) ?? []).forEach((r) => {
    points[r.user_id] = r.total_points;
  });

  const members: ManageMember[] = ((memberRows as MemberRow[] | null) ?? []).map((m) => ({
    user_id: m.user_id,
    display_name: m.profiles?.display_name ?? "Player",
    points: points[m.user_id] ?? 0,
  }));
  // Owner first, then by points (high → low), then alphabetical.
  members.sort((a, b) =>
    Number(b.user_id === league.created_by) - Number(a.user_id === league.created_by) ||
    b.points - a.points ||
    a.display_name.localeCompare(b.display_name),
  );

  const picks = ((pickRows as MemberPick[] | null) ?? []);

  const shareUrl = await getSiteUrl();

  return <ManageLeagueScreen league={league as ManageLeague} members={members} picks={picks} shareUrl={shareUrl} />;
}
