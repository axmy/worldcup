"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Match } from "@/lib/types";
import { Countdown, Empty, Icon, ScreenHead, SectionLabel, dayKey, fmtDay, isLive, matchStatus, useNow } from "@/components/ui";
import { flagEmoji } from "@/lib/flags";
import { MatchCard, type Pred } from "@/components/MatchCard";
import { PredictSheet } from "@/components/PredictSheet";

export type PredMap = Record<string, Pred>;

const HOST_FLAGS = ["Mexico", "United States", "Canada"].map((h) => flagEmoji(h)).join(" ");

// Right side of the ribbon: matches in play right now, else a countdown to the
// next kickoff, else the tournament is done. (The old fixed opener countdown
// read "Kickoff in · Closed" forever once the tournament started.)
function RibbonStatus({ matches, now }: { matches: Match[]; now: number }) {
  const liveCount = matches.filter(isLive).length;
  const next = matches.find((m) => m.home_score === null && new Date(m.kickoff_time).getTime() > now);
  const label = liveCount > 0 ? "Now playing" : next ? "Next kickoff in" : "Tournament";
  return (
    <div style={{ textAlign: "right" }}>
      <div className="display" style={{ fontSize: 8.5, letterSpacing: ".14em", fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase" }}>{label}</div>
      {liveCount > 0 ? (
        <span className="num" style={{ fontSize: 15, fontWeight: 800, color: "var(--neg)" }}>
          {liveCount} live
        </span>
      ) : next ? (
        <Countdown to={new Date(next.kickoff_time).getTime()} style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }} />
      ) : (
        <span className="display" style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>Complete</span>
      )}
    </div>
  );
}

// Slim stadium ribbon shown atop the Matches screen.
function WorldCupRibbon({ matches, now }: { matches: Match[]; now: number }) {
  return (
    <div
      className="card-sport"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "12px 16px",
        marginBottom: 16,
        borderRadius: 16,
        background: "linear-gradient(120deg, color-mix(in oklab, oklch(0.62 0.17 150) 26%, var(--bg-2)), var(--bg-2))",
        border: "1px solid color-mix(in oklab, oklch(0.7 0.19 145) 28%, var(--line-soft))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span aria-hidden style={{ fontSize: 18 }}>{HOST_FLAGS}</span>
        <div style={{ minWidth: 0 }}>
          <div className="display" style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.1 }}>World Cup 2026</div>
          <div className="display" style={{ fontSize: 9.5, letterSpacing: ".14em", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>USA · Canada · Mexico</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="trophy" size={16} style={{ color: "oklch(0.8 0.18 140)" }} />
        <RibbonStatus matches={matches} now={now} />
      </div>
    </div>
  );
}

// Shown on Matches / My Picks when the user hasn't joined any league yet —
// predictions are per-league, so there's nowhere to predict until they join.
export function NoLeague() {
  return (
    <div style={{ textAlign: "center", padding: "46px 20px", color: "var(--text-faint)" }}>
      <Icon name="trophy" size={34} style={{ opacity: 0.5 }} />
      <p style={{ marginTop: 12, fontSize: 14 }}>Create your own league or join one to start predicting — picks are made per league.</p>
      <Link href="/leagues" className="btn-sport tap" style={{ display: "inline-flex", marginTop: 16, padding: "12px 22px", borderRadius: 12, textDecoration: "none", fontSize: 14.5, alignItems: "center", gap: 8 }}>
        <Icon name="arrowR" size={17} stroke={2.4} /> Create or join a league
      </Link>
    </div>
  );
}

export function Toast({ msg }: { msg: string }) {
  return (
    <div
      className="wc-toast"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 80,
        background: "var(--text)",
        color: "var(--bg)",
        padding: "12px 20px",
        borderRadius: 12,
        fontWeight: 700,
        fontSize: 14,
        fontFamily: "var(--font-display)",
        boxShadow: "0 8px 30px rgba(0,0,0,.4)",
        animation: "popIn .25s ease both",
        display: "flex",
        alignItems: "center",
        gap: 9,
        whiteSpace: "nowrap",
      }}
    >
      <Icon name="check" size={17} stroke={3} style={{ color: "var(--accent)" }} /> {msg}
      <style>{`.wc-toast{bottom:90px}@media(min-width:860px){.wc-toast{bottom:28px}}`}</style>
    </div>
  );
}

const FILTERS: [string, string][] = [
  ["all", "All"],
  ["open", "Open"],
  ["live", "Locked"],
  ["done", "Final"],
];

export function MatchesScreen({
  matches,
  predictions,
  submissionMode,
  exactPts,
  outcomePts,
}: {
  matches: Match[];
  predictions: PredMap;
  submissionMode: "single" | "multiple";
  exactPts: number;
  outcomePts: number;
}) {
  const router = useRouter();
  const now = useNow(1000) ?? Date.now();
  const [filter, setFilter] = useState("all");
  const [sheet, setSheet] = useState<Match | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const groups = useMemo(() => {
    const list = matches.filter((m) => {
      const s = matchStatus(m, now);
      if (filter === "open") return s === "open";
      if (filter === "live") return s === "locked";
      if (filter === "done") return s === "final";
      return true;
    });
    const byDay: Record<string, Match[]> = {};
    list.forEach((m) => {
      const key = dayKey(new Date(m.kickoff_time).getTime()); // group by Maldives calendar day
      (byDay[key] = byDay[key] || []).push(m);
    });
    return Object.entries(byDay).sort((x, y) => x[0].localeCompare(y[0]));
  }, [filter, now, matches]);

  const openCount = matches.filter((m) => matchStatus(m, now) === "open").length;

  // While any match is in its play window, re-pull fresh data every minute so
  // live scores and the half-time lock (written by the results cron) show up
  // without a manual reload.
  const anyInPlay = matches.some((m) => {
    if (m.home_score !== null) return false;
    const kick = new Date(m.kickoff_time).getTime();
    return now >= kick - 60_000 && now - kick < 3 * 3_600_000;
  });
  useEffect(() => {
    if (!anyInPlay) return;
    const t = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(t);
  }, [anyInPlay, router]);

  function done(msg: string) {
    setSheet(null);
    setToast(msg);
    clearTimeout((window as { __wcToast?: number }).__wcToast);
    (window as { __wcToast?: number }).__wcToast = window.setTimeout(() => setToast(null), 2400);
    router.refresh();
  }

  return (
    <div className="screen-enter">
      <ScreenHead title="Matches" sub={`${openCount} open for predictions · times in Maldives time (MVT)`} />

      <WorldCupRibbon matches={matches} now={now} />

      <div style={{ display: "flex", gap: 8, marginBottom: 18, overflowX: "auto", paddingBottom: 2 }}>
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            className="tap"
            onClick={() => setFilter(k)}
            style={{
              padding: "8px 17px",
              borderRadius: 99,
              fontWeight: 800,
              fontSize: 13,
              whiteSpace: "nowrap",
              fontFamily: "var(--font-display)",
              letterSpacing: ".06em",
              textTransform: "uppercase",
              background: filter === k ? "var(--grad-accent)" : "var(--bg-2)",
              color: filter === k ? "var(--accent-ink)" : "var(--text-dim)",
              border: "1px solid",
              borderColor: filter === k ? "transparent" : "var(--line-soft)",
              boxShadow: filter === k ? "var(--glow-accent)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {groups.length === 0 && <Empty icon="cal" text="No matches in this view." />}
      {groups.map(([day, ms]) => (
        <div key={day} style={{ marginBottom: 24 }}>
          <SectionLabel>{fmtDay(new Date(day).getTime())}</SectionLabel>
          <div className="wc-grid stagger">
            {ms.map((m) => (
              <MatchCard key={m.id} match={m} pred={predictions[m.id]} exactPts={exactPts} outcomePts={outcomePts} onOpen={setSheet} />
            ))}
          </div>
        </div>
      ))}

      {sheet && (
        <PredictSheet
          match={matches.find((m) => m.id === sheet.id) ?? sheet}
          pred={predictions[sheet.id]}
          submissionMode={submissionMode}
          onClose={() => setSheet(null)}
          onDone={done}
        />
      )}
      {toast && <Toast msg={toast} />}
    </div>
  );
}
