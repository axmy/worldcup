"use client";

import { useState, type ReactNode } from "react";
import { HowToPlay, type HowToInfo } from "@/components/HowToPlay";

// Wraps a leaderboard with a [Leaderboard | How to play] tab switch. An optional
// `header` (e.g. a league's back/manage bar) stays pinned above both tabs.
export function LeaderboardTabs({
  board,
  info,
  header,
  scope = "global",
}: {
  board: ReactNode;
  info: HowToInfo;
  header?: ReactNode;
  scope?: "global" | "league";
}) {
  const [tab, setTab] = useState<"board" | "howto">("board");

  return (
    <div className="screen-enter">
      {header}
      <div style={{ display: "flex", gap: 6, padding: 5, background: "var(--bg-3)", borderRadius: 13, marginBottom: 16 }}>
        {([
          ["board", "Leaderboard"],
          ["howto", "How to play"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className="tap"
            onClick={() => setTab(k)}
            style={{
              flex: 1,
              padding: "10px 6px",
              borderRadius: 9,
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: ".03em",
              textTransform: "uppercase",
              background: tab === k ? "var(--grad-accent)" : "transparent",
              color: tab === k ? "var(--accent-ink)" : "var(--text-dim)",
              boxShadow: tab === k ? "var(--glow-accent)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "board" ? board : <HowToPlay info={info} scope={scope} />}
    </div>
  );
}
