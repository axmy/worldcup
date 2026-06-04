"use client";

import { useActionState, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { login, register, verifyEmailOtp, resendEmailOtp, signInWithGoogle } from "@/app/actions";
import { Brand, Crest, Icon } from "@/components/ui";
import { KickoffCountdown } from "@/components/KickoffCountdown";
import { flagEmoji } from "@/lib/flags";

type AuthState = { error?: string; step?: "verify"; email?: string } | undefined;

const HOSTS = ["Mexico", "United States", "Canada"];

const HERO_TEAMS: [string, number, number, number, number, number][] = [
  // name, top%, left%, size, delay(s), rotate(deg)
  ["Brazil", 12, 10, 60, 0, -10],
  ["Argentina", 26, 72, 52, 0.8, 8],
  ["France", 58, 6, 48, 1.6, -6],
  ["England", 70, 64, 64, 0.4, 10],
  ["Spain", 40, 40, 44, 1.2, 4],
  ["Germany", 84, 26, 40, 2.0, -8],
  ["Portugal", 8, 46, 38, 1.0, 6],
];

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

function Field({ label, right, children }: { label: string; right?: ReactNode; children: ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
        <span className="display" style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".06em", color: "var(--text-dim)" }}>{label}</span>
        {right}
      </div>
      {children}
    </label>
  );
}

function StatPip({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: "left" }}>
      <div className="h-hero num" style={{ fontSize: 30, color: "var(--accent)" }}>{value}</div>
      <div className="display" style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".14em", color: "var(--text-faint)", textTransform: "uppercase", marginTop: 5 }}>{label}</div>
    </div>
  );
}

export function AuthCard({
  mode,
  brandName = "Kickoff",
  brandTagline = "WC26 · Predictor",
  heroHeadline = "Call the scoreline. Own the board.",
  heroSubtitle = "Predict every match before the deadline. Exact scores win big, most-correct lifts the trophy.",
}: {
  mode: "login" | "register";
  brandName?: string;
  brandTagline?: string;
  heroHeadline?: string;
  heroSubtitle?: string;
}) {
  const isSignup = mode === "register";
  const [showPw, setShowPw] = useState(false);

  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    async (_prev, formData) => {
      const res = await (isSignup ? register(formData) : login(formData));
      if (res && "error" in res && res.error) return { error: res.error };
      if (res && "step" in res) return { step: "verify", email: res.email };
      return undefined;
    },
    undefined,
  );
  const [verifyState, verifyAction, verifying] = useActionState<AuthState, FormData>(
    async (_prev, formData) => verifyEmailOtp(formData),
    undefined,
  );
  const [resendState, resendAction] = useActionState<AuthState, FormData>(
    async (_prev, formData) => resendEmailOtp(formData),
    undefined,
  );

  const verifyEmail = state && state.step === "verify" ? state.email : undefined;

  // 60-second cooldown before the user can request a new verification code.
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (verifyEmail) setResendIn(60);
  }, [verifyEmail]);
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  return (
    <div style={{ minHeight: "100dvh", width: "100%", background: "transparent" }}>
      <div className="auth-shell">
        {/* ── Immersive hero (desktop) ── */}
        <div className="auth-hero">
          {/* gradient accent cap along the top edge */}
          <div aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 4, background: "var(--grad-accent)", zIndex: 3 }} />
          {/* Pitch-line markings */}
          <svg
            aria-hidden
            viewBox="0 0 600 800"
            preserveAspectRatio="xMidYMid slice"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, color: "#ffffff", opacity: 0.07 }}
          >
            <line x1="0" y1="400" x2="600" y2="400" stroke="currentColor" strokeWidth="2" />
            <circle cx="300" cy="400" r="110" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="300" cy="400" r="5" fill="currentColor" />
            <rect x="190" y="-80" width="220" height="150" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="190" y="730" width="220" height="150" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "-22%",
              right: "-14%",
              width: 460,
              height: 460,
              borderRadius: "50%",
              background: "radial-gradient(circle, oklch(0.7 0.19 145 / 0.5), transparent 66%)",
              animation: "glowPulse 7s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
          <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            {HERO_TEAMS.map(([name, top, left, size, delay, r]) => (
              <div
                key={name}
                style={{
                  position: "absolute",
                  top: `${top}%`,
                  left: `${left}%`,
                  ["--r" as string]: `${r}deg`,
                  animation: `floatY ${5 + delay}s ease-in-out ${delay}s infinite`,
                  opacity: 0.9,
                  filter: "drop-shadow(0 10px 24px rgba(0,0,0,.45))",
                }}
              >
                <Crest name={name} size={size} />
              </div>
            ))}
          </div>

          <div style={{ position: "relative", zIndex: 2 }}>
            <Link href="/" aria-label="Back to home" style={{ textDecoration: "none", color: "inherit" }}>
              <Brand size="lg" name={brandName} tagline={brandTagline} />
            </Link>
          </div>

          <div style={{ position: "relative", zIndex: 2, margin: "auto 0" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                padding: "6px 14px",
                borderRadius: 99,
                background: "color-mix(in oklab, oklch(0.7 0.19 145) 22%, transparent)",
                border: "1px solid color-mix(in oklab, oklch(0.7 0.19 145) 45%, transparent)",
                color: "#dcfce7",
                fontFamily: "var(--font-body)",
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: ".06em",
                marginBottom: 22,
              }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>{HOSTS.map((h) => flagEmoji(h)).join(" ")}</span>
              World Cup 2026
            </div>
            <h2 className="h-hero" style={{ fontSize: "clamp(44px, 5vw, 62px)", maxWidth: 480 }}>
              {heroHeadline}
            </h2>
            <p style={{ color: "var(--text-dim)", fontSize: 16.5, marginTop: 18, maxWidth: 400, lineHeight: 1.5 }}>
              {heroSubtitle}
            </p>

            {/* Kickoff countdown */}
            <div style={{ marginTop: 26 }}>
              <KickoffCountdown compact />
            </div>
          </div>

          <div style={{ position: "relative", zIndex: 2, display: "flex", gap: 40, paddingTop: 28, borderTop: "1px solid var(--line-soft)" }}>
            <StatPip value="3 PTS" label="Exact score" />
            <StatPip value="1 PT" label="Right result" />
            <StatPip value="∞" label="Glory" />
          </div>
        </div>

        {/* ── Form panel ── */}
        <div className="auth-form-wrap">
          <div className="auth-form" style={{ animation: "authIn .5s cubic-bezier(.2,.7,.3,1) both" }}>
            {/* Back to the public landing page */}
            <Link
              href="/"
              className="auth-link tap"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, alignSelf: "flex-start", fontSize: 13.5, fontWeight: 600, color: "var(--text-faint)", textDecoration: "none", marginBottom: 18 }}
            >
              <Icon name="chevL" size={16} /> Back to home
            </Link>

            {/* compact mobile brand */}
            <Link href="/" aria-label="Back to home" className="auth-mobile-brand" style={{ justifyContent: "center", marginBottom: 26, textDecoration: "none", color: "inherit" }}>
              <Brand name={brandName} tagline={brandTagline} />
            </Link>

            {verifyEmail ? (
              // ── OTP verify step (after signup) ──
              <>
                <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
                  <span className="slash" aria-hidden style={{ minHeight: 34 }} />
                  <h1 className="h-hero" style={{ fontSize: 34, minWidth: 0 }}>Check your inbox</h1>
                </div>
                <p style={{ color: "var(--text-dim)", fontSize: 15, marginTop: 11, lineHeight: 1.5 }}>
                  We emailed a 6-digit code to <b style={{ color: "var(--text)" }}>{verifyEmail}</b>. Enter it to verify your account.
                </p>

                <form action={verifyAction} style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 13 }}>
                  <input type="hidden" name="email" value={verifyEmail} />
                  <Field label="Verification code">
                    <input
                      className="auth-field num"
                      name="token"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      required
                      placeholder="Enter the code"
                      style={{ ...fieldStyle, textAlign: "center", letterSpacing: ".24em", fontSize: 22, fontWeight: 700 }}
                    />
                  </Field>

                  {verifyState?.error && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--neg)", fontSize: 13, fontWeight: 600 }}>
                      <Icon name="x" size={15} stroke={2.6} /> {verifyState.error}
                    </div>
                  )}

                  <button type="submit" className="auth-cta tap" disabled={verifying} style={ctaStyle}>
                    {verifying ? "Verifying…" : "Verify & enter"}
                    <Icon name="arrowR" size={20} stroke={2.6} />
                  </button>
                </form>

                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <span style={{ fontSize: 14, color: "var(--text-dim)" }}>Didn&apos;t get it? </span>
                  {resendIn > 0 ? (
                    <span className="num" style={{ fontSize: 14, color: "var(--text-faint)", fontWeight: 600 }}>
                      Resend in {Math.floor(resendIn / 60)}:{String(resendIn % 60).padStart(2, "0")}
                    </span>
                  ) : (
                    <form action={resendAction} style={{ display: "inline" }}>
                      <input type="hidden" name="email" value={verifyEmail} />
                      <button type="submit" className="auth-link" style={{ fontSize: 14 }} onClick={() => setResendIn(60)}>
                        Resend code
                      </button>
                    </form>
                  )}
                  {resendState && !resendState.error && (
                    <p style={{ fontSize: 12.5, color: "var(--pos)", marginTop: 6 }}>New code sent.</p>
                  )}
                  {resendState?.error && (
                    <p style={{ fontSize: 12.5, color: "var(--neg)", marginTop: 6 }}>{resendState.error}</p>
                  )}
                </div>
              </>
            ) : (
              // ── Sign in / sign up ──
              <>
                <div style={{ display: "flex", gap: 13, alignItems: "stretch" }}>
                  <span className="slash" aria-hidden style={{ minHeight: 40 }} />
                  <h1 className="h-hero" style={{ fontSize: "clamp(34px, 9vw, 44px)", minWidth: 0 }}>
                    {isSignup ? "Join the pool" : "Welcome back"}
                  </h1>
                </div>
                <p style={{ color: "var(--text-dim)", fontSize: 15, marginTop: 11, lineHeight: 1.5 }}>
                  {isSignup
                    ? "Create your account, lock in your scorelines, and climb the board."
                    : "Sign in to submit your predictions before the whistle blows."}
                </p>

                <form action={formAction} style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 13 }}>
                  {isSignup && (
                    <Field label="Display name">
                      <input className="auth-field" name="display_name" required placeholder="e.g. Diego F." autoComplete="name" style={fieldStyle} />
                    </Field>
                  )}
                  <Field label="Email">
                    <input className="auth-field" name="email" type="email" required placeholder="you@email.com" autoComplete="email" style={fieldStyle} />
                  </Field>
                  <Field
                    label="Password"
                    right={
                      <button type="button" className="auth-show" onClick={() => setShowPw((s) => !s)} style={{ fontSize: 12, fontWeight: 700, color: "var(--text-faint)", fontFamily: "var(--font-display)", letterSpacing: ".06em" }}>
                        {showPw ? "HIDE" : "SHOW"}
                      </button>
                    }
                  >
                    <input
                      className="auth-field"
                      name="password"
                      type={showPw ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder={isSignup ? "Create a password" : "••••••••"}
                      autoComplete={isSignup ? "new-password" : "current-password"}
                      style={fieldStyle}
                    />
                  </Field>

                  {!isSignup && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: -4 }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-dim)", userSelect: "none" }}>
                        <input
                          type="checkbox"
                          name="remember"
                          defaultChecked
                          style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer" }}
                        />
                        Remember me
                      </label>
                      <Link href="/forgot-password" className="auth-link" style={{ fontSize: 13, textDecoration: "none" }}>
                        Forgot password?
                      </Link>
                    </div>
                  )}

                  {state?.error && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--neg)", fontSize: 13, fontWeight: 600 }}>
                      <Icon name="x" size={15} stroke={2.6} /> {state.error}
                    </div>
                  )}

                  <button type="submit" className="auth-cta tap" disabled={pending} style={{ ...ctaStyle, marginTop: 4 }}>
                    {pending ? "Please wait…" : isSignup ? "Create account" : "Enter the pool"}
                    <Icon name="arrowR" size={20} stroke={2.6} />
                  </button>
                </form>

                {/* divider + Google */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "22px 0 16px" }}>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                  <span style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 600, letterSpacing: ".04em" }}>or continue with</span>
                  <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                </div>
                <form action={signInWithGoogle}>
                  <button type="submit" className="auth-social tap" style={socialStyle}>
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.5 12.2c0-.7-.06-1.4-.18-2.05H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.56c2.08-1.92 3.24-4.75 3.24-7.85Z" />
                      <path fill="#34A853" d="M12 23c2.96 0 5.45-.98 7.26-2.65l-3.55-2.7c-.98.66-2.24 1.06-3.71 1.06-2.85 0-5.27-1.93-6.13-4.52H2.2v2.84A11 11 0 0 0 12 23Z" />
                      <path fill="#FBBC05" d="M5.87 14.19a6.6 6.6 0 0 1 0-4.22V7.13H2.2a11 11 0 0 0 0 9.9l3.67-2.84Z" />
                      <path fill="#EA4335" d="M12 4.75c1.61 0 3.06.55 4.2 1.64l3.15-3.15C17.45 1.4 14.96.4 12 .4A11 11 0 0 0 2.2 7.13l3.67 2.84C6.73 7.38 9.15 4.75 12 4.75Z" />
                    </svg>
                    Continue with Google
                  </button>
                </form>

                <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "var(--text-dim)" }}>
                  {isSignup ? "Already playing? " : `New to ${brandName}? `}
                  <Link href={isSignup ? "/login" : "/register"} className="auth-link" style={{ textDecoration: "none" }}>
                    {isSignup ? "Sign in" : "Create an account"}
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .auth-shell { min-height: 100dvh; display: flex; flex-direction: column; }
        .auth-hero { display: none; }
        .auth-mobile-brand { display: flex; }
        .auth-form-wrap { flex: 1; display: flex; padding: 28px 22px 40px; }
        .auth-form { width: 100%; max-width: 408px; margin: 0 auto; display: flex; flex-direction: column; justify-content: center; }
        @media (min-width: 860px) {
          .auth-shell { display: grid; grid-template-columns: 1.05fr .95fr; gap: 22px; max-width: 1180px; margin: 0 auto; padding: 22px; align-items: stretch; }
          .auth-hero {
            display: flex; flex-direction: column; justify-content: space-between;
            position: relative; overflow: hidden; border-radius: 28px;
            background: linear-gradient(160deg, oklch(0.27 0.06 152), oklch(0.16 0.03 155));
            border: 1px solid color-mix(in oklab, oklch(0.7 0.19 145) 22%, var(--line-soft));
            padding: 44px;
            /* The hero is always a dark-green panel, so force light text tokens
               here regardless of the page theme (fixes black text on green in
               light mode). Descendants inherit these via var(). */
            --text: #f3faf4;
            --text-dim: color-mix(in oklab, #f3faf4 80%, transparent);
            --text-faint: color-mix(in oklab, #f3faf4 56%, transparent);
            color: var(--text);
          }
          .auth-mobile-brand { display: none; }
          .auth-form-wrap { padding: 24px 28px; }
        }
      `}</style>
    </div>
  );
}

const ctaStyle: CSSProperties = {
  height: 54,
  borderRadius: 14,
  fontFamily: "var(--font-body)",
  fontSize: 16.5,
  fontWeight: 700,
  letterSpacing: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};
const socialStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  height: 48,
  borderRadius: 13,
  background: "var(--bg-2)",
  border: "1px solid var(--line)",
  color: "var(--text)",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 15,
};
