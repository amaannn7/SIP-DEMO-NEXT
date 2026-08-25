import { Topbar } from "@/components/layout/topbar";
import { requireAuthForPage } from "@/lib/auth/session";
import { NewLeadForm } from "./new-lead-form";

export default async function NewLeadPage() {
  await requireAuthForPage();

  return (
    <>
      <Topbar title="Add lead" subtitle="Create a new lead manually" />
      <div className="p-6">
        <div className="card-surface max-w-2xl rounded-xl border border-border bg-card p-6">
          <NewLeadForm />
        </div>
      </div>
    </>
  );
}
