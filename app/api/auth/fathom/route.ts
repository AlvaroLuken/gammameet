import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");

  const APP_URL = process.env.APP_URL ?? "https://gammameet.vercel.app";
  const state = Buffer.from(session.user.email).toString("base64url");

  const params = new URLSearchParams({
    client_id: process.env.FATHOM_CLIENT_ID!,
    redirect_uri: `${APP_URL}/api/auth/fathom/callback`,
    response_type: "code",
    state,
  });

  const authorizeUrl = process.env.FATHOM_OAUTH_AUTHORIZE_URL ?? "https://app.fathom.video/oauth/authorize";
  redirect(`${authorizeUrl}?${params}`);
}
