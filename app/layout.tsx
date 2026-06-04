import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { Inter, Saira_Condensed } from "next/font/google";
import "./globals.css";
import { Chrome } from "@/components/Chrome";
import { createClient } from "@/lib/supabase/server";
import { getSettingsCached } from "@/lib/data";

// Clean, modern sans for all UI + headings.
const fontBody = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body-next",
});
// Condensed face reserved for big score numerals only.
const fontScore = Saira_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-score-next",
});

// Title + social preview follow the configured brand name (white-label). The
// opengraph-image / twitter-image files supply the preview image automatically;
// metadataBase makes that image URL absolute for crawlers.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettingsCached();
  const name = settings?.brand_name ?? "Kickoff";
  const title = `${name} — World Cup 2026 Score Predictor`;
  const description =
    "Predict every match of the World Cup 2026, create private leagues with friends, and climb the global leaderboard.";
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  return {
    metadataBase: base ? new URL(base) : null,
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: name,
      type: "website",
      ...(base ? { url: base } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Fetch the signed-in user's chrome data (name, admin flag, points) once for
  // the header/nav. Null on the auth screens, which Chrome renders full-bleed.
  const supabase = await createClient();
  const [{ data: claimsData }, brand] = await Promise.all([
    supabase.auth.getClaims(),
    getSettingsCached(),
  ]);
  const claims = claimsData?.claims as { sub?: string; email?: string } | undefined;
  const userId = claims?.sub ?? null;
  const email = claims?.email ?? null;

  // Theme: a per-user choice (cookie set from the account menu) overrides the
  // admin's global default. Read server-side so <html data-theme> is correct on
  // first paint — no flash, no hydration mismatch.
  const themePref = (await cookies()).get("theme_pref")?.value;
  const theme: "dark" | "light" =
    themePref === "light" || themePref === "dark"
      ? themePref
      : brand?.theme === "light"
        ? "light"
        : "dark";
  const accent = brand?.accent ?? "oklch(0.58 0.21 264)";

  let displayName: string | null = null;
  let isAdmin = false;
  let points = 0;
  if (userId) {
    let { data: profile } = await supabase
      .from("profiles")
      .select("display_name, is_admin")
      .eq("id", userId)
      .single();
    // Self-heal: a signed-in user with no profile was orphaned at signup (DB
    // trigger didn't fire). Create the profile + global membership, then re-read.
    if (!profile) {
      await supabase.rpc("ensure_self");
      ({ data: profile } = await supabase
        .from("profiles")
        .select("display_name, is_admin")
        .eq("id", userId)
        .single());
    }
    const { data: board } = await supabase
      .from("leaderboard")
      .select("total_points")
      .eq("user_id", userId)
      .single();
    displayName = profile?.display_name ?? null;
    isAdmin = !!profile?.is_admin;
    points = board?.total_points ?? 0;
  }

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${fontBody.variable} ${fontScore.variable} antialiased`}
      style={
        {
          // Per-client accent; white ink reads cleanly on the medium/dark accent
          // palette (admin swatches are curated to work with white text).
          "--accent": accent,
          "--accent-ink": "#ffffff",
        } as CSSProperties
      }
    >
      <body>
        <Chrome
          signedIn={!!userId}
          displayName={displayName}
          email={email}
          isAdmin={isAdmin}
          points={points}
          theme={theme}
          brandName={brand?.brand_name ?? "Kickoff"}
          brandTagline={brand?.brand_tagline ?? "WC26 · Predictor"}
        >
          {children}
        </Chrome>
      </body>
    </html>
  );
}
