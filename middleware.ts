import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL("/", req.url));
  }
});

// Note: /meetings/:id is intentionally NOT auth-gated here. The page itself
// redirects non-authed visitors to /share/:id so email links work for everyone.
export const config = {
  matcher: ["/dashboard", "/profile"],
};
