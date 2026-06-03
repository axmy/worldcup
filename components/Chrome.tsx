"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "@/app/actions";
import { Avatar, Brand, Icon } from "@/components/ui";

// Subtle pending dot: only shows if the tapped link's navigation takes a beat
// (prefetch not yet ready), giving immediate feedback that the tap registered.
function NavHint() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`link-hint${pending ? " is-pending" : ""}`} />;
}

// Avatar click opens this menu (it used to log the user out instantly). Shows
// who's signed in, a personal dark/light theme choice, and an explicit Log out.
function AccountMenu({
  name,
  email,
  points,
  theme,
}: {
  name: string;
  email: string | null;
  points: number;
  theme: "dark" | "light";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<"dark" | "light">(theme);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Per-user preference: persisted in a cookie the server layout reads to set
  // <html data-theme>. Apply instantly on the client, then refresh so SSR agrees.
  function chooseTheme(next: "dark" | "light") {
    if (next === pick) return;
    setPick(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `theme_pref=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        className="tap"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ borderRadius: "50%", display: "grid", placeItems: "center" }}
      >
        <Avatar name={name} size={36} isMe />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
          <div
            role="menu"
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 12px)",
              zIndex: 51,
              width: 250,
              background: "var(--bg-2)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              boxShadow: "var(--shadow)",
              overflow: "hidden",
              animation: "popIn .16s ease both",
            }}
          >
            {/* Identity */}
            <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 15px" }}>
              <Avatar name={name} size={42} isMe />
              <div style={{ minWidth: 0 }}>
                <div className="display" style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                {email && <div style={{ fontSize: 12, color: "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>}
                <div className="num" style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 700, marginTop: 1 }}>{points} pts</div>
              </div>
            </div>

            <div style={{ height: 1, background: "var(--line-soft)" }} />

            {/* Theme */}
            <div style={{ padding: "12px 15px" }}>
              <div className="display" style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", color: "var(--text-faint)", textTransform: "uppercase", marginBottom: 8 }}>Theme</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: 4, background: "var(--bg-3)", borderRadius: 11 }}>
                {(["dark", "light"] as const).map((opt) => (
                  <button
                    key={opt}
                    className="tap"
                    onClick={() => chooseTheme(opt)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "8px",
                      borderRadius: 8,
                      fontFamily: "var(--font-display)",
                      fontWeight: 800,
                      fontSize: 13,
                      textTransform: "capitalize",
                      background: pick === opt ? "var(--accent)" : "transparent",
                      color: pick === opt ? "var(--accent-ink)" : "var(--text-dim)",
                    }}
                  >
                    <Icon name={opt === "dark" ? "moon" : "sun"} size={14} stroke={2.4} /> {opt}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: "var(--line-soft)" }} />

            {/* Log out */}
            <form action={signOut}>
              <button
                type="submit"
                className="row-hover tap"
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 15px", color: "var(--neg)", fontSize: 14, fontWeight: 700, fontFamily: "var(--font-display)" }}
              >
                <Icon name="logout" size={17} stroke={2.4} /> Log out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

type NavItem = { href: string; label: string; icon: string; adminOnly?: boolean };
const NAV: NavItem[] = [
  { href: "/matches", label: "Matches", icon: "list" },
  { href: "/picks", label: "My Picks", icon: "ticket" },
  { href: "/leagues", label: "Leagues", icon: "trophy" },
  { href: "/admin", label: "Admin", icon: "cog", adminOnly: true },
];

export function Chrome({
  signedIn,
  displayName,
  email,
  isAdmin,
  points,
  theme,
  brandName,
  brandTagline,
  children,
}: {
  signedIn: boolean;
  displayName: string | null;
  email: string | null;
  isAdmin: boolean;
  points: number;
  theme: "dark" | "light";
  brandName: string;
  brandTagline: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const bare =
    !signedIn ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/change-password");

  // Auth screens (and signed-out) render full-bleed with no app chrome.
  if (bare) return <>{children}</>;

  const items = NAV.filter((n) => !n.adminOnly || isAdmin);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const name = displayName || "You";

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* ── Header ── */}
      <header
        className="pitch-hero"
        style={{
          flexShrink: 0,
          borderBottom: "1px solid var(--line-soft)",
          background: "color-mix(in oklab, var(--bg) 84%, transparent)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        {/* sporty accent bar pinned to the bottom edge of the header */}
        <div aria-hidden style={{ position: "absolute", insetInline: 0, bottom: 0, height: 2, background: "var(--grad-accent)", opacity: 0.9 }} />
        <div
          style={{
            maxWidth: 980,
            margin: "0 auto",
            padding: "13px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <Link href="/matches" style={{ textDecoration: "none", color: "inherit" }}>
            <Brand name={brandName} tagline={brandTagline} />
          </Link>

          <nav className="wc-desktop-nav" style={{ gap: 4 }}>
            {items.map((n) => {
              const active = isActive(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="navitem tap"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 15px",
                    borderRadius: 9,
                    textDecoration: "none",
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    fontSize: 14.5,
                    letterSpacing: 0,
                    color: active ? "var(--accent-ink)" : "var(--text-faint)",
                    background: active ? "var(--accent)" : "transparent",
                    boxShadow: "none",
                  }}
                >
                  <Icon name={n.icon} size={17} stroke={2.4} /> {n.label}
                  <NavHint />
                </Link>
              );
            })}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="wc-desktop-only" style={{ textAlign: "right" }}>
              <div className="display" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{name}</div>
              <div className="num" style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>{points} pts</div>
            </div>
            <AccountMenu name={name} email={email} points={points} theme={theme} />
          </div>
        </div>
      </header>

      {/* ── Scrollable content ── */}
      <main style={{ flex: 1 }}>
        <div className="wc-main" style={{ maxWidth: 640, margin: "0 auto", padding: "22px 18px 110px" }}>
          {children}
        </div>
      </main>

      {/* ── Bottom nav (mobile) ── */}
      <nav
        className="wc-bottom-nav"
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--line-soft)",
          background: "color-mix(in oklab, var(--bg) 92%, transparent)",
          backdropFilter: "blur(12px)",
          paddingBottom: "env(safe-area-inset-bottom)",
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
        }}
      >
        {items.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className="tap"
              style={{
                flex: 1,
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "11px 4px 9px",
                textDecoration: "none",
                color: active ? "var(--accent)" : "var(--text-faint)",
              }}
            >
              {active && <span aria-hidden style={{ position: "absolute", top: 0, width: 30, height: 3, borderRadius: 99, background: "var(--grad-accent)", boxShadow: "var(--glow-accent)" }} />}
              <Icon name={n.icon} size={22} stroke={active ? 2.6 : 2} />
              <span className="display" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, letterSpacing: 0 }}>{n.label}<NavHint /></span>
            </Link>
          );
        })}
      </nav>

      {/* Responsive show/hide for nav pieces (mobile bottom nav vs desktop top nav) */}
      <style>{`
        .wc-desktop-nav { display: none; }
        .wc-desktop-only { display: none; }
        .wc-bottom-nav { display: flex; }
        @media (min-width: 860px) {
          .wc-desktop-nav { display: flex; }
          .wc-desktop-only { display: block; }
          .wc-bottom-nav { display: none; }
          .wc-main { padding-bottom: 60px !important; padding-top: 34px !important; max-width: 920px !important; }
        }
      `}</style>
    </div>
  );
}
