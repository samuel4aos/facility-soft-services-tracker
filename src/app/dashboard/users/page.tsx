import UsersAdmin from "@/components/ops/UsersAdmin";

export const dynamic = "force-dynamic";

export default function UsersPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">User management</h1>
      <UsersAdmin />
    </>
  );
}
