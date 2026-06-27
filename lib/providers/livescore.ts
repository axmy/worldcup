// Livescore adapter — free, key-less public JSON feed used to auto-update final
// scores. Server-only. Swap this file to change providers.
//
// The feed is per calendar date (UTC, the `/0` timezone segment):
//   GET https://prod-public-api.livescore.com/v1/api/app/date/soccer/<YYYYMMDD>/0?MD=1
//   → { Stages: [ { Cnm: "World Cup 2026", Snm: "Group A", Events: [ … ] } ] }
// Each Event: Eid (match id), T1/T2 (teams), Tr1/Tr2 (score), Eps (status),
//   Esd (kickoff, UTC, as the integer YYYYMMDDHHMMSS).
//
// Optional env:
//   LIVESCORE_COMPETITION  – competition name to match (default "World Cup 2026")
//   LIVESCORE_START / LIVESCORE_END  – ISO dates bounding fetchSchedule()

const BASE = "https://prod-public-api.livescore.com/v1/api/app/date/soccer";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

// Livescore status strings that mean the match is over.
const FINAL_STATUSES = new Set(["FT", "AET", "AP", "AWD", "WO"]);

// In-play statuses where the clock is paused (half-time, extra-time break,
// penalty shoot-out) — no minute string, but the match is live.
const PAUSED_STATUSES = new Set(["HT", "Break", "Pen."]);

// While in play, Eps is the match clock: "23'", "45+2'", … Stoppage time keeps
// the base minute ("45+2'" → 45 — still the first half). Null when not playing.
function parseMinute(status: string): number | null {
  const m = /^(\d+)(?:\+\d+)?'?$/.exec(status);
  return m ? Number(m[1]) : null;
}

function competition() {
  return (process.env.LIVESCORE_COMPETITION || "World Cup").toLowerCase();
}

// Tournament round, derived from the provider's stage name (Snm). "group" and
// "other" exist so the knockout sync can ignore anything that isn't a knockout.
export type Round = "r32" | "r16" | "qf" | "sf" | "third" | "final" | "group" | "other";

// Classify a Livescore stage name into a round. Livescore uses short codes
// ("R32", "R16", "QF", "SF", "Final", "Third Place Play-Off"); long forms are
// also matched for safety. Order matters: "semi"/"quarter" and "third place"
// are checked before the plain "final" so they aren't swallowed by it.
export function classifyRound(snm: string): Round {
  const s = snm.toLowerCase();
  if (/\br32\b|round of 32|last 32|1\/16/.test(s)) return "r32";
  if (/\br16\b|round of 16|last 16|1\/8/.test(s)) return "r16";
  if (/\bqf\b|quarter|1\/4/.test(s)) return "qf";
  if (/\bsf\b|semi|1\/2/.test(s)) return "sf";
  if (/third|3rd|play[-\s]?off/.test(s)) return "third";
  if (/final/.test(s)) return "final";
  if (/group/.test(s)) return "group";
  return "other";
}

export type ProviderFixture = {
  external_ref: string;
  home_team: string;
  away_team: string;
  kickoff_time: string; // ISO
  round: Round;
};

export type ProviderResult = {
  external_ref: string;
  home_team: string;
  away_team: string;
  kickoff_time: string; // ISO
  round: Round;
  status: string;
  final: boolean;
  // Kicked off and not yet finished (running clock or a paused-clock status).
  inPlay: boolean;
  // Minutes on the clock while in play, else null.
  minute: number | null;
  home: number | null;
  away: number | null;
};

type LsTeam = { Nm?: string };
type LsEvent = {
  Eid?: string | number;
  T1?: LsTeam[];
  T2?: LsTeam[];
  Tr1?: string | null;
  Tr2?: string | null;
  Eps?: string;
  Esd?: number; // YYYYMMDDHHMMSS, UTC
};
type LsStage = { Cnm?: string; Snm?: string; Events?: LsEvent[] };

// "20260611190000" → "2026-06-11T19:00:00Z"
function esdToIso(esd: number | undefined): string {
  const s = String(esd ?? "");
  if (s.length < 14) return new Date(0).toISOString();
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
}

function toScore(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Fetch one UTC date and return that day's matches for the configured competition.
async function fetchDate(yyyymmdd: string): Promise<ProviderResult[]> {
  const res = await fetch(`${BASE}/${yyyymmdd}/0?MD=1`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    // Include a short body snippet — datacenter IPs often get an HTML 403/429
    // bot-block page, and seeing it makes the cause obvious in the logs.
    const snippet = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
    throw new Error(`Livescore ${res.status} for ${yyyymmdd}${snippet ? `: ${snippet}` : ""}`);
  }
  const json = (await res.json()) as { Stages?: LsStage[] };
  const comp = competition();
  const out: ProviderResult[] = [];
  for (const stage of json.Stages ?? []) {
    if (!String(stage.Cnm ?? "").toLowerCase().includes(comp)) continue;
    const round = classifyRound(stage.Snm ?? "");
    for (const e of stage.Events ?? []) {
      const home = e.T1?.[0]?.Nm;
      const away = e.T2?.[0]?.Nm;
      if (!home || !away || e.Eid == null) continue;
      const status = e.Eps ?? "";
      const minute = parseMinute(status);
      out.push({
        external_ref: String(e.Eid),
        home_team: home,
        away_team: away,
        kickoff_time: esdToIso(e.Esd),
        round,
        status,
        final: FINAL_STATUSES.has(status),
        inPlay: !FINAL_STATUSES.has(status) && (minute !== null || PAUSED_STATUSES.has(status)),
        minute,
        home: toScore(e.Tr1),
        away: toScore(e.Tr2),
      });
    }
  }
  return out;
}

export type FetchError = { date: string; message: string };
export type FetchResults = { results: ProviderResult[]; errors: FetchError[] };

/** Results for the given UTC dates (YYYYMMDD). Used by the sync engine.
 * A failed date is collected into `errors` rather than rejecting the whole
 * batch — one bad/blocked date shouldn't drop the scores from every other day. */
export async function fetchResultsForDates(dates: string[]): Promise<FetchResults> {
  const unique = [...new Set(dates)].filter(Boolean);
  const settled = await Promise.allSettled(unique.map((d) => fetchDate(d)));
  const results: ProviderResult[] = [];
  const errors: FetchError[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") results.push(...s.value);
    else errors.push({ date: unique[i], message: s.reason instanceof Error ? s.reason.message : String(s.reason) });
  });
  return { results, errors };
}

/** Full schedule across the tournament date range — for the admin import action. */
export async function fetchSchedule(): Promise<ProviderFixture[]> {
  const start = new Date(`${process.env.LIVESCORE_START || "2026-06-11"}T00:00:00Z`);
  const end = new Date(`${process.env.LIVESCORE_END || "2026-07-19"}T00:00:00Z`);
  const dates: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const d = new Date(t);
    dates.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`);
  }
  const { results: all } = await fetchResultsForDates(dates);
  // Dedupe by match id (a match only appears on its own date, but be safe).
  const byId = new Map<string, ProviderFixture>();
  for (const r of all) {
    byId.set(r.external_ref, {
      external_ref: r.external_ref,
      home_team: r.home_team,
      away_team: r.away_team,
      kickoff_time: r.kickoff_time,
      round: r.round,
    });
  }
  return [...byId.values()];
}
