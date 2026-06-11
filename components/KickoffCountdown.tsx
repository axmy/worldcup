"use client";

import type { CSSProperties } from "react";
import { useNow } from "@/components/ui";

// 2026 FIFA World Cup — opener June 11, 13:00 in Mexico City (19:00 UTC; must
// match supabase/migrations/0023_wc2026_real_schedule.sql), final July 19 in
// New York New Jersey (19:00 UTC). Once the opener kicks off, the hero flips
// from counting down to kickoff to counting down to the final.
const KICKOFF_MS = new Date("2026-06-11T19:00:00Z").getTime();
const FINAL_MS = new Date("2026-07-19T19:00:00Z").getTime();

const GREEN = "oklch(0.78 0.16 155)";

// Clock at module load — picks the phase before useNow mounts. Phase only
// changes at day-scale boundaries, and the ticking clock takes over on mount.
const LOADED_AT = Date.now();

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

function Cell({ value, label, compact }: { value: string; label: string; compact: boolean }) {
  return (
    <div
      style={{
        minWidth: compact ? "clamp(54px, 13vw, 74px)" : "clamp(64px, 17vw, 124px)",
        padding: compact ? "14px 6px 10px" : "clamp(16px, 4vw, 30px) 8px clamp(12px, 3vw, 20px)",
        borderRadius: compact ? 14 : 20,
        background: "color-mix(in oklab, var(--bg-2) 72%, transparent)",
        border: "1px solid var(--line-soft)",
        boxShadow: "var(--shadow)",
        textAlign: "center",
      }}
    >
      <div className="h-hero num" style={{ fontSize: compact ? "clamp(28px, 6vw, 40px)" : "clamp(38px, 9vw, 68px)", lineHeight: 1, color: "var(--text)" }}>{value}</div>
      <div className="display" style={{ fontSize: compact ? 9 : "clamp(9px, 2vw, 12px)", letterSpacing: ".16em", fontWeight: 800, textTransform: "uppercase", color: GREEN, marginTop: compact ? 7 : "clamp(8px, 2vw, 14px)" }}>
        {label}
      </div>
    </div>
  );
}

function Colon({ compact }: { compact: boolean }) {
  const dot: CSSProperties = { width: compact ? 4 : 5, height: compact ? 4 : 5, borderRadius: "50%", background: "var(--text-faint)", opacity: 0.6 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 7 : 10, alignItems: "center", justifyContent: "center", alignSelf: "center", paddingBottom: compact ? 16 : 24 }}>
      <span style={dot} />
      <span style={dot} />
    </div>
  );
}

// Per-phase hero copy: counting down to the opener, then to the final, then done.
const COPY = {
  pre: {
    label: "Kickoff in",
    headline: "Kickoff is coming",
    sub: "Countdown to the World Cup",
    where: "Mexico City",
    what: "Opening Match",
    shortDate: "June 11, 2026",
  },
  during: {
    label: "The final in",
    headline: "The World Cup is on",
    sub: "Countdown to the final",
    where: "New York New Jersey",
    what: "The Final",
    shortDate: "July 19, 2026",
  },
  post: {
    label: "Full time",
    headline: "That's a wrap",
    sub: "World Cup 2026 is in the books",
    where: "",
    what: "",
    shortDate: "June 11 – July 19, 2026",
  },
} as const;

// Segmented countdown to the opener — and, once the tournament is underway, to
// the final. `compact` fits it into the narrower auth hero.
export function KickoffCountdown({ compact = false }: { compact?: boolean }) {
  const now = useNow(1000);
  const t = now ?? LOADED_AT;
  const phase = t < KICKOFF_MS ? "pre" : t < FINAL_MS ? "during" : "post";
  const copy = COPY[phase];
  const target = phase === "pre" ? KICKOFF_MS : FINAL_MS;
  // Target time in the visitor's own timezone; only after mount so SSR and client agree.
  const localKickoff = now === null
    ? ""
    : new Date(target).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  let d = 0, h = 0, m = 0, s = 0;
  if (now !== null) {
    const sec = Math.max(0, Math.floor((target - now) / 1000));
    d = Math.floor(sec / 86400);
    h = Math.floor((sec % 86400) / 3600);
    m = Math.floor((sec % 3600) / 60);
    s = sec % 60;
  }
  // Until mounted, render placeholders so SSR and first client render agree.
  const cells: [string, string][] = now === null
    ? [["––", "Days"], ["––", "Hours"], ["––", "Minutes"], ["––", "Seconds"]]
    : [[pad(d), "Days"], [pad(h), "Hours"], [pad(m), "Minutes"], [pad(s), "Seconds"]];

  return (
    <div style={{ textAlign: "center" }}>
      {compact ? (
        <div suppressHydrationWarning className="display" style={{ fontSize: 11, letterSpacing: ".16em", fontWeight: 800, textTransform: "uppercase", color: GREEN, marginBottom: 14 }}>
          {copy.label}
        </div>
      ) : (
        <>
          <h2 suppressHydrationWarning className="h-hero" style={{ fontSize: "clamp(30px, 6vw, 52px)", fontStyle: "italic", textTransform: "uppercase", letterSpacing: "-0.01em" }}>
            {copy.headline}
          </h2>
          <p suppressHydrationWarning style={{ fontSize: "clamp(15px, 2.5vw, 19px)", color: "var(--text-dim)", marginTop: 14 }}>{copy.sub}</p>
        </>
      )}

      {phase !== "post" && (
        <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", gap: compact ? 8 : "clamp(8px, 2.5vw, 20px)", marginTop: compact ? 0 : 30 }}>
          <Cell value={cells[0][0]} label={cells[0][1]} compact={compact} />
          <Colon compact={compact} />
          <Cell value={cells[1][0]} label={cells[1][1]} compact={compact} />
          <Colon compact={compact} />
          <Cell value={cells[2][0]} label={cells[2][1]} compact={compact} />
          <Colon compact={compact} />
          <Cell value={cells[3][0]} label={cells[3][1]} compact={compact} />
        </div>
      )}

      <p suppressHydrationWarning style={{ fontSize: compact ? 12 : "clamp(13px, 2.5vw, 17px)", color: "var(--text-faint)", marginTop: compact ? 16 : 28, fontWeight: 500 }}>
        {compact || phase === "post" ? (
          <>{copy.shortDate}{copy.where && <> · {copy.where}</>}</>
        ) : (
          <>{copy.shortDate}{localKickoff && <> — {localKickoff} your time</>} <span aria-hidden style={{ margin: "0 8px" }}>·</span> {copy.where} <span aria-hidden style={{ margin: "0 8px" }}>·</span> {copy.what}</>
        )}
      </p>
    </div>
  );
}
