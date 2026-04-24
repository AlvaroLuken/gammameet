import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RecordClient } from "./RecordClient";

export default async function RecordPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/api/auth/signin?callbackUrl=/record");
  }
  return <RecordClient userName={session.user.name ?? session.user.email} />;
}
