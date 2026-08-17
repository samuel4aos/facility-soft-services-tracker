import LogsView from "@/components/ops/LogsView";

export const dynamic = "force-dynamic";

export default function LogsPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Task logs &amp; schedule calendar</h1>
      <LogsView />
    </>
  );
}
