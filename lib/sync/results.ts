import { revalidateTag, revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchResultsForDates, type ProviderResult, type FetchError } from "@/lib/providers/livescore";

export type SyncSummary = {
  candidates: number;
  updated: number;
  // Matches that got an in-play update this run (live score and/or a
  // deadline re-anchored to real minutes played).
  liveUpdated: number;
  calledProvider: boolean;
  // Per-date upstream failures (e.g. a datacenter-IP bot-block). Non-fatal:
  // other dates still sync. Surfaced so the cron log shows the real cause.
  providerErrors: FetchError[];
};

type Candidate = {
  id: string;
  external_ref: string | null;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  deadline_type: string;
  deadline_value: string;
  submission_deadline: string;
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

// Re-anchor a 'minutes_after_kickoff' deadline to the real match clock. The
// trigger-computed deadline assumes kickoff happened exactly on schedule; the
// feed tells us the truth, so:
//   • still "NS" past scheduled kickoff (delayed) → push the window out
//   • clock at minute m < N                       → deadline lands in N−m min
//   • clock at/past N, or half-time reached       → close now
// Returns the new deadline ISO string, or null to leave it alone. Writing
// submission_deadline directly is safe — trg_compute_deadline only fires on
// kickoff_time/deadline_type/deadline_value changes — and RLS reads it live,
// so submissions lock/extend server-side with no further plumbing.
function liveDeadline(c: Candidate, ev: ProviderResult): string | null {
  if (c.deadline_type !== "minutes_after_kickoff") return null;
  const n = Number(c.deadline_value);
  if (!Number.isFinite(n)) return null;
  const nowMs = Date.now();

  if (ev.status === "NS") return new Date(nowMs + n * 60000).toISOString();

  // Paused-clock statuses (HT/Break/Pen.) have no minute but mean the first
  // half is over — past the deadline whenever the policy is ≤ half-time.
  const closed = ev.minute !== null ? ev.minute >= n : ev.inPlay && n <= 45;
  if (closed) {
    // Lock now — unless the deadline already passed (don't keep rewriting it).
    return new Date(c.submission_deadline).getTime() > nowMs ? new Date(nowMs).toISOString() : null;
  }
  if (ev.minute === null) return null;
  return new Date(nowMs + (n - ev.minute) * 60000).toISOString();
}

// Auto-sync matches that have kicked off but have no result yet. We match a
// live event to our match by its provider id (external_ref) when we already
// have one, otherwise by team-names + kickoff date — then backfill the id so
// future syncs are id-based. While a match is in play we write the live score
// + clock (display-only live_* columns) and re-anchor a minutes-after-kickoff
// deadline to real minutes played; once final we write home/away_score, which
// fires the DB scoring trigger. Uses the service-role client (no admin
// session). Makes NO provider call when nothing is in play (saves bandwidth /
// avoids hammering the feed).
export async function syncResults(): Promise<SyncSummary> {
  const supabase = createAdminClient();

  // Started, not-yet-scored matches (seeded rows have no external_ref yet).
  const { data, error } = await supabase
    .from("matches")
    .select("id, external_ref, home_team, away_team, kickoff_time, deadline_type, deadline_value, submission_deadline")
    .is("home_score", null)
    .lt("kickoff_time", new Date().toISOString());
  if (error) throw new Error(error.message);

  const candidates = (data as Candidate[] | null) ?? [];
  if (candidates.length === 0) {
    return { candidates: 0, updated: 0, liveUpdated: 0, calledProvider: false, providerErrors: [] };
  }

  // Fetch only the dates we actually need.
  const dates = candidates.map((c) => utcDateKey(c.kickoff_time));
  const { results: events, errors: providerErrors } = await fetchResultsForDates(dates);
  // Make upstream failures visible in Vercel logs (the cron itself stays green).
  if (providerErrors.length > 0) {
    console.error("[sync] livescore fetch errors:", JSON.stringify(providerErrors));
  }

  const byRef = new Map<string, ProviderResult>();
  const byPair = new Map<string, ProviderResult>();
  for (const e of events) {
    byRef.set(e.external_ref, e);
    byPair.set(pairKey(e.home_team, e.away_team, utcDateKey(e.kickoff_time)), e);
  }

  let updated = 0;
  let liveUpdated = 0;
  for (const c of candidates) {
    const ev =
      (c.external_ref ? byRef.get(c.external_ref) : undefined) ??
      byPair.get(pairKey(c.home_team, c.away_team, utcDateKey(c.kickoff_time)));
    if (!ev) continue;

    const patch: Record<string, unknown> = {};
    if (ev.final && ev.home != null && ev.away != null) {
      patch.home_score = ev.home; // fires the scoring trigger
      patch.away_score = ev.away;
      patch.live_status = ev.status;
      updated++;
    } else if (ev.inPlay) {
      patch.live_home_score = ev.home;
      patch.live_away_score = ev.away;
      patch.live_status = ev.status;
      liveUpdated++;
    }

    // Deadline tracks the real clock (delayed kickoff / half-time whistle).
    if (!ev.final) {
      const deadline = liveDeadline(c, ev);
      if (deadline) {
        patch.submission_deadline = deadline;
        if (!ev.inPlay) liveUpdated++; // "NS" extension with no live score yet
      }
    }

    if (Object.keys(patch).length === 0) continue;
    patch.synced_at = new Date().toISOString();
    // Backfill the provider id on first match so later syncs match by id.
    if (!c.external_ref) {
      patch.external_ref = ev.external_ref;
      patch.provider = "livescore";
    }
    const { error: upErr } = await supabase.from("matches").update(patch).eq("id", c.id);
    if (upErr) throw new Error(upErr.message);
  }

  if (updated > 0 || liveUpdated > 0) {
    // revalidateTag, not updateTag: this runs inside the cron Route Handler,
    // where updateTag throws (it's Server-Action-only). The admin server
    // action layers updateTag on top for read-your-own-writes.
    revalidateTag("matches", "max");
    revalidatePath("/matches");
    revalidatePath("/picks");
    revalidatePath("/admin");
    if (updated > 0) revalidatePath("/leaderboard");
  }

  return { candidates: candidates.length, updated, liveUpdated, calledProvider: true, providerErrors };
}
