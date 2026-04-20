"use client";

import { Suspense, useEffect } from "react";
import posthog from "posthog-js";
import { usePathname, useSearchParams } from "next/navigation";

function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || !posthog.__loaded) return;
    let url = window.origin + pathname;
    const q = searchParams?.toString();
    if (q) url += `?${q}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
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
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    if (!posthog.__loaded) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: false,
        person_profiles: "identified_only",
      });
    }
  }, []);

  useEffect(() => {
    if (!posthog.__loaded) return;
    if (userEmail) {
      posthog.identify(userEmail, { email: userEmail, name: userName ?? undefined });
    }
  }, [userEmail, userName]);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      {children}
    </>
  );
}
