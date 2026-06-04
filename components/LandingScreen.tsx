import Link from "next/link";
import type { CSSProperties } from "react";
import type { LeaderboardRow } from "@/lib/types";
import { Avatar, Brand, Countdown, Crest, Icon } from "@/components/ui";
import { ShareBar } from "@/components/ShareBar";
import { flagEmoji } from "@/lib/flags";

// Public marketing landing page. Copy is plain markup — edit freely. Uses the
// shared design tokens so it matches the rest of the app, dressed up with a
// World Cup feel (pitch lines, host nations, a flag marquee, kickoff countdown).

const wrap: CSSProperties = { maxWidth: 980, margin: "0 auto", padding: "0 20px" };

// 2026 FIFA World Cup opener — Estadio Azteca, Mexico City.
const KICKOFF_MS = new Date("2026-06-11T19:00:00-06:00").getTime();

// Host nations + a spread of headline teams for the flag marquee.
const HOSTS = ["Mexico", "United States", "Canada"];
const MARQUEE = [
  "Brazil", "Argentina", "France", "Spain", "England", "Germany", "Portugal",
  "Netherlands", "Mexico", "United States", "Canada", "Japan", "Morocco",
  "Croatia", "Belgium", "Uruguay", "Colombia", "Senegal", "South Korea", "Italy",
];

function Feature({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="card-sport" style={{ padding: 18, borderRadius: 18 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "color-mix(in oklab, var(--accent) 18%, var(--bg-3))",
          color: "var(--accent)",
          display: "grid",
          placeItems: "center",
          marginBottom: 12,
        }}
      >
        <Icon name={icon} size={22} stroke={2.2} />
      </div>
      <div className="display" style={{ fontSize: 16.5, fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <p style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5, margin: 0 }}>{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div
        className="display num"
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "var(--grad-accent)",
          color: "var(--accent-ink)",
          display: "grid",
          placeItems: "center",
          fontSize: 19,
          fontWeight: 800,
          boxShadow: "var(--glow-accent)",
        }}
      >
        {n}
      </div>
      <div>
        <div className="display" style={{ fontSize: 16.5, fontWeight: 800, marginBottom: 4 }}>{title}</div>
        <p style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5, margin: 0 }}>{body}</p>
      </div>
    </div>
  );
}

export function LandingScreen({
  brandName,
  brandTagline,
  topPlayers,
  shareUrl,
}: {
  brandName: string;
  brandTagline: string;
  topPlayers: LeaderboardRow[];
  shareUrl?: string;
}) {
  const shareText = `⚽ Predict every match of the World Cup 2026 and climb the global leaderboard on ${brandName}. Create your own league and play with friends!`;
  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: "var(--bg)", color: "var(--text)", overflow: "hidden" }}>
      {/* Scoped styles: flag marquee + decorative background */}
      <style>{`
        @keyframes wcMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .wc-marquee-track { display: flex; gap: 14px; width: max-content; animation: wcMarquee 38s linear infinite; }
        @keyframes wcDrift { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(24px,-28px) scale(1.08); } }
        @keyframes wcDrift2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-30px,22px) scale(1.1); } }
        .wc-bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
        .wc-blob { position: absolute; border-radius: 50%; filter: blur(64px); opacity: .85; }
        .wc-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(color-mix(in oklab, var(--text) 5%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in oklab, var(--text) 5%, transparent) 1px, transparent 1px);
          background-size: 46px 46px;
          mask-image: radial-gradient(120% 80% at 50% 0%, #000 30%, transparent 75%);
          -webkit-mask-image: radial-gradient(120% 80% at 50% 0%, #000 30%, transparent 75%);
          opacity: .6;
        }
        @media (prefers-reduced-motion: reduce) {
          .wc-marquee-track, .wc-blob { animation: none; }
        }
      `}</style>

      {/* ── Decorative background ── */}
      <div className="wc-bg" aria-hidden>
        {/* Grass-green glows — strong, slowly drifting pitch light. */}
        <div
          className="wc-blob"
          style={{ top: "-14%", left: "-10%", width: "52vw", height: "52vw", maxWidth: 640, maxHeight: 640, background: "radial-gradient(circle, oklch(0.7 0.19 145), transparent 64%)", opacity: 0.9, animation: "wcDrift 18s ease-in-out infinite" }}
        />
        <div
          className="wc-blob"
          style={{ top: "4%", right: "-12%", width: "48vw", height: "48vw", maxWidth: 600, maxHeight: 600, background: "radial-gradient(circle, oklch(0.6 0.17 152), transparent 64%)", opacity: 0.8, animation: "wcDrift2 22s ease-in-out infinite" }}
        />
        <div
          className="wc-blob"
          style={{ bottom: "-14%", left: "26%", width: "56vw", height: "56vw", maxWidth: 720, maxHeight: 720, background: "radial-gradient(circle, oklch(0.78 0.2 138), transparent 66%)", opacity: 0.65, animation: "wcDrift 26s ease-in-out infinite" }}
        />
        <div className="wc-grid" />
      </div>

      {/* ── Content (sits above the decorative background) ── */}
      <div style={{ position: "relative", zIndex: 1 }}>

      {/* ── Header ── */}
      <header
        style={{
          borderBottom: "1px solid var(--line-soft)",
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "color-mix(in oklab, var(--bg) 84%, transparent)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 20px" }}>
          <Brand name={brandName} tagline={brandTagline} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/login" className="btn-ghost tap" style={{ padding: "9px 14px", borderRadius: 10, textDecoration: "none", fontSize: 14, color: "var(--text-dim)" }}>
              Sign in
            </Link>
            <Link href="/register" className="btn-sport tap" style={{ padding: "9px 16px", borderRadius: 10, textDecoration: "none", fontSize: 14 }}>
              Join free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pitch-hero" style={{ position: "relative", overflow: "hidden" }}>
        {/* Pitch-line markings (decorative) */}
        <svg
          aria-hidden
          viewBox="0 0 1200 600"
          preserveAspectRatio="xMidYMax slice"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: -1, color: "#ffffff", opacity: 0.12 }}
        >
          <line x1="0" y1="300" x2="1200" y2="300" stroke="currentColor" strokeWidth="2" />
          <circle cx="600" cy="300" r="120" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="600" cy="300" r="5" fill="currentColor" />
          <rect x="450" y="560" width="300" height="120" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x="540" y="600" width="120" height="80" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>

        <div style={{ ...wrap, padding: "60px 20px 48px", textAlign: "center" }}>
          {/* Host badge */}
          <div
            className="display"
            style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "6px 14px", borderRadius: 99, background: "color-mix(in oklab, var(--accent) 16%, transparent)", color: "var(--accent)", fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 20 }}
          >
            <span aria-hidden style={{ fontSize: 15, letterSpacing: 0 }}>{HOSTS.map((h) => flagEmoji(h)).join(" ")}</span>
            World Cup 2026 · USA · Canada · Mexico
          </div>

          <h1 className="h-hero" style={{ fontSize: "clamp(40px, 8.5vw, 72px)", lineHeight: 1.0, maxWidth: 800, margin: "0 auto" }}>
            Call the scoreline.<br />Run the pool. Top the world.
          </h1>
          <p style={{ fontSize: "clamp(15px, 2.5vw, 18px)", color: "var(--text-dim)", maxWidth: 560, margin: "20px auto 0", lineHeight: 1.55 }}>
            Predict every match of the tournament, spin up private leagues for your friends or office,
            and climb one global leaderboard against the whole world.
          </p>

          {/* Kickoff countdown */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
              margin: "30px auto 0",
              padding: "12px 22px",
              borderRadius: 16,
              background: "var(--bg-2)",
              border: "1px solid var(--line-soft)",
              boxShadow: "var(--shadow)",
            }}
          >
            <Icon name="trophy" size={22} style={{ color: "var(--accent)" }} />
            <div style={{ textAlign: "left" }}>
              <div className="display" style={{ fontSize: 9.5, letterSpacing: ".16em", fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase" }}>
                Kickoff · Estadio Azteca
              </div>
              <Countdown to={KICKOFF_MS} style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }} />
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 28 }}>
            <Link href="/register" className="btn-sport tap" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 26px", borderRadius: 13, textDecoration: "none", fontSize: 16 }}>
              <Icon name="bolt" size={18} stroke={2.4} /> Start predicting — free
            </Link>
            <Link href="/leaderboard" className="btn-ghost tap" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 22px", borderRadius: 13, textDecoration: "none", fontSize: 16, color: "var(--text)" }}>
              <Icon name="trophy" size={18} stroke={2.4} /> See the global board
            </Link>
          </div>

          <div className="display" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 18px", marginTop: 26, fontSize: 12.5, fontWeight: 700, letterSpacing: ".04em", color: "var(--text-faint)", textTransform: "uppercase" }}>
            <span>48 teams</span><span aria-hidden>·</span><span>104 matches</span><span aria-hidden>·</span><span>1 champion</span>
          </div>
        </div>

        {/* Flag marquee */}
        <div style={{ position: "relative", padding: "18px 0 28px", maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
          <div className="wc-marquee-track">
            {[...MARQUEE, ...MARQUEE].map((team, i) => (
              <div key={i} title={team} style={{ flexShrink: 0 }}>
                <Crest name={team} size={40} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ ...wrap, padding: "56px 20px" }}>
        <h2 className="h-hero" style={{ fontSize: "clamp(26px, 5vw, 36px)", marginBottom: 28, textAlign: "center" }}>How it works</h2>
        <div style={{ display: "grid", gap: 24, maxWidth: 620, margin: "0 auto" }}>
          <Step n={1} title="Create or join a league" body="Start your own league with custom scoring, or join a friend's with a 6-character code. Everyone's automatically in the global competition too." />
          <Step n={2} title="Predict every scoreline" body="Call the exact score for each fixture before the deadline locks. Same fixtures and real results for everyone — only your predictions are yours." />
          <Step n={3} title="Climb the board" body="Earn points the moment results are published, and watch your rank rise in every league you're in — and on the global leaderboard." />
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ background: "color-mix(in oklab, var(--bg-2) 78%, transparent)", borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)" }}>
        <div style={{ ...wrap, padding: "56px 20px" }}>
          <h2 className="h-hero" style={{ fontSize: "clamp(26px, 5vw, 36px)", marginBottom: 28, textAlign: "center" }}>Built for the whole tournament</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <Feature icon="cog" title="Your league, your rules" body="Set points for an exact score vs. the right result, and choose whether picks can be edited until kickoff." />
            <Feature icon="bolt" title="Exact-score scoring" body="Nail the precise scoreline for big points, or take partial credit for calling the right winner." />
            <Feature icon="lock" title="Deadline lock" body="Predictions close at each match's deadline — enforced server-side, so no late edits ever slip through." />
            <Feature icon="trophy" title="Live standings" body="Per-league boards plus one global leaderboard, updated automatically as results come in." />
          </div>
        </div>
      </section>

      {/* ── Global leaderboard teaser ── */}
      {topPlayers.length > 0 && (
        <section style={{ ...wrap, padding: "56px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <h2 className="h-hero" style={{ fontSize: "clamp(24px, 5vw, 34px)", margin: 0 }}>Global leaderboard</h2>
            <Link href="/leaderboard" className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>
              Full board <Icon name="chevR" size={16} />
            </Link>
          </div>
          <div className="card-sport" style={{ overflow: "hidden", maxWidth: 560 }}>
            {topPlayers.map((u, i) => (
              <div key={u.user_id} style={{ display: "grid", gridTemplateColumns: "30px 1fr auto", alignItems: "center", gap: 12, padding: "12px 15px", borderTop: i === 0 ? "none" : "1px solid var(--line-soft)" }}>
                <span className="display num" style={{ fontSize: 16, fontWeight: 800, color: i === 0 ? "var(--accent)" : "var(--text-faint)", textAlign: "center" }}>{i + 1}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <Avatar name={u.display_name} size={32} />
                  <span className="display" style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.display_name}</span>
                </div>
                <span className="display num" style={{ fontSize: 18, fontWeight: 800 }}>{u.total_points}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── For organizers ── */}
      <section style={{ background: "color-mix(in oklab, var(--bg-2) 78%, transparent)", borderTop: "1px solid var(--line-soft)" }}>
        <div style={{ ...wrap, padding: "56px 20px" }}>
          <div className="card-sport" style={{ padding: "clamp(24px, 5vw, 40px)", borderRadius: 22, textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
            <div style={{ display: "inline-grid", placeItems: "center", width: 54, height: 54, borderRadius: 16, background: "var(--grad-accent)", color: "var(--accent-ink)", boxShadow: "var(--glow-accent)", marginBottom: 16 }}>
              <Icon name="trophy" size={26} stroke={2.4} />
            </div>
            <h2 className="h-hero" style={{ fontSize: "clamp(24px, 5vw, 34px)", marginBottom: 12 }}>Run your own prediction pool</h2>
            <p style={{ fontSize: 15, color: "var(--text-dim)", maxWidth: 480, margin: "0 auto 22px", lineHeight: 1.55 }}>
              Organize a league for your friends, family, or workplace. Set the scoring, invite by code,
              and manage your members — all in a couple of taps.
            </p>
            <Link href="/register" className="btn-sport tap" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 24px", borderRadius: 13, textDecoration: "none", fontSize: 15.5 }}>
              <Icon name="plusC" size={18} stroke={2.4} /> Create a league
            </Link>
          </div>
        </div>
      </section>

      {/* ── Spread the word ── */}
      <section style={{ ...wrap, padding: "56px 20px" }}>
        <div className="card-sport" style={{ padding: "clamp(24px, 5vw, 36px)", borderRadius: 22, textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <h2 className="h-hero" style={{ fontSize: "clamp(22px, 5vw, 32px)", marginBottom: 8 }}>Spread the word</h2>
          <p style={{ fontSize: 14.5, color: "var(--text-dim)", maxWidth: 460, margin: "0 auto 20px", lineHeight: 1.55 }}>
            Know someone who&apos;d love calling the scores? Share {brandName} and grow the competition.
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ShareBar url={shareUrl} text={shareText} subject={`${brandName} — World Cup 2026 predictor`} />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--line-soft)" }}>
        <div style={{ ...wrap, padding: "32px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <Brand name={brandName} tagline={brandTagline} />
          <div style={{ display: "flex", gap: 16, fontSize: 13.5 }}>
            <Link href="/leaderboard" style={{ color: "var(--text-dim)", textDecoration: "none" }}>Global board</Link>
            <Link href="/login" style={{ color: "var(--text-dim)", textDecoration: "none" }}>Sign in</Link>
            <Link href="/register" style={{ color: "var(--text-dim)", textDecoration: "none" }}>Join free</Link>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
