import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DashboardClient from "./DashboardClient";
import { ReauthBanner } from "@/components/ReauthBanner";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/");

  const { data: userRow } = await supabase
    .from("users")
    .select("needs_reauth")
    .eq("email", session.user.email!)
    .maybeSingle();

  const needsReauth = !!userRow?.needs_reauth;

  return (
    <>
      {needsReauth && <ReauthBanner />}
      <DashboardClient user={{ name: session.user.name ?? "", email: session.user.email ?? "", image: session.user.image ?? null }} />
    </>
  );
}
