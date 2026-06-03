import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client. All writes go through this so RLS (the deadline
// lock) is enforced with the database's own clock — never the browser's.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore; middleware refreshes.
          }
        },
      },
    },
  );
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Verified user id straight from the JWT. With asymmetric signing keys this is
// a local verification (no round-trip to the auth server) — much faster than
// getUser() on every navigation. Falls back to a network call only for legacy
// symmetric secrets. Returns null when not signed in.
export async function getUserId(supabase: ServerClient): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}
