import OverviewClient from "@/components/ops/Overview";
import JanitorCompletions from "@/components/ops/JanitorCompletions";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Compliance overview</h1>
      <OverviewClient />
      <div className="mt-6">
        <JanitorCompletions />
      </div>
    </>
  );
}
