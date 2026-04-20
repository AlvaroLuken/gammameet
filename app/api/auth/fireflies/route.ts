import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");

  const state = Buffer.from(session.user.email).toString("base64url");
  const appUrl = process.env.APP_URL ?? "https://gammameet.vercel.app";

  const params = new URLSearchParams({
    client_id: process.env.FIREFLIES_CLIENT_ID!,
    redirect_uri: `${appUrl}/api/auth/fireflies/callback`,
    response_type: "code",
    state,
  });

  redirect(`https://app.fireflies.ai/oauth/authorize?${params}`);
}
