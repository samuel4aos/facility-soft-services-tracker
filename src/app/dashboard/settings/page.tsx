import SettingsClient from "@/components/ops/SettingsClient";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Settings</h1>
      <SettingsClient />
    </>
  );
}
