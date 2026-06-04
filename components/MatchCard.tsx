"use client";

import type { Match } from "@/lib/types";
import {
  Countdown,
  Crest,
  Icon,
  PointsBadge,
  StatusPill,
  matchStatus,
  teamCode,
  teamColor,
  fmtKick,
  useNow,
  type MatchState,
} from "@/components/ui";

export type Pred = [number, number];

function scorePred(pred: Pred, result: Pred, exactPts: number, outcomePts: number) {
  if (pred[0] === result[0] && pred[1] === result[1]) return exactPts;
  const so = Math.sign(pred[0] - pred[1]);
  const sr = Math.sign(result[0] - result[1]);
  return so === sr ? outcomePts : 0;
}

function TeamSide({ name, align }: { name: string; align: "left" | "right" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "right" ? "flex-end" : "flex-start", gap: 8, minWidth: 0 }}>
      <Crest name={name} size={52} />
      <div style={{ textAlign: align, minWidth: 0, maxWidth: 110 }}>
        <div className="h-hero" style={{ fontSize: 22, lineHeight: 0.95 }}>{teamCode(name)}</div>
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 3, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
      </div>
    </div>
  );
}

function CenterCell({ match, status, pred }: { match: Match; status: MatchState; pred?: Pred }) {
  if (status === "final" && match.home_score !== null && match.away_score !== null) {
    return (
      <div style={{ textAlign: "center", padding: "0 4px" }}>
        <div className="score" style={{ fontSize: 42, lineHeight: 1, fontWeight: 700 }}>
          {match.home_score}
          <span style={{ color: "var(--text-faint)", margin: "0 5px", fontWeight: 600 }}>–</span>
          {match.away_score}
        </div>
        <div className="display" style={{ fontSize: 10, letterSpacing: ".12em", color: "var(--text-faint)", marginTop: 4, fontWeight: 600, textTransform: "uppercase" }}>Full time</div>
      </div>
    );
  }
  if (pred) {
    return (
      <div style={{ textAlign: "center", padding: "0 4px" }}>
        <div
          className="num"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 11px",
            borderRadius: 12,
            background: "color-mix(in oklab, var(--accent) 16%, transparent)",
            border: "1px solid color-mix(in oklab, var(--accent) 38%, transparent)",
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1,
            color: "var(--accent)",
            fontFamily: "var(--font-score)",
          }}
        >
          {pred[0]}
          <span style={{ opacity: 0.5 }}>–</span>
          {pred[1]}
        </div>
        <div className="display" style={{ fontSize: 9.5, letterSpacing: ".12em", color: "var(--text-faint)", marginTop: 5, fontWeight: 600, textTransform: "uppercase" }}>Your pick</div>
      </div>
    );
  }
  return (
    <div style={{ textAlign: "center", padding: "0 6px" }}>
      <div className="h-hero" style={{ fontSize: 26, color: "var(--text-faint)", letterSpacing: ".02em" }}>VS</div>
    </div>
  );
}

export function MatchCard({
  match,
  pred,
  exactPts,
  outcomePts,
  onOpen,
}: {
  match: Match;
  pred?: Pred;
  exactPts: number;
  outcomePts: number;
  onOpen: (m: Match) => void;
}) {
  // Pre-mount fallback: a moment before the window start (or deadline) so the
  // first render matches what the status will settle to, avoiding a flash.
  const fallbackNow = (match.submission_open
    ? new Date(match.submission_open).getTime()
    : new Date(match.submission_deadline).getTime()) - 1;
  const now = useNow(1000) ?? fallbackNow;
  const status = matchStatus(match, now);
  const pts = status === "final" && pred && match.home_score !== null && match.away_score !== null
    ? scorePred(pred, [match.home_score, match.away_score], exactPts, outcomePts)
    : null;
  const clickable = status !== "upcoming" && (status !== "final" || !!pred);
  const deadlineMs = new Date(match.submission_deadline).getTime();
  const openMs = match.submission_open ? new Date(match.submission_open).getTime() : 0;
  const kickoffMs = new Date(match.kickoff_time).getTime();
  const homeC = teamColor(match.home_team);
  const awayC = teamColor(match.away_team);

  return (
    <div
      className={`card-sport ${clickable ? "lift-sport tap" : ""}`}
      onClick={clickable ? () => onOpen(match) : undefined}
      style={{ cursor: clickable ? "pointer" : "default" }}
    >
      {/* team-colour edge tints */}
      <div aria-hidden style={{ position: "absolute", inset: "0 auto 0 0", width: "42%", background: `linear-gradient(90deg, color-mix(in oklab, ${homeC} 26%, transparent), transparent)`, pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", inset: "0 0 0 auto", width: "42%", background: `linear-gradient(270deg, color-mix(in oklab, ${awayC} 26%, transparent), transparent)`, pointerEvents: "none" }} />

      <div style={{ position: "relative", padding: "13px 15px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span suppressHydrationWarning className="display" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", letterSpacing: 0 }}>{fmtKick(kickoffMs)}</span>
          <StatusPill status={status} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8 }}>
          <TeamSide name={match.home_team} align="left" />
          <CenterCell match={match} status={status} pred={pred} />
          <TeamSide name={match.away_team} align="right" />
        </div>

        <div style={{ marginTop: 13, paddingTop: 11, borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 24 }}>
          {status === "upcoming" && (
            <>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-faint)" }}>
                <Icon name="clock" size={14} /> Predictions open in
              </span>
              <Countdown to={openMs} style={{ fontSize: 13.5 }} />
            </>
          )}
          {status === "open" && (
            <>
              {pred ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-faint)" }}>
                  <Icon name="clock" size={14} /> Closes in
                </span>
              ) : (
                <span className="display" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--accent)", letterSpacing: 0 }}>
                  <Icon name="bolt" size={14} stroke={2.6} /> Tap to predict
                </span>
              )}
              <Countdown to={deadlineMs} style={{ fontSize: 13.5 }} />
            </>
          )}
          {status === "locked" && (
            <>
              <span suppressHydrationWarning style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Kickoff {fmtKick(kickoffMs)}</span>
              {pred ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-dim)" }}>
                  <Icon name="lock" size={13} /> Pick locked
                </span>
              ) : (
                <span style={{ fontSize: 12.5, color: "var(--neg)", fontWeight: 600 }}>No pick submitted</span>
              )}
            </>
          )}
          {status === "final" && (
            <>
              <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
                {pred ? (
                  <>
                    Your pick{" "}
                    <b className="num" style={{ color: "var(--text)", fontWeight: 800 }}>
                      {pred[0]}–{pred[1]}
                    </b>
                  </>
                ) : (
                  "No pick"
                )}
              </span>
              {pred ? <PointsBadge pts={pts} exactPts={exactPts} /> : <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>0 pts</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
