import type { CSSProperties, ReactNode } from "react";
import { Icon, fmtDeadline } from "@/components/ui";

export type HowToInfo = {
  points_exact: number;
  points_outcome: number;
  submission_mode: "single" | "multiple";
  deadline_type: string;
  deadline_value: string;
};

const cardStyle: CSSProperties = {
  background: "var(--bg-2)",
  border: "1px solid var(--line-soft)",
  borderRadius: 16,
  padding: "16px 16px 18px",
  boxShadow: "var(--shadow)",
};
const headStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--accent)",
  marginBottom: 12,
};

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
      <span
        className="display num"
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: 7,
          background: "var(--grad-accent)",
          color: "var(--accent-ink)",
          display: "grid",
          placeItems: "center",
          fontSize: 13,
          fontWeight: 800,
          boxShadow: "var(--glow-accent)",
        }}
      >
        {n}
      </span>
      <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-dim)", paddingTop: 2 }}>{children}</span>
    </li>
  );
}

export function HowToPlay({ info, scope = "global" }: { info: HowToInfo; scope?: "global" | "league" }) {
  const deadline = fmtDeadline(info.deadline_type, info.deadline_value).toLowerCase();
  const editable = info.submission_mode === "multiple";

  return (
    <div className="screen-enter" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* How to play */}
      <div style={cardStyle}>
        <div style={headStyle}>How to play</div>
        <ol style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, margin: 0, padding: 0 }}>
          <Step n={1}>Sign up — you&apos;re entered into the <b style={{ color: "var(--text)" }}>Global Leaderboard</b> automatically, and you can create or join private leagues with a code.</Step>
          <Step n={2}>Before each match, predict the <b style={{ color: "var(--text)" }}>final score</b>. {editable ? "You can change your pick any time until it locks." : "You get one pick per match — it can't be changed once submitted."}</Step>
          <Step n={3}>Predictions {deadline} — a live countdown shows how long you have left. After that the match locks.</Step>
          <Step n={4}>Final scores are counted after extra time; <b style={{ color: "var(--text)" }}>penalty shootouts don&apos;t count</b> toward the scoreline.</Step>
          <Step n={5}>One prediction per match counts in <b style={{ color: "var(--text)" }}>every league you&apos;ve joined</b>, scored by each league&apos;s own points.</Step>
        </ol>
      </div>

      {/* How to earn points */}
      <div style={cardStyle}>
        <div style={headStyle}>How to earn points</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            ["Exact score", `+${info.points_exact}`, "You nailed the precise scoreline.", true],
            ["Correct result", `+${info.points_outcome}`, "Right winner — or a draw — but wrong scoreline.", false],
            ["Wrong", "0", "Neither the result nor the score matched.", false],
          ].map(([label, pts, desc, accent]) => (
            <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 12, background: "var(--bg-3)", border: "1px solid var(--line-soft)" }}>
              <span
                className="num"
                style={{
                  flexShrink: 0,
                  minWidth: 46,
                  textAlign: "center",
                  fontFamily: "var(--font-score)",
                  fontWeight: 800,
                  fontSize: 18,
                  padding: "5px 8px",
                  borderRadius: 9,
                  background: accent ? "var(--accent)" : "var(--bg-2)",
                  color: accent ? "var(--accent-ink)" : "var(--text-dim)",
                  boxShadow: accent ? "var(--glow-accent)" : "none",
                }}
              >
                {pts as string}
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="display" style={{ fontSize: 14.5, fontWeight: 800 }}>{label as string}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{desc as string}</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-faint)", margin: "10px 2px 0" }}>
          {scope === "league"
            ? "These are this league's points, set by its organizer. Other leagues may score differently."
            : "These are the global competition's points. Each private league's organizer can set their own."}
        </p>
      </div>

      {/* What happens next */}
      <div style={cardStyle}>
        <div style={headStyle}>What happens next?</div>
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, margin: 0, padding: 0 }}>
          {[
            "When a match ends, the final score updates automatically and your points are added.",
            "Your points apply to the Global Leaderboard and every private league you're in at once.",
            "Standings refresh as results come in — watch yourself climb match by match.",
            "Knockout fixtures appear with placeholder teams until the groups are decided.",
          ].map((t, i) => (
            <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.5, color: "var(--text-dim)" }}>
              <Icon name="check" size={16} stroke={2.6} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Ranking */}
      <div style={cardStyle}>
        <div style={headStyle}>How ranking works</div>
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 9, margin: 0, padding: 0 }}>
          {[
            ["1", "Most total points wins."],
            ["2", "Ties are broken by the most exact scorelines."],
            ["3", "Each match shows MP (matches played), Ex (exact hits) and Out (correct results) on the board."],
          ].map(([n, t]) => (
            <li key={n} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.5, color: "var(--text-dim)" }}>
              <span className="num" style={{ flexShrink: 0, fontWeight: 800, color: "var(--accent)", minWidth: 16 }}>{n}</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
