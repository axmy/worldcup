import { updateTag, revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchResults } from "@/lib/providers/apiFootball";

export type SyncSummary = { candidates: number; updated: number; calledProvider: boolean };

type Candidate = { id: string; external_ref: string };

// Auto-fetch final scores for matches that have kicked off but have no result
// yet. Writing the score fires the DB scoring trigger, which scores every
// prediction per its league's rules; standings recompute on read. Uses the
// service-role client so it works unattended (no admin session). Returns a
// summary; makes NO provider call when nothing is in play (saves API quota).
export async function syncResults(): Promise<SyncSummary> {
  const supabase = createAdminClient();

  // Started, not-yet-final, mapped fixtures.
  const { data, error } = await supabase
    .from("matches")
    .select("id, external_ref")
    .not("external_ref", "is", null)
    .is("home_score", null)
    .lt("kickoff_time", new Date().toISOString());
  if (error) throw new Error(error.message);

  const candidates = (data as Candidate[] | null) ?? [];
  if (candidates.length === 0) {
    return { candidates: 0, updated: 0, calledProvider: false };
  }

  const byRef = new Map(candidates.map((c) => [c.external_ref, c.id]));
  const results = await fetchResults([...byRef.keys()]);

  let updated = 0;
  for (const r of results) {
    if (!r.final || r.home == null || r.away == null) continue;
    const id = byRef.get(r.external_ref);
    if (!id) continue;
    const { error: upErr } = await supabase
      .from("matches")
      .update({ home_score: r.home, away_score: r.away, synced_at: new Date().toISOString() })
      .eq("id", id);
    if (upErr) throw new Error(upErr.message);
    updated++;
  }

  if (updated > 0) {
    updateTag("matches");
    revalidatePath("/leaderboard");
    revalidatePath("/matches");
    revalidatePath("/picks");
    revalidatePath("/admin");
  }

  return { candidates: candidates.length, updated, calledProvider: true };
}
