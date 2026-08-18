import ConsumableDetailClient from "@/components/ops/ConsumableDetailClient";

export const dynamic = "force-dynamic";

export default async function ConsumableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <ConsumableDetailClient consumableId={Number(id)} />
    </>
  );
}
