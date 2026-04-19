import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/");
  return <DashboardClient user={{ name: session.user.name ?? "", email: session.user.email ?? "", image: session.user.image ?? null }} />;
}
