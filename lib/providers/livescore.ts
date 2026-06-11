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

function competition() {
  return (process.env.LIVESCORE_COMPETITION || "World Cup 2026").toLowerCase();
}

export type ProviderFixture = {
  external_ref: string;
  home_team: string;
  away_team: string;
  kickoff_time: string; // ISO
};

export type ProviderResult = {
  external_ref: string;
  home_team: string;
  away_team: string;
  kickoff_time: string; // ISO
  status: string;
  final: boolean;
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
    for (const e of stage.Events ?? []) {
      const home = e.T1?.[0]?.Nm;
      const away = e.T2?.[0]?.Nm;
      if (!home || !away || e.Eid == null) continue;
      const status = e.Eps ?? "";
      out.push({
        external_ref: String(e.Eid),
        home_team: home,
        away_team: away,
        kickoff_time: esdToIso(e.Esd),
        status,
        final: FINAL_STATUSES.has(status),
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
    });
  }
  return [...byId.values()];
}
