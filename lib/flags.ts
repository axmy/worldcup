// ── Team → flag helpers ───────────────────────────────────────────────
// Teams are stored as free-text names, so we map a name to an ISO 3166-1
// alpha-2 country code, which drives both a full-bleed flag image (flagcdn)
// and, where needed, the matching Unicode flag emoji.
// Home-nation teams (England/Scotland/Wales/N. Ireland) have no alpha-2
// code, so they use flagcdn's GB subdivision codes ("gb-eng", "gb-sct", …).
//
// Lookups are normalised (lowercase, accent-stripped) and a set of common
// aliases is included so admin-entered variants ("USA", "Türkiye", "Korea
// Republic") all resolve. Unknown names return null → the UI falls back to
// the tinted code disc, keeping this white-label-safe for other tournaments.

const NAME_TO_CC: Record<string, string> = {
  // ── 2026 World Cup field ──
  mexico: "MX",
  "south africa": "ZA",
  "south korea": "KR",
  "korea republic": "KR",
  "czech republic": "CZ",
  czechia: "CZ",
  canada: "CA",
  "bosnia and herzegovina": "BA",
  bosnia: "BA",
  qatar: "QA",
  switzerland: "CH",
  brazil: "BR",
  morocco: "MA",
  haiti: "HT",
  scotland: "gb-sct",
  "united states": "US",
  usa: "US",
  "united states of america": "US",
  paraguay: "PY",
  australia: "AU",
  turkey: "TR",
  "türkiye": "TR",
  turkiye: "TR",
  germany: "DE",
  "curaçao": "CW",
  curacao: "CW",
  "ivory coast": "CI",
  "côte d'ivoire": "CI",
  "cote d'ivoire": "CI",
  ecuador: "EC",
  netherlands: "NL",
  japan: "JP",
  sweden: "SE",
  tunisia: "TN",
  belgium: "BE",
  egypt: "EG",
  iran: "IR",
  "new zealand": "NZ",
  spain: "ES",
  "cape verde": "CV",
  "cabo verde": "CV",
  "saudi arabia": "SA",
  uruguay: "UY",
  france: "FR",
  senegal: "SN",
  iraq: "IQ",
  norway: "NO",
  argentina: "AR",
  algeria: "DZ",
  austria: "AT",
  jordan: "JO",
  portugal: "PT",
  "dr congo": "CD",
  "democratic republic of the congo": "CD",
  "congo dr": "CD",
  uzbekistan: "UZ",
  colombia: "CO",
  england: "gb-eng",
  croatia: "HR",
  ghana: "GH",
  panama: "PA",

  // ── Common extras (other fixtures / friendlies an admin might add) ──
  wales: "gb-wls",
  italy: "IT",
  poland: "PL",
  denmark: "DK",
  serbia: "RS",
  ukraine: "UA",
  nigeria: "NG",
  cameroon: "CM",
  peru: "PE",
  chile: "CL",
  greece: "GR",
  hungary: "HU",
  romania: "RO",
  "northern ireland": "gb-nir",
  "republic of ireland": "IE",
  ireland: "IE",
  russia: "RU",
  china: "CN",
};

function normalize(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFC");
}

/** ISO alpha-2 code (or GB subdivision code) for a team name, or null. */
export function countryCode(name: string): string | null {
  return NAME_TO_CC[normalize(name)] ?? null;
}

// Home-nation regional-tag emoji, keyed by their flagcdn subdivision code.
const SUBDIVISION_EMOJI: Record<string, string> = {
  "gb-eng": "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  "gb-sct": "🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  "gb-wls": "🏴\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}",
  "gb-nir": "🏴\u{E0067}\u{E0062}\u{E006E}\u{E0069}\u{E0072}\u{E007F}",
};

/** Turn a 2-letter ISO code into its regional-indicator flag emoji. */
function ccToEmoji(cc: string) {
  return cc
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/** Flag emoji for a team name, or null if we don't recognise it. */
export function flagEmoji(name: string): string | null {
  const v = NAME_TO_CC[normalize(name)];
  if (!v) return null;
  return SUBDIVISION_EMOJI[v] ?? ccToEmoji(v);
}

/**
 * Full-bleed flag image URL (flagcdn.com PNG) for a team name, or null.
 * `width` picks a flagcdn size bucket; request ~2× the display px for retina.
 */
export function flagUrl(name: string, width = 160): string | null {
  const v = NAME_TO_CC[normalize(name)];
  if (!v) return null;
  const buckets = [20, 40, 80, 160, 320, 640, 1280, 2560];
  const w = buckets.find((b) => b >= width) ?? 160;
  return `https://flagcdn.com/w${w}/${v.toLowerCase()}.png`;
}
