import AuditViewer from "@/components/ops/AuditViewer";

export const dynamic = "force-dynamic";

export default function AuditPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Audit trail</h1>
      <AuditViewer />
    </>
  );
}
