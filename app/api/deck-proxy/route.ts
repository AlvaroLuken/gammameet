import { NextRequest, NextResponse } from "next/server";

// Proxy PDFs so the browser can fetch them without CORS issues.
// Allowed hosts: Gamma's CDNs (for legacy meetings still pointing at presigned
// Gamma URLs) and our own Supabase Storage host (new meetings archive their
// PDF there so the link is permanent).
const SUPABASE_HOST = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname; }
  catch { return null; }
})();
const ALLOWED_HOSTS = new Set(
  [
    "assets.api.gamma.app",
    "cdn.gamma.app",
    "gamma.app",
    SUPABASE_HOST,
  ].filter((h): h is string => !!h)
);

// Gamma exports are presigned S3 URLs that expire after a few weeks.
// When they expire S3 returns 403 with an XML <Error><Code>AccessDenied</Code> body.
// We surface this as 410 Gone so the client can show an "expired" UI instead of
// embedding the raw S3 XML response.
function parseTarget(req: NextRequest): URL | NextResponse {
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
  return target;
}

export async function HEAD(req: NextRequest) {
  const target = parseTarget(req);
  if (target instanceof NextResponse) return target;

  const upstream = await fetch(target.toString(), {
    method: "HEAD",
    headers: { "User-Agent": "GammaMeet/1.0" },
  });
  if (upstream.status === 403 || upstream.status === 404) {
    return new NextResponse(null, { status: 410 });
  }
  if (!upstream.ok) return new NextResponse(null, { status: 502 });
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: NextRequest) {
  const target = parseTarget(req);
  if (target instanceof NextResponse) return target;

  const upstream = await fetch(target.toString(), {
    headers: { "User-Agent": "GammaMeet/1.0" },
  });
  if (upstream.status === 403 || upstream.status === 404) {
    return new NextResponse("Deck preview expired", { status: 410 });
  }
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
