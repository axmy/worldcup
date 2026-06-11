"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LeaderboardRow } from "@/lib/types";
import { Avatar, Empty, Icon, ScreenHead, fmtDeadline } from "@/components/ui";

const PLACE_COLOR: Record<number, string> = {
  1: "var(--accent)",
  2: "oklch(0.78 0.02 255)",
  3: "oklch(0.62 0.07 50)",
};

// Shared 6-column grid for the stats table (rank · player · MP · Ex · Out · Pts).
const STAT_ROW: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "26px 1fr 30px 30px 34px 44px",
  alignItems: "center",
  gap: 8,
  padding: "10px 13px",
};
const STAT_H: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--text-faint)",
};
const STAT_CELL: CSSProperties = {
  fontFamily: "var(--font-score)",
  fontWeight: 700,
  fontSize: 13.5,
  textAlign: "right",
  color: "var(--text-dim)",
};

export function LeaderboardScreen({
  board,
  meId,
  title = "Leaderboard",
  subtitle,
  header,
  rules,
  meRank,
  cappedAt,
}: {
  board: LeaderboardRow[];
  meId: string;
  title?: string;
  subtitle?: string;
  header?: ReactNode;
  // Per-league scoring + the platform deadline, shown as chips under the title.
  rules?: { exact: number; outcome: number; mode: "single" | "multiple"; deadlineType: string; deadlineValue: string };
  // The viewer's own standing — used to pin their row when they rank below the
  // rendered top-N (large global boards are capped for performance).
  meRank?: { rank: number; total_points: number; scored_matches: number; exact_hits: number; outcome_hits: number };
  cappedAt?: number;
}) {
  const top3 = board.slice(0, 3);
  const myIdx = board.findIndex((u) => u.user_id === meId);
  const myRank = myIdx + 1;
  // When the board is capped and the viewer isn't in it, show their real rank.
  const meOutsideList = !!meRank && myIdx === -1;

  return (
    <div className="screen-enter">
      {header}
      <ScreenHead title={title} sub={subtitle ?? `${board.length} player${board.length === 1 ? "" : "s"}`} />

      {rules && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, margin: "-4px 0 18px" }}>
          {[
            ["bolt", `${rules.exact} pt${rules.exact === 1 ? "" : "s"} exact · ${rules.outcome} result`],
            ["lock", rules.mode === "single" ? "One pick — no edits" : "Editable until deadline"],
            ["clock", fmtDeadline(rules.deadlineType, rules.deadlineValue)],
          ].map(([icon, text]) => (
            <span key={text} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-dim)", background: "var(--bg-3)", border: "1px solid var(--line-soft)", borderRadius: 7, padding: "4px 9px", whiteSpace: "nowrap" }}>
              <Icon name={icon} size={12.5} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
              {text}
            </span>
          ))}
        </div>
      )}

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

      {/* ranked stats table (rank · player · MP · exact · outcome · pts) */}
      {board.length > 0 && (
        <div className="card-sport" style={{ overflow: "hidden" }}>
          <div style={STAT_ROW} aria-hidden>
            <span style={{ ...STAT_H, textAlign: "center" }}>#</span>
            <span style={STAT_H}>Player</span>
            <span style={{ ...STAT_H, textAlign: "right" }} title="Matches played">MP</span>
            <span style={{ ...STAT_H, textAlign: "right" }} title="Exact scorelines">Ex</span>
            <span style={{ ...STAT_H, textAlign: "right" }} title="Correct result, wrong score">Out</span>
            <span style={{ ...STAT_H, textAlign: "right", color: "var(--text-dim)" }}>Pts</span>
          </div>
          {board.map((u, i) => {
            const rank = i + 1;
            const isMe = u.user_id === meId;
            return (
              <div
                key={u.user_id}
                className="row-hover"
                style={{
                  ...STAT_ROW,
                  borderTop: "1px solid var(--line-soft)",
                  background: isMe ? "color-mix(in oklab, var(--accent) 12%, transparent)" : "transparent",
                }}
              >
                <span className="num" style={{ fontWeight: 800, fontSize: 14, textAlign: "center", color: rank <= 3 ? PLACE_COLOR[rank] : isMe ? "var(--accent)" : "var(--text-faint)" }}>{rank}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  <Avatar name={u.display_name} size={26} isMe={isMe} />
                  <span className="display" style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {u.display_name}{isMe && <span style={{ color: "var(--accent)" }}> · you</span>}
                  </span>
                </div>
                <span style={STAT_CELL}>{u.scored_matches}</span>
                <span style={{ ...STAT_CELL, color: "var(--accent)" }}>{u.exact_hits}</span>
                <span style={STAT_CELL}>{u.outcome_hits}</span>
                <span className="num" style={{ fontWeight: 800, fontSize: 16, textAlign: "right", color: isMe ? "var(--accent)" : "var(--text)" }}>{u.total_points}</span>
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
            ...STAT_ROW,
            marginTop: 14,
            border: "1px solid color-mix(in oklab, var(--accent) 45%, transparent)",
            background: "color-mix(in oklab, var(--accent) 12%, transparent)",
          }}
        >
          <span className="num" style={{ fontWeight: 800, fontSize: 14, textAlign: "center", color: "var(--accent)" }}>{meRank.rank}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
            <Avatar name="You" size={26} isMe />
            <span className="display" style={{ fontSize: 13.5, fontWeight: 700 }}>You</span>
          </div>
          <span style={STAT_CELL}>{meRank.scored_matches}</span>
          <span style={{ ...STAT_CELL, color: "var(--accent)" }}>{meRank.exact_hits}</span>
          <span style={STAT_CELL}>{meRank.outcome_hits}</span>
          <span className="num" style={{ fontWeight: 800, fontSize: 16, textAlign: "right", color: "var(--accent)" }}>{meRank.total_points}</span>
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
