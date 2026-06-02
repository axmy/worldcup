"use client";

import { useState } from "react";
import Link from "next/link";
import { leaveLeague } from "@/app/actions";
import { Icon } from "@/components/ui";

export function LeagueHeader({ leagueId, joinCode }: { leagueId: string; joinCode: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the code is visible anyway */
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
      <Link
        href="/leagues"
        className="tap"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-faint)", textDecoration: "none" }}
      >
        <Icon name="chevL" size={16} /> Leagues
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={copy}
          className="chip tap"
          title="Copy join code"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 11px",
            borderRadius: 10,
            background: "var(--bg-3)",
            border: "1px solid var(--line-soft)",
            color: "var(--text)",
          }}
        >
          <Icon name={copied ? "check" : "ticket"} size={14} style={{ color: "var(--accent)" }} />
          <span className="display num" style={{ fontWeight: 800, letterSpacing: ".16em", fontSize: 14 }}>
            {copied ? "COPIED" : joinCode}
          </span>
        </button>

        <form action={leaveLeague}>
          <input type="hidden" name="league_id" value={leagueId} />
          <button
            type="submit"
            className="btn-ghost tap"
            title="Leave league"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 10, color: "var(--text-faint)" }}
          >
            <Icon name="x" size={14} /> Leave
          </button>
        </form>
      </div>
    </div>
  );
}
