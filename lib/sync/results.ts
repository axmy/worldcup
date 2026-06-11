import { updateTag, revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchResultsForDates, type ProviderResult } from "@/lib/providers/livescore";

export type SyncSummary = { candidates: number; updated: number; calledProvider: boolean };

type Candidate = {
  id: string;
  external_ref: string | null;
  home_team: string;
  away_team: string;
  kickoff_time: string;
};

// Team-name aliases: our seed (from livescore screenshots) vs the live feed.
// Keys/values are compared after normalize(); extend as mismatches surface.
const ALIASES: Record<string, string> = {
  turkey: "turkiye",
  "korea republic": "south korea",
  "ir iran": "iran",
  "united states": "usa",
  "usmnt": "usa",
  czechia: "czech republic",
};

// Lowercase, strip accents/punctuation, collapse spaces, then apply aliases.
function normalize(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ALIASES[base] ?? base;
}

// UTC date key (YYYYMMDD) for matching an event to a match on the same day.
function utcDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

function pairKey(home: string, away: string, dateKey: string): string {
  return `${normalize(home)}|${normalize(away)}|${dateKey}`;
}

// Auto-fetch final scores for matches that have kicked off but have no result
// yet. We match a live event to our match by its provider id (external_ref) when
// we already have one, otherwise by team-names + kickoff date — then backfill the
// id so future syncs are id-based. Writing the score fires the DB scoring
// trigger, which scores every prediction per its league's rules. Uses the
// service-role client (no admin session). Makes NO provider call when nothing is
// in play (saves bandwidth / avoids hammering the feed).
export async function syncResults(): Promise<SyncSummary> {
  const supabase = createAdminClient();

  // Started, not-yet-scored matches (seeded rows have no external_ref yet).
  const { data, error } = await supabase
    .from("matches")
    .select("id, external_ref, home_team, away_team, kickoff_time")
    .is("home_score", null)
    .lt("kickoff_time", new Date().toISOString());
  if (error) throw new Error(error.message);

  const candidates = (data as Candidate[] | null) ?? [];
  if (candidates.length === 0) {
    return { candidates: 0, updated: 0, calledProvider: false };
  }

  // Fetch only the dates we actually need.
  const dates = candidates.map((c) => utcDateKey(c.kickoff_time));
  const events = await fetchResultsForDates(dates);

  const byRef = new Map<string, ProviderResult>();
  const byPair = new Map<string, ProviderResult>();
  for (const e of events) {
    byRef.set(e.external_ref, e);
    byPair.set(pairKey(e.home_team, e.away_team, utcDateKey(e.kickoff_time)), e);
  }

  let updated = 0;
  for (const c of candidates) {
    const ev =
      (c.external_ref ? byRef.get(c.external_ref) : undefined) ??
      byPair.get(pairKey(c.home_team, c.away_team, utcDateKey(c.kickoff_time)));
    if (!ev || !ev.final || ev.home == null || ev.away == null) continue;

    const patch: Record<string, unknown> = {
      home_score: ev.home,
      away_score: ev.away,
      synced_at: new Date().toISOString(),
    };
    // Backfill the provider id on first match so later syncs match by id.
    if (!c.external_ref) {
      patch.external_ref = ev.external_ref;
      patch.provider = "livescore";
    }
    const { error: upErr } = await supabase.from("matches").update(patch).eq("id", c.id);
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
