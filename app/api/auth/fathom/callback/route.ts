import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { registerWebhook } from "@/lib/fathom";

const APP_URL = process.env.APP_URL ?? "https://gammameet.vercel.app";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/profile?error=fathom_denied", APP_URL));
  }

  let email: string;
  try {
    email = Buffer.from(state, "base64url").toString();
  } catch {
    return NextResponse.redirect(new URL("/profile?error=fathom_state", APP_URL));
  }

  const tokenUrl = process.env.FATHOM_OAUTH_TOKEN_URL ?? "https://app.fathom.video/oauth/token";
  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.FATHOM_CLIENT_ID,
      client_secret: process.env.FATHOM_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${APP_URL}/api/auth/fathom/callback`,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Fathom token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(new URL("/profile?error=fathom_token", APP_URL));
  }

  const { access_token, refresh_token } = await tokenRes.json();
  if (!access_token) {
    return NextResponse.redirect(new URL("/profile?error=fathom_token", APP_URL));
  }

  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (!user) {
    return NextResponse.redirect(new URL("/profile?error=fathom_user", APP_URL));
  }

  // Register webhook on user's Fathom account
  const webhookUrl = `${APP_URL}/api/webhook/fathom?uid=${user.id}`;
  const webhookId = await registerWebhook(access_token, webhookUrl);

  await supabase.from("users").update({
    fathom_access_token: access_token,
    fathom_refresh_token: refresh_token ?? null,
    fathom_webhook_id: webhookId,
  }).eq("id", user.id);

  return NextResponse.redirect(new URL("/profile?connected=fathom", APP_URL));
}
