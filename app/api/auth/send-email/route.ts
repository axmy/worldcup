import crypto from "node:crypto";
import { after, NextResponse } from "next/server";

// Uses node:crypto for signature verification, so this must run on Node (not Edge).
export const runtime = "nodejs";

// Supabase "Send Email" auth hook → Mailngine.
//
// When the hook is enabled, Supabase stops sending auth emails itself and POSTs
// each one here instead. We verify the signature, render the email (OTP code for
// signup, a link for password reset / others) and hand it to Mailngine's REST
// API. This replaces Supabase's rate-limited built-in mailer AND its dashboard
// templates — the content below is the source of truth.
//
// Required env:
//   SEND_EMAIL_HOOK_SECRET  – the secret Supabase shows when you create the hook
//                             (looks like "v1,whsec_…")
//   MAILNGINE_API_KEY       – your Mailngine API key (mn_live_…)
//   MAIL_FROM               – verified sender, e.g. "Kickoff <hello@scorepredict.xyz>"
//   NEXT_PUBLIC_SUPABASE_URL – used to build verification links

type HookPayload = {
  user: { id: string; email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
};

// Standard Webhooks signature check (the scheme Supabase auth hooks use).
function verifySignature(secret: string, headers: Headers, body: string): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !sigHeader) return false;

  // Reject stale deliveries (>5 min) to blunt replay attempts.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = Buffer.from(secret.replace(/^v1,whsec_/, "").replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");

  return sigHeader.split(" ").some((part) => {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  });
}

function shell(title: string, inner: string) {
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:8px 4px;color:#1a1a1a">
<h2 style="font-size:20px;margin:0 0 12px">${title}</h2>${inner}
<p style="color:#888;font-size:13px;margin-top:24px">If you didn't request this, you can ignore this email.</p>
</div>`;
}

function buildEmail(data: HookPayload["email_data"]) {
  const verifyUrl =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify` +
    `?token=${encodeURIComponent(data.token_hash)}` +
    `&type=${encodeURIComponent(data.email_action_type)}` +
    `&redirect_to=${encodeURIComponent(data.redirect_to)}`;

  const codeBlock = `<p>Enter this code to continue:</p>
<p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:14px 0">${data.token}</p>
<p style="color:#888;font-size:13px">The code expires shortly.</p>`;

  const linkBtn = (label: string) =>
    `<p><a href="${verifyUrl}" style="display:inline-block;background:#3a4ff5;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;margin:8px 0">${label}</a></p>
<p style="color:#888;font-size:13px;word-break:break-all">Or paste this link: ${verifyUrl}</p>`;

  switch (data.email_action_type) {
    case "signup":
    case "email":
    case "reauthentication":
      return {
        subject: "Your verification code",
        html: shell("Confirm your email", codeBlock),
        text: `Your verification code is ${data.token}. It expires shortly.`,
      };
    case "recovery":
      return {
        subject: "Reset your password",
        html: shell("Reset your password", `<p>Click below to choose a new password.</p>${linkBtn("Reset password")}`),
        text: `Reset your password: ${verifyUrl}`,
      };
    default:
      return {
        subject: "Confirm your request",
        html: shell("Confirm your request", linkBtn("Confirm")),
        text: `Confirm your request: ${verifyUrl}`,
      };
  }
}

export async function POST(request: Request) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  const apiKey = process.env.MAILNGINE_API_KEY;
  const from = process.env.MAIL_FROM ?? "hello@scorepredict.xyz";
  if (!secret || !apiKey) {
    return NextResponse.json({ error: "Email hook is not configured." }, { status: 500 });
  }

  const body = await request.text();
  if (!verifySignature(secret, request.headers, body)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Bad payload." }, { status: 400 });
  }

  const { subject, html, text } = buildEmail(payload.email_data);
  const to = payload.user.email;
  // Stable key so a Supabase retry doesn't trigger a duplicate send in Mailngine.
  const idempotencyKey = `${payload.user.id}:${payload.email_data.token_hash}`;

  // Supabase enforces a hard 5s timeout on this hook. Sending the email inline
  // can blow that budget (cold start + provider latency), so we ACK immediately
  // and send in the background via after(). Failures land in the function logs;
  // the user can fall back to the "Resend code" button (60s cooldown).
  after(async () => {
    try {
      const res = await fetch("https://api.mailngine.com/v1/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, html, text, idempotency_key: idempotencyKey }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.error(`[send-email] Mailngine ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
      }
    } catch (e) {
      console.error("[send-email] Mailngine request failed:", e instanceof Error ? e.message : e);
    }
  });

  return NextResponse.json({});
}
