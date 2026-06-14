"use client";

import { useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  updateLeagueSettings,
  regenerateJoinCode,
  removeMember,
  deleteLeague,
} from "@/app/actions";
import { Avatar, Icon, ScreenHead, SectionLabel, fmtDay, teamCode } from "@/components/ui";
import { ShareBar } from "@/components/ShareBar";
import { Toast } from "@/components/MatchesScreen";

export type ManageLeague = {
  id: string;
  name: string;
  join_code: string;
  created_by: string | null;
  points_exact: number;
  points_outcome: number;
  submission_mode: "single" | "multiple";
  prizes: string[];
};

export type ManageMember = { user_id: string; display_name: string; points: number };

export type MemberPick = {
  match_id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  result_home: number | null;
  result_away: number | null;
  user_id: string;
  display_name: string;
  pred_home: number;
  pred_away: number;
  points: number | null;
};

// "1st" / "2nd" / "3rd" / "4th" … for prize places.
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const field: CSSProperties = {
  background: "var(--bg-3)",
  border: "1px solid var(--line-soft)",
  color: "var(--text)",
  borderRadius: 10,
  padding: "11px 13px",
  fontSize: 15,
  width: "100%",
  colorScheme: "dark",
  fontFamily: "var(--font-body)",
};
const lab: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".06em",
  color: "var(--text-faint)",
  marginBottom: 6,
  display: "block",
  fontFamily: "var(--font-display)",
};
const card: CSSProperties = {
  border: "1px solid var(--line-soft)",
  borderRadius: 14,
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  background: "var(--bg-2)",
  boxShadow: "var(--shadow)",
};

export function ManageLeagueScreen({
  league,
  members,
  picks = [],
  shareUrl,
}: {
  league: ManageLeague;
  members: ManageMember[];
  picks?: MemberPick[];
  shareUrl?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState(league.join_code);
  const [prizes, setPrizes] = useState<string[]>(league.prizes?.length ? league.prizes : [""]);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Drop blanks before serialising so cleared rows don't persist as prizes.
  const prizesJson = JSON.stringify(prizes.map((p) => p.trim()).filter(Boolean));

  function flash(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  function save(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updateLeagueSettings(formData);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
      flash("Settings saved");
    });
  }

  function regenerate() {
    if (!confirm("Generate a new join code? The old code will stop working.")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("league_id", league.id);
      const res = await regenerateJoinCode(fd);
      if (res && "code" in res && res.code) setCode(res.code);
      router.refresh();
      flash("New join code generated");
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      flash("Join code copied");
    } catch {
      /* clipboard blocked — the code is visible anyway */
    }
  }

  function remove(userId: string, name: string) {
    if (!confirm(`Remove ${name} from this league?`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("league_id", league.id);
      fd.set("user_id", userId);
      const res = await removeMember(fd);
      if (res && "error" in res && res.error) {
        flash(res.error);
        return;
      }
      router.refresh();
      flash("Member removed");
    });
  }

  function destroy() {
    if (!confirm(`Delete "${league.name}"? This removes all its predictions and standings. This cannot be undone.`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("league_id", league.id);
      const res = await deleteLeague(fd);
      if (res && "error" in res && res.error) {
        flash(res.error);
        return;
      }
      router.push("/leagues");
    });
  }

  return (
    <div className="screen-enter">
      <button
        onClick={() => router.push(`/leagues/${league.id}`)}
        className="tap"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-faint)", background: "transparent", border: "none", cursor: "pointer", marginBottom: 8 }}
      >
        <Icon name="chevL" size={16} /> Back to standings
      </button>

      <ScreenHead title="Manage league" sub={league.name} />

      {/* Settings */}
      <form action={save} style={{ ...card, marginBottom: 16 }}>
        <input type="hidden" name="league_id" value={league.id} />
        <div className="display" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", color: "var(--text-faint)", textTransform: "uppercase" }}>
          League settings
        </div>
        <div>
          <label style={lab}>LEAGUE NAME</label>
          <input name="name" defaultValue={league.name} maxLength={60} required style={field} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={lab}>POINTS · EXACT SCORE</label>
            <input name="points_exact" type="number" min={0} defaultValue={league.points_exact} style={field} />
          </div>
          <div>
            <label style={lab}>POINTS · CORRECT RESULT</label>
            <input name="points_outcome" type="number" min={0} defaultValue={league.points_outcome} style={field} />
          </div>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--warn)", margin: 0 }}>
          Changing points only affects matches scored after the change. Re-publishing a result recomputes it.
        </p>

        {/* Prizes — one per finishing place; serialised into a hidden field. */}
        <input type="hidden" name="prizes" value={prizesJson} />
        <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="display" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", color: "var(--text-faint)", textTransform: "uppercase" }}>
            Prizes
          </div>
          {prizes.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="display num" style={{ flexShrink: 0, width: 38, fontSize: 13, fontWeight: 800, color: i < 3 ? ["var(--accent)", "oklch(0.78 0.02 255)", "oklch(0.62 0.07 50)"][i] : "var(--text-faint)" }}>
                {ordinal(i + 1)}
              </span>
              <input
                value={p}
                onChange={(e) => setPrizes((arr) => arr.map((v, j) => (j === i ? e.target.value : v)))}
                maxLength={80}
                placeholder={i === 0 ? "e.g. MVR 1,000 cash" : "Prize (optional)"}
                style={{ ...field, flex: 1 }}
              />
              {prizes.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPrizes((arr) => arr.filter((_, j) => j !== i))}
                  className="chip tap"
                  title="Remove prize"
                  style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", padding: "8px 9px", borderRadius: 9, border: "1px solid var(--line-soft)", color: "var(--neg)" }}
                >
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
          ))}
          {prizes.length < 10 && (
            <button
              type="button"
              onClick={() => setPrizes((arr) => [...arr, ""])}
              className="btn-ghost tap"
              style={{ alignSelf: "flex-start", padding: "8px 12px", borderRadius: 10, fontSize: 13, color: "var(--text-dim)", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Icon name="plus" size={14} /> Add place
            </button>
          )}
          <p style={{ fontSize: 11.5, color: "var(--text-faint)", margin: 0 }}>
            Tell players what they&apos;re competing for. Shown on the league standings. Leave blank for none.
          </p>
        </div>

        {error && <p style={{ color: "var(--neg)", fontSize: 12.5, margin: 0 }}>{error}</p>}
        <button type="submit" disabled={isPending} className="btn-sport tap" style={{ width: "100%", padding: "13px", borderRadius: 13, fontFamily: "var(--font-display)", fontSize: 15, opacity: isPending ? 0.6 : 1 }}>
          {isPending ? "Saving…" : "Save settings"}
        </button>
      </form>

      {/* Join code */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div className="display" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", color: "var(--text-faint)", textTransform: "uppercase" }}>
          Invite players
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={copy}
            className="chip tap"
            title="Copy join code"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 13px", borderRadius: 10, background: "var(--bg-3)", border: "1px solid var(--line-soft)", color: "var(--text)" }}
          >
            <Icon name="ticket" size={15} style={{ color: "var(--accent)" }} />
            <span className="display num" style={{ fontWeight: 800, letterSpacing: ".18em", fontSize: 16 }}>{code}</span>
          </button>
          <button type="button" onClick={regenerate} disabled={isPending} className="btn-ghost tap" style={{ padding: "9px 13px", borderRadius: 10, fontSize: 13, color: "var(--text-dim)" }}>
            Regenerate
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-faint)", margin: 0 }}>Share this code so players can join your league.</p>
        <ShareBar
          url={shareUrl}
          text={`Join my World Cup 2026 league "${league.name}"! Sign up and enter code ${code} to play.`}
          subject={`Join my league "${league.name}"`}
        />
      </div>

      {/* Participants */}
      <SectionLabel right={<span style={{ fontSize: 12, color: "var(--text-faint)" }}>{members.length} total</span>}>Participants</SectionLabel>
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)", borderRadius: 16, overflow: "hidden", marginBottom: 22 }}>
        {members.map((m, i) => {
          const isOwner = m.user_id === league.created_by;
          return (
            <div key={m.user_id} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 15px", borderTop: i === 0 ? "none" : "1px solid var(--line-soft)" }}>
              <Avatar name={m.display_name} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="display" style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {m.display_name}
                </div>
                <div style={{ fontSize: 11.5, color: isOwner ? "var(--accent)" : "var(--text-faint)" }}>
                  {isOwner ? "Owner · " : ""}{m.points} pts
                </div>
              </div>
              {!isOwner && (
                <button
                  type="button"
                  onClick={() => remove(m.user_id, m.display_name)}
                  disabled={isPending}
                  className="chip tap"
                  title="Remove member"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 9px", borderRadius: 9, border: "1px solid var(--line-soft)", color: "var(--neg)", fontSize: 12 }}
                >
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Member picks (locked matches only) */}
      <MemberPicks picks={picks} ownerId={league.created_by} />

      {/* Danger zone */}
      <div style={{ border: "1px solid color-mix(in oklab, var(--neg) 40%, var(--line-soft))", borderRadius: 14, padding: 14 }}>
        <div className="display" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", color: "var(--neg)", textTransform: "uppercase", marginBottom: 10 }}>
          Danger zone
        </div>
        <button type="button" onClick={destroy} disabled={isPending} className="tap" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 16px", borderRadius: 11, background: "color-mix(in oklab, var(--neg) 16%, transparent)", color: "var(--neg)", border: "1px solid color-mix(in oklab, var(--neg) 40%, transparent)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "var(--font-display)" }}>
          <Icon name="trash" size={15} /> Delete this league
        </button>
      </div>

      {toast && <Toast msg={toast} />}
    </div>
  );
}

/* ── Member picks, grouped by match (only matches that have locked) ── */
function MemberPicks({ picks, ownerId }: { picks: MemberPick[]; ownerId: string | null }) {
  // picks arrive ordered by kickoff asc, then name — preserve that grouping.
  const groups: { meta: MemberPick; rows: MemberPick[] }[] = [];
  const index = new Map<string, number>();
  for (const p of picks) {
    let i = index.get(p.match_id);
    if (i === undefined) {
      i = groups.length;
      index.set(p.match_id, i);
      groups.push({ meta: p, rows: [] });
    }
    groups[i].rows.push(p);
  }

  return (
    <>
      <SectionLabel right={<span style={{ fontSize: 12, color: "var(--text-faint)" }}>{groups.length} match{groups.length === 1 ? "" : "es"}</span>}>
        Submitted picks
      </SectionLabel>
      {groups.length === 0 ? (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)", borderRadius: 14, padding: "16px 15px", marginBottom: 22, fontSize: 13, color: "var(--text-faint)" }}>
          Picks appear here once a match locks (45 min after kickoff). Nothing locked yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
          {groups.map((g, gi) => {
            const m = g.meta;
            const hasResult = m.result_home !== null && m.result_away !== null;
            return (
              <details key={m.match_id} open={gi === 0} style={{ background: "var(--bg-2)", border: "1px solid var(--line-soft)", borderRadius: 14, overflow: "hidden" }}>
                <summary style={{ listStyle: "none", cursor: "pointer", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="det-chevron" style={{ display: "inline-flex", flexShrink: 0, transition: "transform .15s" }}>
                    <Icon name="chevR" size={15} style={{ color: "var(--text-faint)" }} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="display" style={{ fontSize: 14.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {teamCode(m.home_team)} <span style={{ color: "var(--text-faint)" }}>v</span> {teamCode(m.away_team)}
                    </div>
                    <div suppressHydrationWarning style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 1 }}>
                      {fmtDay(new Date(m.kickoff_time).getTime())} · {g.rows.length} pick{g.rows.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  {hasResult ? (
                    <span className="num" style={{ fontFamily: "var(--font-score)", fontWeight: 800, fontSize: 16, color: "var(--accent)" }}>
                      {m.result_home}–{m.result_away}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", color: "var(--text-faint)", textTransform: "uppercase" }}>No result</span>
                  )}
                </summary>
                <div style={{ borderTop: "1px solid var(--line-soft)" }}>
                  {g.rows.map((r) => (
                    <div key={r.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderTop: "1px solid var(--line-soft)" }}>
                      <Avatar name={r.display_name} size={28} />
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.display_name}
                        {r.user_id === ownerId && <span style={{ color: "var(--accent)", fontSize: 11, marginLeft: 6 }}>Owner</span>}
                      </div>
                      <span className="num" style={{ fontFamily: "var(--font-score)", fontWeight: 800, fontSize: 15, color: "var(--text)" }}>
                        {r.pred_home}–{r.pred_away}
                      </span>
                      {r.points !== null && (
                        <span style={{ fontSize: 11, fontWeight: 800, minWidth: 38, textAlign: "right", color: r.points > 0 ? "var(--pos)" : "var(--text-faint)" }}>
                          {r.points > 0 ? `+${r.points}` : "0"} pts
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </>
  );
}
