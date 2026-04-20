"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";

export function PostHogProvider({
  children,
  userEmail,
  userName,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
  userName?: string | null;
}) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    console.log("[PostHog] init check — key present?", !!key, "already loaded?", posthog.__loaded);
    if (!key || posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: "history_change",
      capture_pageleave: true,
      person_profiles: "identified_only",
      loaded: (ph) => {
        console.log("[PostHog] init complete, distinct_id:", ph.get_distinct_id());
        (window as unknown as { posthog: typeof posthog }).posthog = ph;
      },
    });
  }, []);

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
