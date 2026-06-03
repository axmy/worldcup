"use client";

import { useActionState, type CSSProperties } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions";
import { Brand, Icon } from "@/components/ui";

type State = { error?: string; sent?: boolean } | undefined;

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

const ctaStyle: CSSProperties = {
  marginTop: 4,
  height: 54,
  borderRadius: 14,
  fontFamily: "var(--font-body)",
  fontSize: 16.5,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

export function ForgotPasswordCard({
  brandName = "Kickoff",
  brandTagline = "WC26 · Predictor",
}: {
  brandName?: string;
  brandTagline?: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => requestPasswordReset(formData),
    undefined,
  );

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 22, background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 408, animation: "authIn .5s cubic-bezier(.2,.7,.3,1) both" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
          <Brand name={brandName} tagline={brandTagline} />
        </div>

        {state?.sent ? (
          <>
            <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
              <span className="slash" aria-hidden style={{ minHeight: 34 }} />
              <h1 className="h-hero" style={{ fontSize: 32, minWidth: 0 }}>Check your inbox</h1>
            </div>
            <p style={{ color: "var(--text-dim)", fontSize: 15, marginTop: 11, lineHeight: 1.5 }}>
              If an account uses that email, we&apos;ve sent a link to reset your password. The link opens a page where you can set a new one.
            </p>
            <Link href="/login" className="auth-link" style={{ display: "inline-block", marginTop: 20, fontSize: 14, textDecoration: "none" }}>
              ← Back to sign in
            </Link>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
              <span className="slash" aria-hidden style={{ minHeight: 34 }} />
              <h1 className="h-hero" style={{ fontSize: 32, minWidth: 0 }}>Reset your password</h1>
            </div>
            <p style={{ color: "var(--text-dim)", fontSize: 15, marginTop: 11, lineHeight: 1.5 }}>
              Enter the email you signed up with and we&apos;ll send you a reset link. (Signed in with Google? Just use the Google button instead.)
            </p>

            <form action={formAction} style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 13 }}>
              <label style={{ display: "block" }}>
                <span className="display" style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".06em", color: "var(--text-dim)", display: "block", marginBottom: 7 }}>Email</span>
                <input className="auth-field" name="email" type="email" required placeholder="you@email.com" autoComplete="email" style={fieldStyle} />
              </label>

              {state?.error && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--neg)", fontSize: 13, fontWeight: 600 }}>
                  <Icon name="x" size={15} stroke={2.6} /> {state.error}
                </div>
              )}

              <button type="submit" className="auth-cta tap" disabled={pending} style={ctaStyle}>
                {pending ? "Sending…" : "Send reset link"}
                <Icon name="arrowR" size={20} stroke={2.6} />
              </button>
            </form>

            <p style={{ textAlign: "center", marginTop: 22, fontSize: 14, color: "var(--text-dim)" }}>
              Remembered it?{" "}
              <Link href="/login" className="auth-link" style={{ textDecoration: "none" }}>Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
