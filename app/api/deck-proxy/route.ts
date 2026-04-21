import { NextRequest, NextResponse } from "next/server";

// Proxy Gamma PDF exports so the browser can fetch them without CORS issues.
// Only allows hosts we trust (Gamma's known CDNs).
const ALLOWED_HOSTS = new Set([
  "assets.api.gamma.app",
  "cdn.gamma.app",
  "gamma.app",
]);

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url");
  if (!urlParam) return new NextResponse("Missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(urlParam);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return new NextResponse("Forbidden host", { status: 403 });
  }

  const upstream = await fetch(target.toString(), {
    headers: { "User-Agent": "GammaMeet/1.0" },
  });
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Upstream error", { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/pdf",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
