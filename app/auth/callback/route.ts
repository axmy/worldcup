import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth (Google) redirect target. Supabase sends the user here with a `code`
// query param after they approve; we exchange it for a session (the server
// client writes the auth cookies) and forward to the app.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/matches";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // First Google sign-in: make sure a profile + global membership exist even
      // if the DB triggers didn't fire, so the matches page has league context.
      await supabase.rpc("ensure_self");
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
