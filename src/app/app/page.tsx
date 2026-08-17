import { redirect } from "next/navigation";
import JanitorApp from "@/components/JanitorApp";
import { getSession } from "@/lib/auth";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function JanitorPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <JanitorApp user={{ id: session.id, name: session.name }} today={todayISO()} />;
}
