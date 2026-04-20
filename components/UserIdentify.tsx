"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export function UserIdentify({ userEmail, userName }: { userEmail?: string | null; userName?: string | null }) {
  useEffect(() => {
    if (userEmail) {
      Sentry.setUser({ email: userEmail, username: userName ?? undefined });
    } else {
      Sentry.setUser(null);
    }
  }, [userEmail, userName]);
  return null;
}
