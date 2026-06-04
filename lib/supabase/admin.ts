import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client — bypasses RLS. SERVER-ONLY: used by the
// unattended results sync (cron) to write match scores without a logged-in
// admin session. NEVER import this into client components; the service role key
// must never reach the browser.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
