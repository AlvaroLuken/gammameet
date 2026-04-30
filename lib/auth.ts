import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { supabase } from "./supabase";
import { sendWelcomeEmail } from "./email";

/**
 * Belt-and-suspenders: ensure a `users` row exists for the current session.
 * Called on every server page load (via root layout). If the sign-in-time
 * upsert silently failed for any reason, this catches it.
 * Idempotent — onConflict: email makes repeat calls cheap.
 */
export async function ensureUserRecord(user: { email?: string | null; name?: string | null; image?: string | null }) {
  if (!user.email) return;
  const { error } = await supabase.from("users").upsert(
    { email: user.email, name: user.name, image: user.image },
    { onConflict: "email", ignoreDuplicates: false }
  );
  if (error) console.error(`ensureUserRecord upsert failed for ${user.email}:`, error);
}

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

        const upsertPayload: Record<string, unknown> = {
          email: token.email,
          name: token.name,
          image: token.picture,
        };
        // Only touch the refresh token when Google actually returned one.
        // On repeat consent grants Google may omit refresh_token; writing
        // null then would wipe a still-valid stored token. When we DO get
        // a fresh one, also clear needs_reauth — re-auth just succeeded,
        // so the dashboard banner should disappear immediately instead of
        // waiting for the next cron sync to flip it.
        if (account.refresh_token) {
          upsertPayload.google_refresh_token = account.refresh_token;
          upsertPayload.needs_reauth = false;
        }
        const { error: upsertErr } = await supabase.from("users").upsert(
          upsertPayload,
          { onConflict: "email" }
        );
        if (upsertErr) {
          console.error(`User upsert failed for ${token.email}:`, upsertErr);
        }

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
