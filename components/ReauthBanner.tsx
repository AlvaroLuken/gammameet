"use client";

import { signIn } from "next-auth/react";

export function ReauthBanner() {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 px-4 md:px-8 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <svg className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Google connection expired</p>
            <p className="text-xs text-amber-800 dark:text-amber-300/80 mt-0.5">
              Reconnect so GammaMeet can keep scheduling bots on your upcoming meetings.
            </p>
          </div>
        </div>
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="shrink-0 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded-full transition-colors cursor-pointer"
        >
          Reconnect
        </button>
      </div>
    </div>
  );
}
