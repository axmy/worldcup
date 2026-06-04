"use client";

import { useRouter, usePathname } from "next/navigation";
import { Icon } from "@/components/ui";

export type LeagueOption = {
  id: string;
  name: string;
  is_global?: boolean;
  points_exact?: number;
  points_outcome?: number;
  submission_mode?: "single" | "multiple";
};

// Picks the league you're predicting in. Selecting one navigates to
// ?league=<id>; the server re-fetches that league's picks for this user.
export function LeagueSwitcher({ leagues, activeId }: { leagues: LeagueOption[]; activeId: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--bg-2)",
        border: "1px solid var(--line-soft)",
        borderRadius: 14,
        padding: "10px 12px",
        marginBottom: 18,
        boxShadow: "var(--shadow)",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: "color-mix(in oklab, var(--accent) 18%, var(--bg-3))",
          color: "var(--accent)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="trophy" size={18} stroke={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="display" style={{ fontSize: 10.5, letterSpacing: ".12em", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>
          Predicting in
        </div>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <select
            value={activeId}
            onChange={(e) => router.push(`${pathname}?league=${e.target.value}`)}
            aria-label="Select league"
            style={{
              appearance: "none",
              WebkitAppearance: "none",
              background: "transparent",
              border: "none",
              color: "var(--text)",
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 17,
              padding: "1px 22px 1px 0",
              width: "100%",
              cursor: "pointer",
              colorScheme: "dark",
            }}
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <Icon name="chevD" size={16} style={{ position: "absolute", right: 0, color: "var(--text-faint)", pointerEvents: "none" }} />
        </div>
      </div>
    </div>
  );
}
