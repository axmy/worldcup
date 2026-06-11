"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LeagueSummary } from "@/lib/types";
import { joinLeague, joinGlobal } from "@/app/actions";
import { CreateLeagueForm } from "@/components/CreateLeagueForm";
import { Empty, Icon, ScreenHead, fmtDeadline } from "@/components/ui";

type JoinState = { error?: string } | null;

// Small pill used to mark the global league and leagues you own.
function Tag({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span
      className="display"
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        padding: "3px 7px",
        borderRadius: 6,
        background: accent ? "var(--grad-accent)" : "color-mix(in oklab, var(--accent) 16%, transparent)",
        color: accent ? "var(--accent-ink)" : "var(--accent)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// Small icon + text chip describing a league's rules/deadline.
function Meta({ icon, text }: { icon: string; text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-dim)", background: "var(--bg-3)", border: "1px solid var(--line-soft)", borderRadius: 7, padding: "3px 8px", whiteSpace: "nowrap" }}>
      <Icon name={icon} size={12.5} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
      {text}
    </span>
  );
}

export function LeaguesScreen({ leagues, meId, inGlobal, deadline }: { leagues: LeagueSummary[]; meId: string; inGlobal: boolean; deadline: { type: string; value: string } }) {
  const router = useRouter();
  const [joiningGlobal, startJoinGlobal] = useTransition();
  const [state, action, pending] = useActionState(
    async (_prev: JoinState, fd: FormData): Promise<JoinState> => {
      const res = await joinLeague(fd);
      return res && "error" in res ? { error: res.error } : null;
    },
    null,
  );

  function rejoinGlobal() {
    startJoinGlobal(async () => {
      await joinGlobal();
      router.refresh();
    });
  }

  return (
    <div className="screen-enter">
      <ScreenHead
        title="Leagues"
        sub={leagues.length ? `You're in ${leagues.length} league${leagues.length === 1 ? "" : "s"}` : "Create or join a league to compete"}
      />

      {!inGlobal && (
        <div
          className="card-sport"
          style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between", padding: "14px 16px", marginBottom: 14, borderRadius: 16, background: "linear-gradient(120deg, color-mix(in oklab, oklch(0.62 0.17 150) 24%, var(--bg-2)), var(--bg-2))" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <Icon name="trophy" size={20} style={{ color: "oklch(0.8 0.18 140)" }} />
            <div style={{ minWidth: 0 }}>
              <div className="display" style={{ fontSize: 14.5, fontWeight: 800 }}>Global Leaderboard</div>
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>You&apos;re not competing globally. Join to rank against everyone.</div>
            </div>
          </div>
          <button onClick={rejoinGlobal} disabled={joiningGlobal} className="btn-sport tap" style={{ borderRadius: 10, padding: "9px 18px", fontSize: 14, whiteSpace: "nowrap" }}>
            {joiningGlobal ? "Joining…" : "Join"}
          </button>
        </div>
      )}

      <CreateLeagueForm />

      {/* Join by code */}
      <form
        action={action}
        style={{
          display: "flex",
          gap: 8,
          background: "var(--bg-2)",
          border: "1px solid var(--line-soft)",
          borderRadius: 16,
          padding: 12,
          marginBottom: 18,
          boxShadow: "var(--shadow)",
        }}
      >
        <input
          name="code"
          placeholder="Enter join code"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={12}
          className="field"
          style={{
            flex: 1,
            background: "var(--bg-3)",
            border: "1px solid var(--line-soft)",
            borderRadius: 10,
            padding: "11px 13px",
            color: "var(--text)",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            fontSize: 15,
          }}
        />
        <button type="submit" className="btn-sport tap" disabled={pending} style={{ borderRadius: 10, padding: "0 20px", whiteSpace: "nowrap", fontSize: 14 }}>
          {pending ? "Joining…" : "Join"}
        </button>
      </form>
      {state?.error && (
        <p style={{ color: "var(--neg)", fontSize: 13, margin: "-8px 2px 16px" }}>{state.error}</p>
      )}

      {leagues.length === 0 && (
        <Empty icon="trophy" text="You're not in any leagues yet. Create your own above or enter a join code." />
      )}

      <div className="wc-grid stagger">
        {leagues.map((l) => (
          <Link
            key={l.id}
            href={`/leagues/${l.id}`}
            className="card-sport lift-sport tap"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 13,
              padding: "16px 16px",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 13,
                background: "var(--grad-accent)",
                color: "var(--accent-ink)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                transform: "skewX(-6deg)",
                boxShadow: "var(--glow-accent)",
              }}
            >
              <Icon name="trophy" size={22} stroke={2.4} style={{ transform: "skewX(6deg)" }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <div className="display" style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {l.name}
                </div>
                {l.is_global ? <Tag label="Global" accent /> : l.created_by === meId ? <Tag label="Owner" /> : null}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 3 }}>
                {l.member_count} member{l.member_count === 1 ? "" : "s"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                <Meta icon="bolt" text={`${l.points_exact} pt${l.points_exact === 1 ? "" : "s"} exact · ${l.points_outcome} result`} />
                <Meta icon="lock" text={l.submission_mode === "single" ? "One pick" : "Editable picks"} />
                <Meta icon="clock" text={fmtDeadline(deadline.type, deadline.value)} />
              </div>
            </div>
            <Icon name="chevR" size={20} style={{ color: "var(--text-faint)", alignSelf: "flex-start", marginTop: 4 }} />
          </Link>
        ))}
      </div>
    </div>
  );
}
