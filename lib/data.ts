import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { AppSettings, Match } from "@/lib/types";

// Shared, non-user-specific data (the fixture list and the app settings) is the
// same for everyone and changes only when an admin edits it. We cache it across
// requests so the signed-in pages stop re-querying Supabase on every visit, and
// invalidate it by tag from the admin actions (revalidateTag).
//
// These reads are public (matches/app_settings have `using (true)` RLS), so we
// use a plain anon client with no cookies — unstable_cache can't touch
// request-scoped APIs like cookies()/headers().
function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export const getMatchesCached = unstable_cache(
  async (): Promise<Match[]> => {
    const sb = publicClient();
    const { data } = await sb.from("matches").select("*").order("kickoff_time", { ascending: true });
    return (data as Match[] | null) ?? [];
  },
  ["matches-all"],
  { tags: ["matches"], revalidate: 300 },
);

export const getSettingsCached = unstable_cache(
  async (): Promise<AppSettings | null> => {
    const sb = publicClient();
    const { data } = await sb.from("app_settings").select("*").eq("id", 1).single();
    return (data as AppSettings | null) ?? null;
  },
  ["app-settings"],
  { tags: ["settings"], revalidate: 300 },
);
