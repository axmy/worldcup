"use client";

// ── Shared Kickoff UI kit ──────────────────────────────────────────────
// Presentational primitives ported from the design bundle, adapted to the
// real data model (teams are free-text names rather than fixed codes).
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Match } from "@/lib/types";
import { flagUrl, fifaCode } from "@/lib/flags";

/* ── Team helpers: derive a short code + stable color from a team name ── */
export function teamCode(name: string) {
  // Prefer the official FIFA 3-letter code; fall back to a name-derived guess
  // for teams we don't have mapped (keeps this white-label-safe).
  const fifa = fifaCode(name);
  if (fifa) return fifa;
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1].slice(0, 2)).toUpperCase().slice(0, 3);
  }
  return name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "—";
}
function hueOf(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}
/** A stable, vivid team colour derived from the name (for sporty tinting). */
export function teamColor(name: string) {
  return `oklch(0.62 0.17 ${hueOf(name)})`;
}

/* ── Icons (simple line set) ── */
const ICONS: Record<string, ReactNode> = {
  chevL: <polyline points="15 18 9 12 15 6" />,
  chevR: <polyline points="9 18 15 12 9 6" />,
  chevD: <polyline points="6 9 12 15 18 9" />,
  check: <polyline points="20 6 9 17 4 12" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3" />
      <path d="M17 6h3v1a3 3 0 0 1-3 3" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="14" x2="12" y2="20" />
    </>
  ),
  list: (
    <>
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="18" x2="20" y2="18" />
      <circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z" />
      <line x1="13" y1="6" x2="13" y2="16" strokeDasharray="2 2" />
    </>
  ),
  shield: <path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6Z" />,
  cog: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.5M12 18.5V21M5 12H2.5M21.5 12H19M6 6l1.8 1.8M16.2 16.2 18 18M18 6l-1.8 1.8M7.8 16.2 6 18" />
    </>
  ),
  x: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" />
    </>
  ),
  logout: (
    <>
      <path d="M14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="9 16 4 12 9 8" />
      <line x1="4" y1="12" x2="15" y2="12" />
    </>
  ),
  cal: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
      <line x1="8" y1="3" x2="8" y2="6" />
      <line x1="16" y1="3" x2="16" y2="6" />
    </>
  ),
  bolt: <path d="M13 3 5 13h5l-1 8 8-10h-5l1-8Z" />,
  flame: <path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1 0-1 .5-2 1.5 1.5 2.5 3 2.5 5a5 5 0 0 1-10 0c0-3.5 3-5 5-10Z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  arrowR: (
    <>
      <line x1="4" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </>
  ),
  plusC: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8.5" x2="12" y2="15.5" />
      <line x1="8.5" y1="12" x2="15.5" y2="12" />
    </>
  ),
  trash: (
    <>
      <polyline points="4 7 20 7" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  stroke = 2,
  style,
}: {
  name: string;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {ICONS[name]}
    </svg>
  );
}

/* ── Team crest: full-bleed country flag image, else a code disc ── */
export function Crest({ name, size = 44 }: { name: string; size?: number }) {
  const url = flagUrl(name, Math.ceil(size * 2));
  const hue = hueOf(name);
  if (url) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.3,
          flexShrink: 0,
          overflow: "hidden",
          position: "relative",
          background: "#0b0b0c",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,.14), 0 2px 6px rgba(0,0,0,.32)",
        }}
        aria-label={name}
      >
        <img
          src={url}
          alt={name}
          width={size}
          height={size}
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 30% 18%, rgba(255,255,255,.18), transparent 60%)",
          }}
        />
      </div>
    );
  }
  const color = `oklch(0.55 0.15 ${hue})`;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(155deg, ${color}, color-mix(in oklab, ${color} 60%, #000))`,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.22), 0 1px 2px rgba(0,0,0,.3)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,.25), transparent 60%)",
        }}
      />
      <span
        className="display"
        style={{
          color: "#fff",
          fontWeight: 800,
          fontSize: size * 0.34,
          letterSpacing: ".02em",
          textShadow: "0 1px 2px rgba(0,0,0,.35)",
          zIndex: 1,
        }}
      >
        {teamCode(name)}
      </span>
    </div>
  );
}

/* ── Avatar: initials disc ── */
function initials(name: string) {
  if (/^you$/i.test(name)) return "YOU";
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}
export function Avatar({
  name,
  size = 38,
  isMe,
}: {
  name: string;
  size?: number;
  isMe?: boolean;
}) {
  const hue = useMemo(() => hueOf(name), [name]);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        background: isMe ? "var(--accent)" : `oklch(0.5 0.13 ${hue})`,
        color: isMe ? "var(--accent-ink)" : "#fff",
        fontWeight: 700,
        fontSize: size * 0.34,
        letterSpacing: ".01em",
        fontFamily: "var(--font-display)",
      }}
    >
      {initials(name)}
    </div>
  );
}

/* ── Live countdown ──
   A meaningful multi-unit timer that ticks live: shows the largest relevant
   units down to seconds so the time left is always clear. */
export function fmtRemain(ms: number) {
  if (ms <= 0) return { text: "Closed", urgent: false, closed: true };
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60),
    ss = s % 60;
  // ≥1 day: days/hours/minutes (seconds would be noise at this range).
  if (d >= 1) return { text: `${d}d ${h}h ${m}m`, urgent: false, closed: false };
  // ≥1 hour: hours/minutes/seconds.
  if (h >= 1) return { text: `${h}h ${m}m ${ss}s`, urgent: false, closed: false };
  // <1 hour: minutes/seconds — getting urgent.
  if (m >= 1) return { text: `${m}m ${ss}s`, urgent: m < 15, closed: false };
  // Final minute: seconds only.
  return { text: `${ss}s`, urgent: true, closed: false };
}
// Returns Date.now() ticking every `intervalMs`. null until mounted so SSR and
// the first client render agree (the server clock differs from the browser's).
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
export function Countdown({
  to,
  prefix = "",
  style,
}: {
  to: number;
  prefix?: string;
  style?: CSSProperties;
}) {
  const now = useNow();
  if (now === null) return <span className="num" style={{ color: "var(--text-faint)", ...style }}>…</span>;
  const r = fmtRemain(to - now);
  return (
    <span
      className="num"
      style={{
        color: r.closed ? "var(--text-faint)" : r.urgent ? "var(--warn)" : "var(--text-dim)",
        fontWeight: 600,
        ...style,
      }}
    >
      {prefix}
      {r.text}
    </span>
  );
}

/* ── Status ── */
export type MatchState = "upcoming" | "open" | "locked" | "final";
export function matchStatus(match: Match, now: number): MatchState {
  if (match.home_score !== null && match.away_score !== null) return "final";
  if (now >= new Date(match.submission_deadline).getTime()) return "locked";
  // Not open yet: an explicit window start that's still in the future.
  if (match.submission_open && now < new Date(match.submission_open).getTime()) return "upcoming";
  return "open";
}
// In play: the sync has written live data and the final score hasn't landed.
// (live_* may be briefly undefined from a pre-migration cache — treat as off.)
export function isLive(match: Match): boolean {
  return match.home_score === null && match.live_status != null;
}
export function StatusPill({ status }: { status: MatchState | "live" }) {
  const map = {
    upcoming: { label: "SOON", c: "var(--text-dim)", bg: "var(--bg-3)", icon: "clock", glow: false },
    open: { label: "OPEN", c: "var(--accent-ink)", bg: "var(--grad-accent)", icon: "bolt", glow: true },
    live: { label: "LIVE", c: "#fff", bg: "var(--neg)", icon: "bolt", glow: false },
    locked: { label: "LOCKED", c: "var(--text-dim)", bg: "var(--bg-3)", icon: "lock", glow: false },
    final: { label: "FINAL", c: "var(--text-dim)", bg: "var(--bg-3)", icon: "check", glow: false },
  }[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 11px 4px 8px",
        borderRadius: 99,
        background: map.bg,
        color: map.c,
        fontSize: 10.5,
        fontWeight: 900,
        letterSpacing: ".1em",
        fontFamily: "var(--font-display)",
        boxShadow: map.glow ? "var(--glow-accent)" : "none",
      }}
    >
      <Icon name={map.icon} size={12} stroke={2.8} /> {map.label}
    </span>
  );
}

/* ── Date helpers ──
   The tournament runs in the Maldives, so every match time is displayed in
   Maldives time (UTC+5) regardless of the viewer's own timezone. */
export const TOURNAMENT_TZ = "Indian/Maldives";
export function fmtKick(ms: number) {
  return new Date(ms).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: TOURNAMENT_TZ });
}
export function fmtDay(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", timeZone: TOURNAMENT_TZ });
}
/** Calendar-day key in Maldives time (YYYY-MM-DD) — for grouping matches by day. */
export function dayKey(ms: number) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: TOURNAMENT_TZ });
}

/** Human label for the platform-wide submission deadline policy. */
export function fmtDeadline(type: string, value: string) {
  const n = Number(value) || 0;
  if (type === "minutes_after_kickoff") return `Closes ${n} min after kickoff`;
  if (n === 0) return "Closes at kickoff";
  return `Closes ${n} min before kickoff`;
}

/* ── Score stepper (one team) ── */
export function Stepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        className="step-btn"
        disabled={disabled || value >= 20}
        onClick={() => onChange(value + 1)}
        style={{ width: 40, height: 40, borderRadius: 12, background: "var(--bg-3)", color: "var(--text)", display: "grid", placeItems: "center" }}
        aria-label="increase"
      >
        <Icon name="plus" size={20} stroke={2.6} />
      </button>
      <div className="display num" style={{ fontSize: 56, lineHeight: 1, fontWeight: 800, minWidth: 56, textAlign: "center", color: "var(--text)" }}>
        {value}
      </div>
      <button
        type="button"
        className="step-btn"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        style={{ width: 40, height: 40, borderRadius: 12, background: "var(--bg-3)", color: "var(--text)", display: "grid", placeItems: "center" }}
        aria-label="decrease"
      >
        <Icon name="minus" size={20} stroke={2.6} />
      </button>
    </div>
  );
}

/* ── Section header ── */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 2px 11px" }}>
      <h3 suppressHydrationWarning className="display" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800, letterSpacing: ".14em", color: "var(--text-dim)", textTransform: "uppercase" }}>
        <span aria-hidden style={{ width: 14, height: 3, borderRadius: 2, background: "var(--grad-accent)", display: "inline-block" }} />
        {children}
      </h3>
      {right}
    </div>
  );
}

/* ── Points badge ── */
export function PointsBadge({ pts, exactPts = 3 }: { pts: number | null; exactPts?: number }) {
  if (pts == null) return null;
  const exact = pts > 0 && pts === exactPts;
  const positive = pts > 0;
  // Exact = solid accent pill (white text + glow); outcome = bold green pill with
  // a border; zero = neutral. Higher contrast so it reads on the dark card.
  const fg = exact ? "var(--accent-ink)" : positive ? "var(--pos)" : "var(--text-faint)";
  const bg = exact ? "var(--accent)" : positive ? "color-mix(in oklab, var(--pos) 22%, transparent)" : "var(--bg-3)";
  const border = exact ? "transparent" : positive ? "color-mix(in oklab, var(--pos) 55%, transparent)" : "var(--line-soft)";
  return (
    <span
      className="num"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 8,
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        fontWeight: 800,
        fontSize: 13,
        fontFamily: "var(--font-display)",
        boxShadow: exact ? "var(--glow-accent)" : "none",
      }}
    >
      {pts > 0 ? "+" : ""}
      {pts} <span style={{ fontSize: 10, opacity: 0.85, fontWeight: 700 }}>PT{pts === 1 ? "" : "S"}</span>
    </span>
  );
}

/* ── Brand lockup (white-label: name + tagline are configurable) ── */
export function Brand({
  size = "md",
  name = "Kickoff",
  tagline = "WC26 · Predictor",
}: {
  size?: "md" | "lg";
  name?: string;
  tagline?: string;
}) {
  const big = size === "lg";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: big ? 13 : 10 }}>
      <div
        style={{
          width: big ? 46 : 34,
          height: big ? 46 : 34,
          borderRadius: big ? 14 : 10,
          background: "var(--grad-accent)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          transform: "skewX(-6deg)",
          boxShadow: "var(--glow-accent)",
        }}
      >
        <Icon name="bolt" size={big ? 27 : 20} stroke={2.6} style={{ color: "var(--accent-ink)", transform: "skewX(6deg)" }} />
      </div>
      <div style={{ lineHeight: 1 }}>
        <div className="h-hero" style={{ fontSize: big ? 30 : 21 }}>{name}</div>
        {tagline && (
          <div className="display" style={{ fontSize: big ? 11 : 9.5, fontWeight: 800, letterSpacing: ".24em", color: "var(--text-faint)", marginTop: 3, textTransform: "uppercase" }}>
            {tagline}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Empty state ── */
export function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--text-faint)" }}>
      <Icon name={icon} size={34} style={{ opacity: 0.5 }} />
      <p style={{ marginTop: 12, fontSize: 14 }}>{text}</p>
    </div>
  );
}

/* ── Screen header: big condensed title with an accent slash ── */
export function ScreenHead({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 13, marginBottom: 18, alignItems: "stretch" }}>
      <span className="slash" aria-hidden style={{ minHeight: 40 }} />
      <div style={{ minWidth: 0 }}>
        <h1 className="h-hero" style={{ fontSize: "clamp(30px, 7vw, 44px)" }}>{title}</h1>
        {sub && <p style={{ fontSize: 13.5, color: "var(--text-faint)", marginTop: 6, fontWeight: 500 }}>{sub}</p>}
      </div>
    </div>
  );
}
