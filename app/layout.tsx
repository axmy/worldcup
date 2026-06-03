import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { Saira, Saira_Condensed } from "next/font/google";
import "./globals.css";
import { Chrome } from "@/components/Chrome";
import { createClient } from "@/lib/supabase/server";
import { getSettingsCached } from "@/lib/data";

const sairaBody = Saira({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-next",
});
const sairaDisplay = Saira_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-display-next",
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
  const accent = brand?.accent ?? "oklch(0.87 0.2 128)";

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
      className={`${sairaBody.variable} ${sairaDisplay.variable} antialiased`}
      style={
        {
          // Per-client accent; --accent-ink is derived for readable text on the accent.
          "--accent": accent,
          "--accent-ink": `color-mix(in oklab, ${accent} 32%, #050d06)`,
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
