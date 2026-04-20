import { NextResponse } from "next/server";
import { auth, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;

  // Look up the user
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (user) {
    // Delete meeting invites
    await supabase.from("meeting_invites").delete().eq("email", email);

    // Delete meetings owned by this user
    await supabase.from("meetings").delete().eq("user_id", user.id);

    // Delete the user record
    await supabase.from("users").delete().eq("id", user.id);
  }

  await signOut({ redirect: false });

  return NextResponse.json({ ok: true });
}
