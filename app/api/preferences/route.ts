import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export interface DashboardPrefs {
  showUpcoming: boolean;
  showProcessing: boolean;
  showFailed: boolean;
}

const defaults: DashboardPrefs = {
  showUpcoming: false,
  showProcessing: false,
  showFailed: false,
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json(defaults);

  const { data } = await supabase
    .from("users")
    .select("dashboard_prefs")
    .eq("email", session.user.email)
    .single();

  return NextResponse.json({ ...defaults, ...(data?.dashboard_prefs ?? {}) });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Partial<DashboardPrefs>;
  const prefs: DashboardPrefs = {
    showUpcoming: body.showUpcoming ?? false,
    showProcessing: body.showProcessing ?? false,
    showFailed: body.showFailed ?? false,
  };

  await supabase
    .from("users")
    .update({ dashboard_prefs: prefs })
    .eq("email", session.user.email);

  return NextResponse.json(prefs);
}
