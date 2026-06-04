import { headers } from "next/headers";

// Canonical public origin (no trailing slash) for building absolute links such
// as social share URLs. Prefers an explicit NEXT_PUBLIC_SITE_URL, then the
// request host.
export async function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}
