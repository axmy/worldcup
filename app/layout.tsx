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

// Title follows the configured brand name (white-label).
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettingsCached();
  const name = settings?.brand_name ?? "Kickoff";
  return {
    title: `${name} — Score Predictor`,
    description: "Predict the score of every match before the whistle blows.",
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
    const [{ data: profile }, { data: board }] = await Promise.all([
      supabase.from("profiles").select("display_name, is_admin").eq("id", userId).single(),
      supabase.from("leaderboard").select("total_points").eq("user_id", userId).single(),
    ]);
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
