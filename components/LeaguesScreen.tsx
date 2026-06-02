"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { LeagueSummary } from "@/lib/types";
import { joinLeague } from "@/app/actions";
import { Empty, Icon, ScreenHead } from "@/components/ui";

type JoinState = { error?: string } | null;

export function LeaguesScreen({ leagues }: { leagues: LeagueSummary[] }) {
  const [state, action, pending] = useActionState(
    async (_prev: JoinState, fd: FormData): Promise<JoinState> => {
      const res = await joinLeague(fd);
      return res && "error" in res ? { error: res.error } : null;
    },
    null,
  );

  return (
    <div className="screen-enter">
      <ScreenHead
        title="Leagues"
        sub={leagues.length ? `You're in ${leagues.length} league${leagues.length === 1 ? "" : "s"}` : "Join a league to compete"}
      />

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
        <Empty icon="trophy" text="You haven't joined any leagues yet. Enter a code above to get started." />
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
              <div className="display" style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {l.name}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 3 }}>
                {l.member_count} member{l.member_count === 1 ? "" : "s"}
              </div>
            </div>
            <Icon name="chevR" size={20} style={{ color: "var(--text-faint)" }} />
          </Link>
        ))}
      </div>
    </div>
  );
}
