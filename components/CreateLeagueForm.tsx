"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { createLeague } from "@/app/actions";
import { Icon } from "@/components/ui";

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

// Create a new league. The creator becomes its owner (create_league RPC) and is
// redirected into the new league. Scoring rules are optional — blank uses the
// platform defaults.
export function CreateLeagueForm() {
  const [name, setName] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      // createLeague redirects on success; only an error returns here.
      const res = await createLeague(formData);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <form
      action={submit}
      style={{
        background: "var(--bg-2)",
        border: "1px solid var(--line-soft)",
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
        boxShadow: "var(--shadow)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div className="display" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", color: "var(--text-faint)", textTransform: "uppercase" }}>
        Start a league
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your league name"
          maxLength={60}
          style={{ ...field, flex: 1 }}
        />
        <button
          type="submit"
          className="btn-sport tap"
          disabled={!name.trim() || isPending}
          style={{ borderRadius: 10, padding: "0 20px", whiteSpace: "nowrap", fontSize: 14, opacity: name.trim() && !isPending ? 1 : 0.5 }}
        >
          {isPending ? "Creating…" : "Create"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        className="tap"
        style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-body)" }}
      >
        <Icon name={advanced ? "chevD" : "chevR"} size={14} /> Scoring rules {advanced ? "" : "(optional)"}
      </button>

      {advanced && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lab}>POINTS · EXACT SCORE</label>
              <input name="points_exact" type="number" min={0} defaultValue={3} style={field} />
            </div>
            <div>
              <label style={lab}>POINTS · CORRECT RESULT</label>
              <input name="points_outcome" type="number" min={0} defaultValue={1} style={field} />
            </div>
          </div>
        </div>
      )}

      {error && <p style={{ color: "var(--neg)", fontSize: 12.5, margin: 0 }}>{error}</p>}
    </form>
  );
}
