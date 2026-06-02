"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions";
import { Avatar, Brand, Icon } from "@/components/ui";

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
  isAdmin,
  points,
  brandName,
  brandTagline,
  children,
}: {
  signedIn: boolean;
  displayName: string | null;
  isAdmin: boolean;
  points: number;
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
                    padding: "9px 16px",
                    borderRadius: 11,
                    textDecoration: "none",
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: 14.5,
                    letterSpacing: ".02em",
                    textTransform: "uppercase",
                    color: active ? "var(--accent-ink)" : "var(--text-faint)",
                    background: active ? "var(--grad-accent)" : "transparent",
                    boxShadow: active ? "var(--glow-accent)" : "none",
                  }}
                >
                  <Icon name={n.icon} size={17} stroke={2.4} /> {n.label}
                </Link>
              );
            })}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="wc-desktop-only" style={{ textAlign: "right" }}>
              <div className="display" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{name}</div>
              <div className="num" style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>{points} pts</div>
            </div>
            <form action={signOut}>
              <button className="tap" title="Sign out" style={{ borderRadius: "50%", display: "grid", placeItems: "center" }}>
                <Avatar name={name} size={36} isMe />
              </button>
            </form>
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
              <span className="display" style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase" }}>{n.label}</span>
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
