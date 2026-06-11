// API-Football (api-sports.io) adapter — the only place that knows the provider's
// shape. Swap this file to change providers. Server-only (uses the secret key).
//
// Required env:
//   API_FOOTBALL_KEY      – api-sports.io key (header x-apisports-key)
//   API_FOOTBALL_LEAGUE   – competition id (World Cup). VERIFY against the API.
//   API_FOOTBALL_SEASON   – season year, e.g. 2026
//
// Docs: GET https://v3.football.api-sports.io/fixtures?league=<id>&season=<year>

const BASE = "https://v3.football.api-sports.io";

// Statuses API-Football reports for a finished match.
const FINAL_STATUSES = new Set(["FT", "AET", "PEN"]);

export type ProviderFixture = {
  external_ref: string;
  home_team: string;
  away_team: string;
  kickoff_time: string; // ISO
};

export type ProviderResult = {
  external_ref: string;
  status: string;
  final: boolean;
  home: number | null;
  away: number | null;
};

type ApiFixture = {
  fixture: { id: number; date: string; status: { short: string } };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
};

function config() {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set.");
  const league = process.env.API_FOOTBALL_LEAGUE;
  const season = process.env.API_FOOTBALL_SEASON;
  if (!league || !season) throw new Error("API_FOOTBALL_LEAGUE / API_FOOTBALL_SEASON are not set.");
  return { key, league, season };
}

async function fetchFixtures(): Promise<ApiFixture[]> {
  const { key, league, season } = config();
  const res = await fetch(`${BASE}/fixtures?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`, {
    headers: { "x-apisports-key": key },
    // Always fetch fresh — scores change during match windows.
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API-Football request failed: ${res.status}`);
  const json = (await res.json()) as { response?: ApiFixture[]; errors?: unknown };
  // On a rejected request the API returns response:[] alongside a populated
  // `errors` (e.g. {"plan":"Free plans do not have access to this season"} or a
  // bad token). Surface it instead of silently treating it as "no fixtures".
  const errs = json.errors;
  const hasErr = Array.isArray(errs) ? errs.length > 0 : !!errs && Object.keys(errs).length > 0;
  if (hasErr) throw new Error(`API-Football error: ${JSON.stringify(errs)}`);
  if (!json.response) throw new Error("API-Football returned no fixtures.");
  return json.response;
}

/** Full competition schedule — used by the admin "Import fixtures" action. */
export async function fetchSchedule(): Promise<ProviderFixture[]> {
  const fixtures = await fetchFixtures();
  return fixtures.map((f) => ({
    external_ref: String(f.fixture.id),
    home_team: f.teams.home.name,
    away_team: f.teams.away.name,
    kickoff_time: new Date(f.fixture.date).toISOString(),
  }));
}

/** Current results/status for the given fixture ids — used by the sync engine. */
export async function fetchResults(refs: string[]): Promise<ProviderResult[]> {
  if (refs.length === 0) return [];
  const want = new Set(refs);
  const fixtures = await fetchFixtures();
  return fixtures
    .filter((f) => want.has(String(f.fixture.id)))
    .map((f) => ({
      external_ref: String(f.fixture.id),
      status: f.fixture.status.short,
      final: FINAL_STATUSES.has(f.fixture.status.short),
      home: f.goals.home,
      away: f.goals.away,
    }));
}
