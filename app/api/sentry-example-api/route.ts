import { NextResponse } from "next/server";

export function GET() {
  throw new Error("Sentry server test — " + new Date().toISOString());
  return NextResponse.json({ ok: true });
}
