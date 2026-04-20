"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";

let initialized = false;
function ensurePostHogInit() {
  if (initialized) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: "history_change",
    capture_pageleave: true,
    person_profiles: "identified_only",
    defaults: "2025-05-24",
  });
  initialized = true;
}

export function PostHogProvider({
  children,
  userEmail,
  userName,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
  userName?: string | null;
}) {
  // Init synchronously on first render (client-only module; safe in "use client")
  if (typeof window !== "undefined") ensurePostHogInit();

  useEffect(() => {
    if (userEmail) {
      if (posthog.__loaded) {
        posthog.identify(userEmail, { email: userEmail, name: userName ?? undefined });
      }
      Sentry.setUser({ email: userEmail, username: userName ?? undefined });
    } else {
      if (posthog.__loaded) posthog.reset();
      Sentry.setUser(null);
    }
  }, [userEmail, userName]);

  return <>{children}</>;
}
