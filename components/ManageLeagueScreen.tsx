"use client";

import { useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  updateLeagueSettings,
  regenerateJoinCode,
  removeMember,
  deleteLeague,
} from "@/app/actions";
import { Avatar, Icon, ScreenHead, SectionLabel } from "@/components/ui";
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
};

export type ManageMember = { user_id: string; display_name: string; points: number };

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
  shareUrl,
}: {
  league: ManageLeague;
  members: ManageMember[];
  shareUrl?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState(league.join_code);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
