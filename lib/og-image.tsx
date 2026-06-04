import { ImageResponse } from "next/og";
import { getSettingsCached } from "@/lib/data";

// Shared Open Graph / Twitter card image (1200×630) — a World Cup-themed,
// grass-green branded preview. Used by app/opengraph-image.tsx and
// app/twitter-image.tsx.
export const ogSize = { width: 1200, height: 630 };
export const ogAlt = "World Cup 2026 Score Predictor";
export const ogContentType = "image/png";

export async function renderOgImage() {
  let brand = "Kickoff";
  let tagline = "WC26 · Predictor";
  try {
    const s = await getSettingsCached();
    if (s?.brand_name) brand = s.brand_name;
    if (s?.brand_tagline) tagline = s.brand_tagline;
  } catch {
    /* fall back to defaults */
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "72px 80px",
          justifyContent: "space-between",
          color: "#ffffff",
          backgroundColor: "#07120c",
          backgroundImage:
            "radial-gradient(900px 600px at 12% -10%, rgba(74,222,128,0.55), transparent 60%), radial-gradient(900px 700px at 100% 110%, rgba(16,185,129,0.45), transparent 60%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 84,
              height: 84,
              borderRadius: 22,
              background: "linear-gradient(180deg, #86efac, #22c55e)",
              boxShadow: "0 10px 40px rgba(34,197,94,0.5)",
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#06120b" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 3 5 13h5l-1 8 8-10h-5l1-8Z" fill="#06120b" stroke="#06120b" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.02em" }}>{brand}</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.22em", color: "#a7f3c9", textTransform: "uppercase" }}>
              {tagline}
            </div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.03em", maxWidth: 980 }}>
            Predict the World Cup 2026
          </div>
          <div style={{ fontSize: 36, fontWeight: 500, color: "#d7f5e3", maxWidth: 940 }}>
            Call every scoreline, run your own league, and climb the global leaderboard.
          </div>
        </div>

        {/* Footer strip */}
        <div style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 28, fontWeight: 700, color: "#bdf0d1" }}>
          <span style={{ display: "flex" }}>USA · CANADA · MEXICO</span>
          <span style={{ display: "flex", color: "#6ee7a8" }}>•</span>
          <span style={{ display: "flex" }}>48 teams · 104 matches</span>
        </div>
      </div>
    ),
    { ...ogSize },
  );
}
