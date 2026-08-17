import OverviewClient from "@/components/ops/Overview";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Compliance overview</h1>
      <OverviewClient />
    </>
  );
}
