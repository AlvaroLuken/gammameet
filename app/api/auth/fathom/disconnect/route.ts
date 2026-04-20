import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { revokeWebhook } from "@/lib/fathom";

const APP_URL = process.env.APP_URL ?? "https://gammameet.vercel.app";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabase
    .from("users")
    .select("fathom_access_token, fathom_webhook_id")
    .eq("email", session.user.email)
    .single();

  if (user?.fathom_access_token && user?.fathom_webhook_id) {
    await revokeWebhook(user.fathom_access_token, user.fathom_webhook_id).catch(() => {});
  }

  await supabase.from("users").update({
    fathom_access_token: null,
    fathom_refresh_token: null,
    fathom_webhook_id: null,
  }).eq("email", session.user.email);

  return NextResponse.redirect(new URL("/profile", APP_URL));
}
