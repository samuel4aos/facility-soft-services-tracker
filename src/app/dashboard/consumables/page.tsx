import ConsumablesClient from "@/components/ops/ConsumablesClient";

export const dynamic = "force-dynamic";

export default function ConsumablesPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Consumables</h1>
      <ConsumablesClient />
    </>
  );
}
