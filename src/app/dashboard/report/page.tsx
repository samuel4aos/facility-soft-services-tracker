import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ReportIssueClient from "@/components/ops/ReportIssueClient";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const session = await getSession();
  if (!session) redirect("/login?mode=password");
  if (session.role !== "super_admin") redirect("/dashboard");

  return <ReportIssueClient user={session} />;
}
