import { NextResponse } from "next/server";
import { syncResults } from "@/lib/sync/results";

// Scheduled results sync. Vercel Cron calls this on the schedule in vercel.json
// and (when CRON_SECRET is set) sends `Authorization: Bearer <CRON_SECRET>`.
// We require that header so the endpoint can't be triggered by anyone.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await syncResults();
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "sync failed" },
      { status: 500 },
    );
  }
}
