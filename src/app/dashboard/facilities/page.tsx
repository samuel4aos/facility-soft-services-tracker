import FacilitiesAdmin from "@/components/ops/FacilitiesAdmin";

export const dynamic = "force-dynamic";

export default function FacilitiesPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Facilities</h1>
      <FacilitiesAdmin />
    </>
  );
}
