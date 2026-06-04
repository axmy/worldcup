"use client";

import { useEffect, useState, useTransition } from "react";
import type { Match } from "@/lib/types";
import { submitPrediction } from "@/app/actions";
import { Countdown, Crest, Icon, Stepper, matchStatus, useNow } from "@/components/ui";
import type { Pred } from "@/components/MatchCard";

const PRESETS: Pred[] = [
  [1, 0],
  [2, 1],
  [0, 0],
  [1, 1],
  [2, 0],
  [3, 1],
];

export function PredictSheet({
  match,
  pred,
  submissionMode,
  onClose,
  onDone,
}: {
  match: Match;
  pred?: Pred;
  submissionMode: "single" | "multiple";
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const now = useNow(1000) ?? Date.now();
  const status = matchStatus(match, now);
  // Locked if the match isn't open, or in single-submission mode once a pick exists.
  const readOnly = status !== "open" || (submissionMode === "single" && !!pred);
  const [a, setA] = useState(pred ? pred[0] : 0);
  const [b, setB] = useState(pred ? pred[1] : 0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const changed = !pred || pred[0] !== a || pred[1] !== b;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const outName = a > b ? match.home_team : b > a ? match.away_team : "Draw";

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("match_id", match.id);
    fd.set("home_score", String(a));
    fd.set("away_score", String(b));
    startTransition(async () => {
      const res = await submitPrediction(fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
      } else {
        onDone(`Pick locked: ${a}–${b}`);
      }
    });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,.55)",
        backdropFilter: "blur(3px)",
        animation: "overlayIn .2s ease",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--bg-2)",
          borderRadius: "24px 24px 0 0",
          border: "1px solid var(--line)",
          borderBottom: "none",
          padding: "10px 18px 26px",
          animation: "slideUp .32s cubic-bezier(.2,.8,.25,1)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 99, background: "var(--line)", margin: "4px auto 14px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div className="display" style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".08em", color: "var(--text-faint)" }}>
            {match.home_team.toUpperCase()} v {match.away_team.toUpperCase()}
          </div>
          <button className="btn-ghost tap" onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", color: "var(--text-dim)" }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {readOnly && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "var(--bg-3)", borderRadius: 12, margin: "6px 0 4px", fontSize: 13, color: "var(--text-dim)" }}>
            <Icon name="lock" size={15} />{" "}
            {status === "upcoming"
              ? "Predictions haven't opened for this match yet."
              : status !== "open"
                ? "Predictions closed — this is your locked pick."
                : "This pool allows a single submission — your pick is locked."}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 6, margin: "18px 0 6px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <Crest name={match.home_team} size={58} />
            <div className="display" style={{ fontSize: 16, fontWeight: 800 }}>{match.home_team}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Stepper value={a} onChange={setA} disabled={readOnly} />
            <span className="display" style={{ fontSize: 34, color: "var(--text-faint)", fontWeight: 600 }}>:</span>
            <Stepper value={b} onChange={setB} disabled={readOnly} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <Crest name={match.away_team} size={58} />
            <div className="display" style={{ fontSize: 16, fontWeight: 800 }}>{match.away_team}</div>
          </div>
        </div>

        <div style={{ textAlign: "center", margin: "14px 0 16px", fontSize: 13.5, color: "var(--text-dim)" }}>
          {a === b ? (
            <>
              Predicting a <b style={{ color: "var(--text)" }}>draw</b>
            </>
          ) : (
            <>
              Predicting <b style={{ color: "var(--text)" }}>{outName}</b> to win
            </>
          )}
        </div>

        {!readOnly && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", marginBottom: 18 }}>
            {PRESETS.map(([pa, pb], i) => {
              const active = a === pa && b === pb;
              return (
                <button
                  key={i}
                  className="chip tap"
                  onClick={() => {
                    setA(pa);
                    setB(pb);
                  }}
                  style={{
                    padding: "7px 13px",
                    borderRadius: 10,
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 14,
                    border: "1px solid",
                    borderColor: active ? "var(--accent)" : "var(--line-soft)",
                    background: active ? "color-mix(in oklab, var(--accent) 16%, transparent)" : "var(--bg-3)",
                    color: active ? "var(--accent)" : "var(--text-dim)",
                  }}
                >
                  {pa}–{pb}
                </button>
              );
            })}
          </div>
        )}

        {!readOnly && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, color: "var(--text-faint)", marginBottom: 12 }}>
            <Icon name="clock" size={13} /> Closes in <Countdown to={new Date(match.submission_deadline).getTime()} style={{ fontSize: 12.5 }} />
          </div>
        )}

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--neg)", fontSize: 13, fontWeight: 600, marginBottom: 12, justifyContent: "center" }}>
            <Icon name="x" size={15} stroke={2.6} /> {error}
          </div>
        )}

        {!readOnly && (
          <button
            className="btn-sport tap"
            disabled={!changed || isPending}
            onClick={submit}
            style={{ width: "100%", padding: "16px", borderRadius: 14, fontSize: 16.5 }}
          >
            {isPending ? "Saving…" : pred ? "Update pick" : "Lock in pick"}
          </button>
        )}
      </div>
    </div>
  );
}
