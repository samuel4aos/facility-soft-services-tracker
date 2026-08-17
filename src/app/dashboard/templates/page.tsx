import TemplatesAdmin from "@/components/ops/TemplatesAdmin";

export const dynamic = "force-dynamic";

export default function TemplatesPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Schedule administration</h1>
      <p className="mb-4 text-sm text-slate-500">
        The recurrence engine drives everything — add tasks or change frequencies here and
        occurrences regenerate automatically.
      </p>
      <TemplatesAdmin />
    </>
  );
}
