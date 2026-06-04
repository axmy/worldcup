"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { LeaderboardRow, LeagueSummary, Match } from "@/lib/types";
import { createMatch, updateMatch, updateResult, deleteMatch, updateSettings, deleteLeague, importFixtures, syncResultsNow, resetData, seedFixtures, clearScores, clearPredictions, removeLeagues, removePlayers } from "@/app/actions";
import {
  Avatar,
  Countdown,
  Crest,
  Empty,
  Icon,
  ScreenHead,
  SectionLabel,
  StatusPill,
  TOURNAMENT_TZ,
  fmtKick,
  matchStatus,
  useNow,
} from "@/components/ui";
import { Toast } from "@/components/MatchesScreen";

export type Settings = {
  tournament_timezone: string;
  points_exact: number;
  points_outcome: number;
  submission_mode: "single" | "multiple";
  brand_name: string;
  brand_tagline: string;
  login_headline: string;
  login_subtitle: string;
  theme: "dark" | "light";
  accent: string;
};

// Medium/deep hues chosen to pair with white button text (--accent-ink: #fff).
const ACCENTS: [string, string][] = [
  ["Indigo", "oklch(0.58 0.21 264)"],
  ["Blue", "oklch(0.6 0.17 245)"],
  ["Violet", "oklch(0.55 0.22 300)"],
  ["Teal", "oklch(0.6 0.12 200)"],
  ["Rose", "oklch(0.6 0.22 12)"],
  ["Emerald", "oklch(0.6 0.15 160)"],
];

function StatTile({ big, label, accent }: { big: number; label: string; accent?: boolean }) {
  return (
    <div className="card-sport" style={{ background: accent ? "var(--grad-accent)" : undefined, border: accent ? "1px solid transparent" : undefined, borderRadius: 18, padding: "16px 10px", textAlign: "center", boxShadow: accent ? "var(--glow-accent)" : "var(--shadow)" }}>
      <div className="h-hero num" style={{ fontSize: 36, lineHeight: 0.9, color: accent ? "var(--accent-ink)" : "var(--text)" }}>{big}</div>
      <div className="display" style={{ fontSize: 10, letterSpacing: ".14em", fontWeight: 800, marginTop: 6, textTransform: "uppercase", color: accent ? "var(--accent-ink)" : "var(--text-faint)", opacity: accent ? 0.85 : 1 }}>{label}</div>
    </div>
  );
}

const sel: CSSProperties = { background: "var(--bg-3)", border: "1px solid var(--line-soft)", color: "var(--text)", borderRadius: 10, padding: "10px 11px", fontSize: 14, width: "100%", colorScheme: "dark", fontFamily: "var(--font-body)" };
const lab: CSSProperties = { fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em", color: "var(--text-faint)", marginBottom: 6, display: "block", fontFamily: "var(--font-display)" };

export function AdminScreen({ matches, settings, players, leagues, leagueCounts, totalUsers }: { matches: Match[]; settings: Settings; players: LeaderboardRow[]; leagues: LeagueSummary[]; leagueCounts: Record<string, number>; totalUsers: number }) {
  const now = useNow(1000) ?? Date.now();
  const [tab, setTab] = useState<"fixtures" | "results" | "leagues" | "players" | "settings" | "ops">("fixtures");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Match | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const openN = matches.filter((m) => matchStatus(m, now) === "open").length;
  const awaiting = matches.filter((m) => matchStatus(m, now) === "locked").length;
  const scored = matches.filter((m) => matchStatus(m, now) === "final").length;

  function flash(msg: string) {
    setToast(msg);
    clearTimeout((window as { __wcToast?: number }).__wcToast);
    (window as { __wcToast?: number }).__wcToast = window.setTimeout(() => setToast(null), 2400);
  }

  const tabs: [typeof tab, string][] = [
    ["fixtures", "Fixtures"],
    ["results", "Results"],
    ["leagues", "Leagues"],
    ["players", "Players"],
    ["settings", "Settings"],
    ["ops", "Ops"],
  ];

  return (
    <div className="screen-enter">
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: "color-mix(in oklab, var(--accent) 16%, transparent)", color: "var(--accent)", fontSize: 11, fontWeight: 800, letterSpacing: ".08em", fontFamily: "var(--font-display)" }}>
          <Icon name="cog" size={13} /> ADMIN
        </span>
      </div>
      <ScreenHead title="Organizer" sub="Manage fixtures, deadlines & results" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
        <StatTile big={openN} label="OPEN" accent />
        <StatTile big={awaiting} label="AWAITING" />
        <StatTile big={scored} label="SCORED" />
      </div>

      <div style={{ display: "flex", gap: 6, background: "var(--bg-2)", padding: 5, borderRadius: 13, marginBottom: 18, border: "1px solid var(--line-soft)" }}>
        {tabs.map(([k, label]) => (
          <button key={k} className="tap" onClick={() => setTab(k)} style={{ flex: 1, padding: "9px 6px", borderRadius: 9, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, letterSpacing: ".03em", textTransform: "uppercase", background: tab === k ? "var(--grad-accent)" : "transparent", color: tab === k ? "var(--accent-ink)" : "var(--text-dim)", boxShadow: tab === k ? "var(--glow-accent)" : "none" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "fixtures" && <Fixtures matches={matches} now={now} onNew={() => setCreating(true)} onEdit={setEditing} onDeleted={() => flash("Fixture deleted")} onFlash={flash} />}
      {tab === "results" && <Results matches={matches} now={now} onPublished={() => flash("Result published — players scored")} onFlash={flash} />}
      {tab === "leagues" && <Leagues leagues={leagues} onDeleted={() => flash("League deleted")} />}
      {tab === "players" && <Players players={players} leagueCounts={leagueCounts} totalUsers={totalUsers} />}
      {tab === "settings" && <SettingsForm settings={settings} onSaved={() => flash("Settings saved")} />}
      {tab === "ops" && <Ops onFlash={flash} />}

      {(creating || editing) && (
        <MatchSheet
          match={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); flash(editing ? "Fixture updated" : "Fixture published"); }}
        />
      )}
      {toast && <Toast msg={toast} />}
    </div>
  );
}

/* ── FIXTURES ── */
const fmtWindow = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TOURNAMENT_TZ });

function Fixtures({ matches, now, onNew, onEdit, onDeleted, onFlash }: { matches: Match[]; now: number; onNew: () => void; onEdit: (m: Match) => void; onDeleted: () => void; onFlash: (msg: string) => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function del(id: string) {
    const fd = new FormData();
    fd.set("match_id", id);
    startTransition(async () => {
      await deleteMatch(fd);
      router.refresh();
      onDeleted();
    });
  }

  function importNow() {
    startTransition(async () => {
      const res = await importFixtures();
      if (res && "error" in res && res.error) onFlash(res.error);
      else if (res && "ok" in res) onFlash(`Imported ${res.inserted} new, updated ${res.updated} fixtures`);
      router.refresh();
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className="btn-sport tap" onClick={onNew} style={{ flex: 1, padding: "13px", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "var(--font-display)", fontSize: 15 }}>
          <Icon name="plusC" size={18} stroke={2.4} /> Add fixture
        </button>
        <button className="btn-ghost tap" onClick={importNow} disabled={isPending} title="Import the schedule from API-Football" style={{ padding: "0 16px", borderRadius: 13, display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
          <Icon name="cal" size={16} /> {isPending ? "Importing…" : "Import"}
        </button>
      </div>
      {matches.length === 0 && <Empty icon="cal" text="No fixtures yet." />}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {matches.map((m) => {
          const status = matchStatus(m, now);
          const deadlineMs = new Date(m.submission_deadline).getTime();
          return (
            <div key={m.id} style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)", borderRadius: 15, padding: "13px 15px", boxShadow: "var(--shadow)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <Crest name={m.home_team} size={32} />
                  <span className="display" style={{ fontWeight: 800, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.home_team} <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>v</span> {m.away_team}
                  </span>
                  <Crest name={m.away_team} size={32} />
                </div>
                <StatusPill status={status} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11.5, color: "var(--text-faint)" }}>
                <span suppressHydrationWarning style={{ minWidth: 0, lineHeight: 1.5 }}>
                  Kickoff {fmtKick(new Date(m.kickoff_time).getTime())}
                  <br />
                  Opens {m.submission_open ? fmtWindow(m.submission_open) : "immediately"} · Closes {fmtWindow(m.submission_deadline)}
                  {status === "open" && <> · <Countdown to={deadlineMs} prefix="closes in " style={{ fontSize: 11.5 }} /></>}
                  {status === "upcoming" && m.submission_open && <> · <Countdown to={new Date(m.submission_open).getTime()} prefix="opens in " style={{ fontSize: 11.5 }} /></>}
                </span>
                <span style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
                  <button className="chip tap" onClick={() => onEdit(m)} title="Edit fixture" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 8, border: "1px solid var(--line-soft)", color: "var(--text-dim)", fontSize: 12 }}>
                    <Icon name="cog" size={13} /> Edit
                  </button>
                  <button className="chip tap" onClick={() => del(m.id)} title="Delete fixture" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 8, border: "1px solid var(--line-soft)", color: "var(--neg)", fontSize: 12 }}>
                    <Icon name="trash" size={13} />
                  </button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── RESULTS ── */
function MiniStep({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button type="button" className="step-btn" disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))} style={{ width: 32, height: 32, borderRadius: 9, background: "var(--bg-3)", display: "grid", placeItems: "center" }}>
        <Icon name="minus" size={16} stroke={2.6} />
      </button>
      <span className="display num" style={{ fontSize: 28, fontWeight: 800, minWidth: 26, textAlign: "center" }}>{value}</span>
      <button type="button" className="step-btn" disabled={value >= 20} onClick={() => onChange(value + 1)} style={{ width: 32, height: 32, borderRadius: 9, background: "var(--bg-3)", display: "grid", placeItems: "center" }}>
        <Icon name="plus" size={16} stroke={2.6} />
      </button>
    </div>
  );
}

function ResultEntry({ match, onPublished }: { match: Match; onPublished: () => void }) {
  const router = useRouter();
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [isPending, startTransition] = useTransition();

  function publish() {
    const fd = new FormData();
    fd.set("match_id", match.id);
    fd.set("home_score", String(a));
    fd.set("away_score", String(b));
    startTransition(async () => {
      await updateResult(fd);
      router.refresh();
      onPublished();
    });
  }

  return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)", borderRadius: 15, padding: "14px 15px", boxShadow: "var(--shadow)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, fontSize: 11.5, color: "var(--text-faint)" }}>
        <span suppressHydrationWarning>Kicked off {fmtKick(new Date(match.kickoff_time).getTime())}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Crest name={match.home_team} size={42} />
          <span className="display" style={{ fontWeight: 800, fontSize: 15, textAlign: "center" }}>{match.home_team}</span>
          <MiniStep value={a} onChange={setA} />
        </div>
        <span className="display" style={{ fontSize: 26, color: "var(--text-faint)", fontWeight: 600 }}>:</span>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Crest name={match.away_team} size={42} />
          <span className="display" style={{ fontWeight: 800, fontSize: 15, textAlign: "center" }}>{match.away_team}</span>
          <MiniStep value={b} onChange={setB} />
        </div>
      </div>
      <button className="btn-sport tap" disabled={isPending} onClick={publish} style={{ width: "100%", marginTop: 14, padding: "12px", borderRadius: 12, fontFamily: "var(--font-display)", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: isPending ? 0.6 : 1 }}>
        <Icon name="check" size={17} stroke={2.6} /> {isPending ? "Publishing…" : "Publish result & score players"}
      </button>
    </div>
  );
}

function Results({ matches, now, onPublished, onFlash }: { matches: Match[]; now: number; onPublished: () => void; onFlash: (msg: string) => void }) {
  const router = useRouter();
  const [syncing, startSync] = useTransition();
  const pending = matches.filter((m) => matchStatus(m, now) === "locked");
  const done = matches.filter((m) => m.home_score !== null && m.away_score !== null);

  function syncNow() {
    startSync(async () => {
      const res = await syncResultsNow();
      if (res && "error" in res && res.error) onFlash(res.error);
      else if (res && "ok" in res) onFlash(res.updated > 0 ? `Synced ${res.updated} result${res.updated === 1 ? "" : "s"}` : "No new finished matches");
      router.refresh();
    });
  }

  return (
    <div>
      <button className="btn-ghost tap" onClick={syncNow} disabled={syncing} title="Fetch final scores from API-Football now" style={{ width: "100%", padding: "11px", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, color: "var(--text-dim)", marginBottom: 16 }}>
        <Icon name="bolt" size={16} stroke={2.4} /> {syncing ? "Syncing…" : "Sync results now"}
      </button>
      <SectionLabel>Awaiting result · {pending.length}</SectionLabel>
      {pending.length === 0 && <Empty icon="check" text="No matches awaiting a result." />}
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 24 }}>
        {pending.map((m) => <ResultEntry key={m.id} match={m} onPublished={onPublished} />)}
      </div>
      {done.length > 0 && (
        <>
          <SectionLabel>Published · {done.length}</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {done.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 15px", background: "var(--bg-2)", border: "1px solid var(--line-soft)", borderRadius: 13 }}>
                <span className="display" style={{ fontWeight: 700, fontSize: 15 }}>{m.home_team} v {m.away_team}</span>
                <span className="display num" style={{ fontWeight: 800, fontSize: 18 }}>{m.home_score}–{m.away_score}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── PLAYERS (global user list) ── */
function Players({ players, leagueCounts, totalUsers }: { players: LeaderboardRow[]; leagueCounts: Record<string, number>; totalUsers: number }) {
  const capped = totalUsers > players.length;
  return (
    <div>
      <SectionLabel right={<span style={{ fontSize: 12, color: "var(--text-faint)" }}>{totalUsers.toLocaleString()} user{totalUsers === 1 ? "" : "s"}</span>}>All registered users</SectionLabel>
      <p style={{ fontSize: 11.5, color: "var(--text-faint)", margin: "-4px 2px 14px" }}>
        Everyone signed up on the platform, with the leagues they&apos;ve joined and total points across all leagues.
        {capped && ` Showing the top ${players.length} by points.`}
      </p>
      {players.length === 0 && <Empty icon="user" text="No users registered yet." />}
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)", borderRadius: 16, overflow: "hidden" }}>
        {players.map((u, i) => {
          const leagues = leagueCounts[u.user_id] ?? 0;
          return (
            <div key={u.user_id} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 15px", borderTop: i === 0 ? "none" : "1px solid var(--line-soft)" }}>
              <Avatar name={u.display_name} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="display" style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.display_name}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                  {leagues} league{leagues === 1 ? "" : "s"} · {u.scored_matches} scored · {u.total_points} pts
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── LEAGUES ── */
function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="chip tap"
      title="Copy join code"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked — code is visible */
        }
      }}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 9, border: "1px solid var(--line-soft)", background: "var(--bg-3)", color: "var(--text)" }}
    >
      <Icon name={copied ? "check" : "ticket"} size={13} style={{ color: "var(--accent)" }} />
      <span className="display num" style={{ fontWeight: 800, letterSpacing: ".16em", fontSize: 13.5 }}>{copied ? "COPIED" : code}</span>
    </button>
  );
}

// Organizers create & manage their own leagues now; Admin keeps a read-only
// roster with a delete for moderation. (The global league can't be deleted.)
function Leagues({ leagues, onDeleted }: { leagues: LeagueSummary[]; onDeleted: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function del(id: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("league_id", id);
      await deleteLeague(fd);
      router.refresh();
      onDeleted();
    });
  }

  return (
    <div>
      <SectionLabel right={<span style={{ fontSize: 12, color: "var(--text-faint)" }}>{leagues.length} total</span>}>All leagues · moderation</SectionLabel>
      <p style={{ fontSize: 11.5, color: "var(--text-faint)", margin: "-4px 2px 14px" }}>
        Players create and run their own leagues. Remove one here only for moderation.
      </p>
      {leagues.length === 0 && <Empty icon="trophy" text="No leagues yet." />}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {leagues.map((l) => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-2)", border: "1px solid var(--line-soft)", borderRadius: 14, padding: "12px 14px", boxShadow: "var(--shadow)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="display" style={{ fontSize: 15.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {l.name}
                {l.is_global && <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 800, letterSpacing: ".1em", color: "var(--accent)" }}>GLOBAL</span>}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>
                {l.member_count} member{l.member_count === 1 ? "" : "s"} · {l.points_exact}/{l.points_outcome} pts · {l.submission_mode}
              </div>
            </div>
            <CopyCode code={l.join_code} />
            {!l.is_global && (
              <button className="chip tap" onClick={() => del(l.id)} disabled={isPending} title="Delete league" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 9px", borderRadius: 9, border: "1px solid var(--line-soft)", color: "var(--neg)", fontSize: 12 }}>
                <Icon name="trash" size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── SETTINGS ── */
function SettingsForm({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [theme, setTheme] = useState<"dark" | "light">(settings.theme);
  const [accent, setAccent] = useState(settings.accent);

  function save(formData: FormData) {
    startTransition(async () => {
      await updateSettings(formData);
      router.refresh();
      onSaved();
    });
  }

  return (
    <form action={save} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Theme (white-label) ── */}
      <div style={{ border: "1px solid var(--line-soft)", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="display" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", color: "var(--text-faint)", textTransform: "uppercase" }}>Theme · applied across the whole app</div>
        <input type="hidden" name="theme" value={theme} />
        <input type="hidden" name="accent" value={accent} />

        <div>
          <label style={lab}>MODE</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 5, background: "var(--bg-3)", borderRadius: 12 }}>
            {(["dark", "light"] as const).map((m) => (
              <button key={m} type="button" className="tap" onClick={() => setTheme(m)}
                style={{ padding: "9px", borderRadius: 9, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, textTransform: "capitalize",
                  background: theme === m ? "var(--accent)" : "transparent", color: theme === m ? "var(--accent-ink)" : "var(--text-dim)" }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={lab}>ACCENT</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            {ACCENTS.map(([name, val]) => {
              const active = accent === val;
              return (
                <button key={val} type="button" title={name} onClick={() => setAccent(val)} className="tap"
                  style={{ width: 34, height: 34, borderRadius: "50%", background: val, flexShrink: 0,
                    boxShadow: active ? "0 0 0 3px var(--bg-2), 0 0 0 5px var(--text)" : "inset 0 0 0 1px rgba(255,255,255,.2)" }} />
              );
            })}
          </div>
          <input value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="oklch(0.87 0.2 128) or #aaff00" style={sel} />
          <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 6 }}>Pick a swatch or paste any CSS color (oklch / hex / rgb).</p>
        </div>
      </div>

      {/* ── Branding (white-label) ── */}
      {/* ── Branding (white-label) ── */}
      <div style={{ border: "1px solid var(--line-soft)", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="display" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", color: "var(--text-faint)", textTransform: "uppercase" }}>Branding · shown on the landing, login &amp; header</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={lab}>BRAND NAME</label>
            <input name="brand_name" defaultValue={settings.brand_name} placeholder="Kickoff" required style={sel} />
          </div>
          <div>
            <label style={lab}>TAGLINE</label>
            <input name="brand_tagline" defaultValue={settings.brand_tagline} placeholder="WC26 · Predictor" style={sel} />
          </div>
        </div>
        <div>
          <label style={lab}>LOGIN HEADLINE</label>
          <input name="login_headline" defaultValue={settings.login_headline} placeholder="Call the scoreline. Own the board." style={sel} />
        </div>
        <div>
          <label style={lab}>LOGIN SUBTITLE</label>
          <textarea name="login_subtitle" defaultValue={settings.login_subtitle} rows={2} style={{ ...sel, resize: "vertical", lineHeight: 1.4 }} />
        </div>
      </div>

      <div style={{ border: "1px solid var(--line-soft)", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="display" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", color: "var(--text-faint)", textTransform: "uppercase" }}>
          Prediction rules
        </div>

        <div>
          <label style={lab}>SUBMISSION RULE · APPLIES TO EVERYONE</label>
          <select name="submission_mode" defaultValue={settings.submission_mode} style={sel}>
            <option value="multiple">Multiple — edit picks freely until the deadline</option>
            <option value="single">Single — first pick locks, no edits</option>
          </select>
          <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 6 }}>
            Each player makes one prediction per match (counts in every league they join), so this edit rule is platform-wide.
          </p>
        </div>

        <p style={{ fontSize: 11.5, color: "var(--text-faint)", margin: "4px 0 -2px" }}>
          Points below seed new leagues (organizers can override per league):
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={lab}>POINTS · EXACT SCORE</label>
            <input name="points_exact" type="number" min={0} defaultValue={settings.points_exact} style={sel} />
          </div>
          <div>
            <label style={lab}>POINTS · CORRECT RESULT</label>
            <input name="points_outcome" type="number" min={0} defaultValue={settings.points_outcome} style={sel} />
          </div>
        </div>
      </div>

      <div>
        <label style={lab}>TOURNAMENT TIMEZONE (IANA)</label>
        <input name="tournament_timezone" defaultValue={settings.tournament_timezone} placeholder="Indian/Maldives" style={sel} />
      </div>

      <button type="submit" disabled={isPending} className="btn-sport tap" style={{ width: "100%", padding: "13px", borderRadius: 13, fontFamily: "var(--font-display)", fontSize: 15, opacity: isPending ? 0.6 : 1 }}>
        {isPending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}

/* ── OPS (maintenance) ── */
function Ops({ onFlash }: { onFlash: (msg: string) => void }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [confirm, setConfirm] = useState("");

  function seedBuiltIn() {
    startTransition(async () => {
      const res = await seedFixtures();
      if (res && "error" in res && res.error) onFlash(res.error);
      else if (res && "ok" in res) {
        const n = res.inserted ?? 0;
        onFlash(n > 0 ? `Seeded ${n} fixtures` : "Fixtures already exist — reset first");
      }
      router.refresh();
    });
  }

  function seed() {
    startTransition(async () => {
      const res = await importFixtures();
      if (res && "error" in res && res.error) onFlash(res.error);
      else if (res && "ok" in res) onFlash(`Imported ${res.inserted} new, updated ${res.updated} fixtures`);
      router.refresh();
    });
  }

  function sync() {
    startTransition(async () => {
      const res = await syncResultsNow();
      if (res && "error" in res && res.error) onFlash(res.error);
      else if (res && "ok" in res) onFlash(res.updated > 0 ? `Synced ${res.updated} result${res.updated === 1 ? "" : "s"}` : "No new finished matches");
      router.refresh();
    });
  }

  function reset() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("confirm", confirm);
      const res = await resetData(fd);
      if (res && "error" in res && res.error) onFlash(res.error);
      else {
        setConfirm("");
        onFlash("Data reset — re-seed fixtures to start over");
      }
      router.refresh();
    });
  }

  // Targeted resets, each behind a confirm() dialog.
  function run(label: string, prompt: string, fn: () => Promise<{ error?: string; count?: number; ok?: boolean }>) {
    if (!window.confirm(prompt)) return;
    startTransition(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) onFlash(res.error);
      else onFlash(`${label}: ${res.count ?? 0}`);
      router.refresh();
    });
  }

  const card: CSSProperties = { border: "1px solid var(--line-soft)", borderRadius: 14, padding: 16, background: "var(--bg-2)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 10 };
  const dangerBtn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 10, fontSize: 13, color: "var(--neg)", border: "1px solid color-mix(in oklab, var(--neg) 35%, var(--line-soft))" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={card}>
        <div className="display" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", color: "var(--text-faint)", textTransform: "uppercase" }}>Seed fixtures</div>
        <p style={{ fontSize: 12.5, color: "var(--text-faint)", margin: 0 }}>Load the schedule after a reset — 72 group fixtures with real times plus 32 knockout placeholders (closed; edit teams/times as results come in). No API needed; the API import also fills in provider ids for auto-scoring.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="btn-sport tap" onClick={seedBuiltIn} disabled={busy} style={{ padding: "10px 18px", borderRadius: 11, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="cal" size={16} /> {busy ? "Working…" : "Seed built-in schedule"}
          </button>
          <button className="btn-ghost tap" onClick={seed} disabled={busy} title="Requires API-Football key" style={{ padding: "10px 16px", borderRadius: 11, fontSize: 13.5, color: "var(--text-dim)", display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Icon name="bolt" size={15} /> Import from API
          </button>
        </div>
      </div>

      <div style={card}>
        <div className="display" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", color: "var(--text-faint)", textTransform: "uppercase" }}>Update scores</div>
        <p style={{ fontSize: 12.5, color: "var(--text-faint)", margin: 0 }}>Fetch final scores for matches that have finished and score everyone. Runs automatically on a schedule too.</p>
        <button className="btn-sport tap" onClick={sync} disabled={busy} style={{ alignSelf: "flex-start", padding: "10px 18px", borderRadius: 11, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="bolt" size={16} stroke={2.4} /> {busy ? "Working…" : "Sync results now"}
        </button>
      </div>

      <div style={card}>
        <div className="display" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", color: "var(--text-faint)", textTransform: "uppercase" }}>Targeted resets</div>
        <p style={{ fontSize: 12.5, color: "var(--text-faint)", margin: 0 }}>Each clears just one thing. All keep the admin account and the global league.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="btn-ghost tap" disabled={busy} onClick={() => run("Scores cleared", "Clear all match scores? Predictions stay but become unscored.", clearScores)} style={dangerBtn}>
            <Icon name="x" size={14} /> Clear scores
          </button>
          <button className="btn-ghost tap" disabled={busy} onClick={() => run("Predictions deleted", "Delete ALL predictions for every league?", clearPredictions)} style={dangerBtn}>
            <Icon name="trash" size={14} /> Delete predictions
          </button>
          <button className="btn-ghost tap" disabled={busy} onClick={() => run("Leagues deleted", "Delete all user-created leagues (the global league is kept)?", removeLeagues)} style={dangerBtn}>
            <Icon name="trophy" size={14} /> Delete leagues
          </button>
          <button className="btn-ghost tap" disabled={busy} onClick={() => run("Players removed", "Remove ALL players? This deletes every non-admin account, their predictions and memberships. Cannot be undone.", removePlayers)} style={dangerBtn}>
            <Icon name="user" size={14} /> Remove players
          </button>
        </div>
      </div>

      <div style={{ ...card, border: "1px solid color-mix(in oklab, var(--neg) 40%, var(--line-soft))" }}>
        <div className="display" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", color: "var(--neg)", textTransform: "uppercase" }}>Danger zone · reset everything</div>
        <p style={{ fontSize: 12.5, color: "var(--text-faint)", margin: 0 }}>
          Deletes <b>all predictions, results, user-created leagues and fixtures</b>. Keeps user accounts and the global league. This cannot be undone.
        </p>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type RESET to confirm"
          style={{ ...sel, maxWidth: 260 }}
        />
        <button
          onClick={reset}
          disabled={busy || confirm !== "RESET"}
          className="tap"
          style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 11, background: "color-mix(in oklab, var(--neg) 16%, transparent)", color: "var(--neg)", border: "1px solid color-mix(in oklab, var(--neg) 40%, transparent)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "var(--font-display)", opacity: confirm === "RESET" && !busy ? 1 : 0.5 }}
        >
          <Icon name="trash" size={15} /> {busy ? "Resetting…" : "Reset all data"}
        </button>
      </div>
    </div>
  );
}

/* ── CREATE / EDIT MATCH SHEET ── */
// ISO timestamp → value for a <input type="datetime-local"> (local wall time).
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function MatchSheet({ match, onClose, onSaved }: { match: Match | null; onClose: () => void; onSaved: () => void }) {
  const router = useRouter();
  const editing = !!match;
  const [home, setHome] = useState(match?.home_team ?? "");
  const [away, setAway] = useState(match?.away_team ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const valid = home.trim() && away.trim() && home.trim().toLowerCase() !== away.trim().toLowerCase();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (match) {
          formData.set("match_id", match.id);
          await updateMatch(formData);
        } else {
          await createMatch(formData);
        }
        router.refresh();
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save fixture.");
      }
    });
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.55)", backdropFilter: "blur(3px)", animation: "overlayIn .2s ease", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--bg-2)", borderRadius: "24px 24px 0 0", border: "1px solid var(--line)", borderBottom: "none", padding: "10px 18px 26px", animation: "slideUp .32s cubic-bezier(.2,.8,.25,1)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ width: 38, height: 4, borderRadius: 99, background: "var(--line)", margin: "4px auto 16px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 className="display" style={{ fontSize: 20, fontWeight: 800 }}>{editing ? "Edit fixture" : "New fixture"}</h2>
          <button className="btn-ghost tap" onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", color: "var(--text-dim)" }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <form action={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "end" }}>
            <div>
              <label style={lab}>HOME</label>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><Crest name={home || "?"} size={48} /></div>
              <input name="home_team" value={home} onChange={(e) => setHome(e.target.value)} placeholder="Home team" style={sel} />
            </div>
            <span className="display" style={{ fontSize: 18, color: "var(--text-faint)", paddingBottom: 10 }}>v</span>
            <div>
              <label style={lab}>AWAY</label>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><Crest name={away || "?"} size={48} /></div>
              <input name="away_team" value={away} onChange={(e) => setAway(e.target.value)} placeholder="Away team" style={sel} />
            </div>
          </div>
          {!valid && (home || away) && <p style={{ color: "var(--neg)", fontSize: 12.5, textAlign: "center" }}>Enter two different team names.</p>}

          <div><label style={lab}>KICKOFF (LOCAL TIME)</label>
            <input name="kickoff_time" type="datetime-local" required defaultValue={toLocalInput(match?.kickoff_time)} style={sel} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={lab}>SUBMISSIONS OPEN</label>
              <input name="submission_open" type="datetime-local" defaultValue={toLocalInput(match?.submission_open)} style={sel} />
            </div>
            <div><label style={lab}>SUBMISSIONS CLOSE</label>
              <input name="submission_close" type="datetime-local" required defaultValue={toLocalInput(match?.submission_deadline)} style={sel} />
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
            Players can submit and edit picks only between <b>open</b> and <b>close</b>. Leave <b>open</b> blank to accept picks immediately. <b>Close</b> is the prediction deadline.
          </p>

          {error && <p style={{ color: "var(--neg)", fontSize: 12.5, textAlign: "center" }}>{error}</p>}

          <button type="submit" className="btn-sport tap" disabled={!valid || isPending} style={{ width: "100%", padding: "14px", borderRadius: 13, fontFamily: "var(--font-display)", fontSize: 15.5, opacity: valid && !isPending ? 1 : 0.5 }}>
            {isPending ? "Saving…" : editing ? "Save changes" : "Publish fixture"}
          </button>
        </form>
      </div>
    </div>
  );
}
