import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { supabase } from "./supabase";
import { sendWelcomeEmail } from "./email";

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return {
    accessToken: data.access_token as string,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in as number),
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.events.readonly",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    // When Google OAuth blocks a user (e.g. not on the beta test-users list),
    // NextAuth redirects here with `?error=...` — we show a friendly waitlist page
    // instead of NextAuth's default ugly error screen.
    error: "/beta-access",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;

        // Detect first-time sign-in to fire a welcome email
        let isNewUser = false;
        if (token.email) {
          const { data: existing } = await supabase
            .from("users")
            .select("id")
            .eq("email", token.email)
            .maybeSingle();
          isNewUser = !existing;
        }

        await supabase.from("users").upsert(
          {
            email: token.email,
            name: token.name,
            image: token.picture,
            google_refresh_token: account.refresh_token ?? null,
          },
          { onConflict: "email" }
        );

        if (isNewUser && token.email) {
          sendWelcomeEmail({ to: token.email, name: token.name ?? null }).catch((err) =>
            console.error("Welcome email failed:", err)
          );
        }
        return token;
      }

      // Refresh if token expires within 5 minutes
      if (Date.now() / 1000 < (token.expiresAt as number) - 300) {
        return token;
      }

      try {
        const refreshed = await refreshAccessToken(token.refreshToken as string);
        return { ...token, ...refreshed };
      } catch {
        return { ...token, error: "RefreshTokenError" };
      }
    },
    async session({ session, token }) {
      session.user.accessToken = token.accessToken as string;
      session.user.refreshToken = token.refreshToken as string;
      return session;
    },
  },
});
