"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { resetPassword } from "@/app/actions";
import { Brand, Icon } from "@/components/ui";

const fieldStyle: CSSProperties = {
  width: "100%",
  height: 50,
  padding: "0 15px",
  borderRadius: 13,
  background: "var(--bg-3)",
  border: "1px solid var(--line)",
  color: "var(--text)",
  fontSize: 15.5,
  fontFamily: "var(--font-body)",
  fontWeight: 500,
};

export function ResetPasswordCard({
  brandName = "Kickoff",
  brandTagline = "WC26 · Predictor",
}: {
  brandName?: string;
  brandTagline?: string;
}) {
  const [show, setShow] = useState(false);
  const [state, formAction, pending] = useActionState<{ error?: string } | undefined, FormData>(
    async (_prev, formData) => resetPassword(formData),
    undefined,
  );

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 22, background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 408, animation: "authIn .5s cubic-bezier(.2,.7,.3,1) both" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
          <Brand name={brandName} tagline={brandTagline} />
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
          <span className="slash" aria-hidden style={{ minHeight: 34 }} />
          <h1 className="h-hero" style={{ fontSize: 32, minWidth: 0 }}>Set a new password</h1>
        </div>
        <p style={{ color: "var(--text-dim)", fontSize: 15, marginTop: 11, lineHeight: 1.5 }}>
          Choose a new password for your account. You&apos;ll be signed in once it&apos;s saved.
        </p>

        <form action={formAction} style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 13 }}>
          <label style={{ display: "block" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <span className="display" style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".06em", color: "var(--text-dim)" }}>New password</span>
              <button type="button" className="auth-show" onClick={() => setShow((s) => !s)} style={{ fontSize: 12, fontWeight: 700, color: "var(--text-faint)", fontFamily: "var(--font-body)", letterSpacing: ".06em" }}>
                {show ? "HIDE" : "SHOW"}
              </button>
            </div>
            <input className="auth-field" name="password" type={show ? "text" : "password"} required minLength={6} placeholder="At least 6 characters" autoComplete="new-password" style={fieldStyle} />
          </label>

          <label style={{ display: "block" }}>
            <span className="display" style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".06em", color: "var(--text-dim)", display: "block", marginBottom: 7 }}>Confirm password</span>
            <input className="auth-field" name="confirm" type={show ? "text" : "password"} required minLength={6} placeholder="Re-enter password" autoComplete="new-password" style={fieldStyle} />
          </label>

          {state?.error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--neg)", fontSize: 13, fontWeight: 600 }}>
              <Icon name="x" size={15} stroke={2.6} /> {state.error}
            </div>
          )}

          <button
            type="submit"
            className="auth-cta tap"
            disabled={pending}
            style={{ marginTop: 4, height: 54, borderRadius: 14, fontFamily: "var(--font-body)", fontSize: 16.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            {pending ? "Saving…" : "Save & continue"}
            <Icon name="arrowR" size={20} stroke={2.6} />
          </button>
        </form>
      </div>
    </div>
  );
}
