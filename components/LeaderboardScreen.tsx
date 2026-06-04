"use client";

import type { ReactNode } from "react";
import type { LeaderboardRow } from "@/lib/types";
import { Avatar, Empty, Icon, ScreenHead } from "@/components/ui";

const PLACE_COLOR: Record<number, string> = {
  1: "var(--accent)",
  2: "oklch(0.78 0.02 255)",
  3: "oklch(0.62 0.07 50)",
};

export function LeaderboardScreen({
  board,
  meId,
  title = "Leaderboard",
  subtitle,
  header,
  meRank,
  cappedAt,
}: {
  board: LeaderboardRow[];
  meId: string;
  title?: string;
  subtitle?: string;
  header?: ReactNode;
  // The viewer's own standing — used to pin their row when they rank below the
  // rendered top-N (large global boards are capped for performance).
  meRank?: { rank: number; total_points: number; scored_matches: number; exact_hits: number };
  cappedAt?: number;
}) {
  const top3 = board.slice(0, 3);
  const rest = board.slice(3);
  const myIdx = board.findIndex((u) => u.user_id === meId);
  const myRank = myIdx + 1;
  // When the board is capped and the viewer isn't in it, show their real rank.
  const meOutsideList = !!meRank && myIdx === -1;

  return (
    <div className="screen-enter">
      {header}
      <ScreenHead title={title} sub={subtitle ?? `${board.length} player${board.length === 1 ? "" : "s"}`} />

      {board.length === 0 && <Empty icon="trophy" text="No scores yet — predictions are still rolling in." />}

      {/* podium */}
      {top3.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 1fr", alignItems: "end", gap: 8, marginBottom: 8 }}>
          {[top3[1], top3[0], top3[2]].map((u, i) => {
            if (!u) return <div key={i} />;
            const place = u === top3[0] ? 1 : u === top3[1] ? 2 : 3;
            const h = place === 1 ? 96 : place === 2 ? 72 : 58;
            const isMe = u.user_id === meId;
            return (
              <div key={u.user_id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                {place === 1 && <Icon name="trophy" size={22} style={{ color: "var(--accent)", marginBottom: 4 }} />}
                <Avatar name={u.display_name} size={place === 1 ? 60 : 50} isMe={isMe} />
                <div className="display" style={{ fontSize: 13, fontWeight: 700, marginTop: 7, textAlign: "center", maxWidth: 88, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.display_name}
                </div>
                <div className="h-hero num" style={{ fontSize: 21, color: "var(--accent)" }}>{u.total_points}</div>
                <div
                  style={{
                    width: "100%",
                    height: h,
                    marginTop: 6,
                    borderRadius: "12px 12px 0 0",
                    background: `linear-gradient(180deg, color-mix(in oklab, ${PLACE_COLOR[place]} 42%, var(--bg-2)), var(--bg-2))`,
                    border: "1px solid",
                    borderColor: place === 1 ? "color-mix(in oklab, var(--accent) 50%, transparent)" : "var(--line-soft)",
                    borderBottom: "none",
                    boxShadow: place === 1 ? "var(--glow-accent)" : "none",
                    display: "grid",
                    placeItems: "start center",
                    paddingTop: 8,
                  }}
                >
                  <span className="h-hero num" style={{ fontSize: 26, color: PLACE_COLOR[place] }}>{place}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ranked list */}
      {rest.length > 0 && (
        <div className="card-sport" style={{ overflow: "hidden" }}>
          {rest.map((u, i) => {
            const rank = i + 4;
            const isMe = u.user_id === meId;
            return (
              <div
                key={u.user_id}
                className="row-hover"
                style={{
                  display: "grid",
                  gridTemplateColumns: "34px 1fr auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 15px",
                  borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
                  background: isMe ? "color-mix(in oklab, var(--accent) 12%, transparent)" : "transparent",
                }}
              >
                <span className="display num" style={{ fontSize: 16, fontWeight: 800, color: isMe ? "var(--accent)" : "var(--text-faint)", textAlign: "center" }}>{rank}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <Avatar name={u.display_name} size={34} isMe={isMe} />
                  <div style={{ minWidth: 0 }}>
                    <div className="display" style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {u.display_name}
                      {isMe && <span style={{ color: "var(--accent)", fontWeight: 700 }}> · you</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                      {u.exact_hits} exact · {u.scored_matches} scored
                    </div>
                  </div>
                </div>
                <span className="display num" style={{ fontSize: 19, fontWeight: 800, color: isMe ? "var(--accent)" : "var(--text)" }}>{u.total_points}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Your own row, pinned when you rank below the rendered top-N. */}
      {meOutsideList && meRank && (
        <div
          className="card-sport"
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "44px 1fr auto",
            alignItems: "center",
            gap: 12,
            padding: "12px 15px",
            border: "1px solid color-mix(in oklab, var(--accent) 45%, transparent)",
            background: "color-mix(in oklab, var(--accent) 12%, transparent)",
          }}
        >
          <span className="display num" style={{ fontSize: 16, fontWeight: 800, color: "var(--accent)", textAlign: "center" }}>#{meRank.rank}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <Avatar name="You" size={34} isMe />
            <div style={{ minWidth: 0 }}>
              <div className="display" style={{ fontSize: 15, fontWeight: 700 }}>You</div>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{meRank.exact_hits} exact · {meRank.scored_matches} scored</div>
            </div>
          </div>
          <span className="display num" style={{ fontSize: 19, fontWeight: 800, color: "var(--accent)" }}>{meRank.total_points}</span>
        </div>
      )}

      {cappedAt && board.length >= cappedAt && (
        <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--text-faint)", marginTop: 14 }}>
          Showing the top {cappedAt.toLocaleString()}.
        </p>
      )}

      {myRank > 3 && top3[2] && (
        <div
          style={{
            marginTop: 14,
            padding: "11px 15px",
            borderRadius: 14,
            background: "var(--bg-3)",
            border: "1px dashed var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--text-dim)",
          }}
        >
          <Icon name="bolt" size={15} style={{ color: "var(--accent)" }} /> You&apos;re{" "}
          <b style={{ color: "var(--text)" }}>#{myRank}</b> — {Math.max(0, top3[2].total_points - board[myIdx].total_points)} pts from the podium
        </div>
      )}
    </div>
  );
}
