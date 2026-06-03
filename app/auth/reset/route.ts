import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Dedicated landing for password-reset links. The reset email points here (no
// query params to lose), so after exchanging the recovery code for a session we
// ALWAYS send the user to /reset-password to set a new password — never straight
// into the app.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/reset-password`);
  }

  return NextResponse.redirect(`${origin}/forgot-password?error=expired`);
}
