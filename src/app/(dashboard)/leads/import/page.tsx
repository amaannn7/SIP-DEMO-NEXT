import { Topbar } from "@/components/layout/topbar";
import { requireAuthForPage } from "@/lib/auth/session";
import { ImportForm } from "./import-form";

export default async function ImportLeadsPage() {
  await requireAuthForPage();

  return (
    <>
      <Topbar title="Import leads" subtitle="Upload a CSV or Excel file to bulk-add leads" />
      <div className="p-6">
        <div className="card-surface max-w-3xl rounded-xl border border-border bg-card p-6">
          <ImportForm />
        </div>
      </div>
    </>
  );
}
