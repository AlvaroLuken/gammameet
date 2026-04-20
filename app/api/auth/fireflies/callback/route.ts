import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { registerWebhook } from "@/lib/fireflies";

const APP_URL = process.env.APP_URL ?? "https://gammameet.vercel.app";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/profile?error=fireflies_denied", APP_URL));
  }

  let email: string;
  try {
    email = Buffer.from(state, "base64url").toString();
  } catch {
    return NextResponse.redirect(new URL("/profile?error=fireflies_state", APP_URL));
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://app.fireflies.ai/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.FIREFLIES_CLIENT_ID,
      client_secret: process.env.FIREFLIES_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${APP_URL}/api/auth/fireflies/callback`,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/profile?error=fireflies_token", APP_URL));
  }

  const { access_token, refresh_token } = await tokenRes.json();
  if (!access_token) {
    return NextResponse.redirect(new URL("/profile?error=fireflies_token", APP_URL));
  }

  // Look up GammaMeet user
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (!user) {
    return NextResponse.redirect(new URL("/profile?error=fireflies_user", APP_URL));
  }

  // Register webhook on this user's Fireflies account
  const webhookUrl = `${APP_URL}/api/webhook/fireflies?uid=${user.id}`;
  const webhookId = await registerWebhook(access_token, webhookUrl);

  // Store token + webhook ID
  await supabase.from("users").update({
    fireflies_access_token: access_token,
    fireflies_refresh_token: refresh_token ?? null,
    fireflies_webhook_id: webhookId,
  }).eq("id", user.id);

  return NextResponse.redirect(new URL("/profile?connected=fireflies", APP_URL));
}
