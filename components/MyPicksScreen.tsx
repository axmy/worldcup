"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Match } from "@/lib/types";
import { Empty, ScreenHead, SectionLabel, matchStatus, useNow } from "@/components/ui";
import { MatchCard } from "@/components/MatchCard";
import { PredictSheet } from "@/components/PredictSheet";
import { Toast, NoLeague, type PredMap } from "@/components/MatchesScreen";
import { LeagueSwitcher, type LeagueOption } from "@/components/LeagueSwitcher";

function StatTile({ big, label, accent }: { big: number; label: string; accent?: boolean }) {
  return (
    <div
      className="card-sport"
      style={{
        background: accent ? "var(--grad-accent)" : undefined,
        border: accent ? "1px solid transparent" : undefined,
        borderRadius: 18,
        padding: "16px 10px",
        textAlign: "center",
        boxShadow: accent ? "var(--glow-accent)" : "var(--shadow)",
      }}
    >
      <div className="h-hero num" style={{ fontSize: 36, lineHeight: 0.9, color: accent ? "var(--accent-ink)" : "var(--text)" }}>{big}</div>
      <div className="display" style={{ fontSize: 10, letterSpacing: ".14em", fontWeight: 800, marginTop: 6, textTransform: "uppercase", color: accent ? "var(--accent-ink)" : "var(--text-faint)", opacity: accent ? 0.85 : 1 }}>
        {label}
      </div>
    </div>
  );
}

export function MyPicksScreen({
  matches,
  predictions,
  leagues,
  activeLeagueId,
  submissionMode,
  exactPts,
  outcomePts,
}: {
  matches: Match[];
  predictions: PredMap;
  leagues: LeagueOption[];
  activeLeagueId: string | null;
  submissionMode: "single" | "multiple";
  exactPts: number;
  outcomePts: number;
}) {
  const router = useRouter();
  const now = useNow(1000) ?? Date.now();
  const [sheet, setSheet] = useState<Match | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const mine = matches.filter((m) => predictions[m.id]);
  const open = mine.filter((m) => matchStatus(m, now) === "open");
  const locked = mine.filter((m) => matchStatus(m, now) === "locked");
  const final = mine.filter((m) => matchStatus(m, now) === "final");

  const stats = useMemo(() => {
    let points = 0,
      exact = 0,
      correct = 0;
    for (const m of mine) {
      if (m.home_score === null || m.away_score === null) continue;
      const p = predictions[m.id];
      if (p[0] === m.home_score && p[1] === m.away_score) {
        points += exactPts;
        exact++;
      } else if (Math.sign(p[0] - p[1]) === Math.sign(m.home_score - m.away_score)) {
        points += outcomePts;
        correct++;
      }
    }
    return { points, exact, correct };
  }, [mine, predictions, exactPts, outcomePts]);

  function done(msg: string) {
    setSheet(null);
    setToast(msg);
    clearTimeout((window as { __wcToast?: number }).__wcToast);
    (window as { __wcToast?: number }).__wcToast = window.setTimeout(() => setToast(null), 2400);
    router.refresh();
  }

  const group = (title: string, list: Match[]) =>
    list.length > 0 && (
      <div style={{ marginBottom: 22 }}>
        <SectionLabel>
          {title} · {list.length}
        </SectionLabel>
        <div className="wc-grid stagger">
          {list.map((m) => (
            <MatchCard key={m.id} match={m} pred={predictions[m.id]} exactPts={exactPts} outcomePts={outcomePts} onOpen={setSheet} />
          ))}
        </div>
      </div>
    );

  if (!activeLeagueId) {
    return (
      <div className="screen-enter">
        <ScreenHead title="My Picks" />
        <NoLeague />
      </div>
    );
  }

  return (
    <div className="screen-enter">
      <ScreenHead title="My Picks" sub={`${mine.length} prediction${mine.length === 1 ? "" : "s"} submitted`} />

      <LeagueSwitcher leagues={leagues} activeId={activeLeagueId} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 22 }}>
        <StatTile big={stats.points} label="POINTS" accent />
        <StatTile big={stats.exact} label="EXACT" />
        <StatTile big={stats.correct} label="OUTCOMES" />
      </div>

      {group("Editable", open)}
      {group("Locked in", locked)}
      {group("Scored", final)}
      {mine.length === 0 && <Empty icon="ticket" text="You haven't made any predictions yet." />}

      {sheet && (
        <PredictSheet match={sheet} pred={predictions[sheet.id]} leagueId={activeLeagueId} submissionMode={submissionMode} onClose={() => setSheet(null)} onDone={done} />
      )}
      {toast && <Toast msg={toast} />}
    </div>
  );
}
