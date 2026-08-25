import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { TemperatureBadge } from "@/components/leads/temperature-badge";
import { LeadDetailBody, loadLeadDetail } from "@/components/leads/lead-detail-body";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadLeadDetail(id);
  if (!data) notFound();

  const { lead } = data;
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unnamed lead";
  const isStalled = lead.velocity === "stalled";

  return (
    <>
      <Topbar
        title={name}
        subtitle={lead.company ?? undefined}
        backHref="/leads"
        backLabel="Back to Leads"
        titleAccessory={
          <div className="flex items-center gap-1.5">
            {lead.temperature && <TemperatureBadge temperature={lead.temperature} />}
            {isStalled && (
              <span className="inline-flex shrink-0 items-center rounded-full border border-destructive/40 bg-destructive/5 px-2 py-0.5 text-[11px] font-medium text-destructive">
                Stalled
              </span>
            )}
          </div>
        }
      />
      {/* Full page now (the slide-over sheet was removed), so the single-column
          content from the old narrow panel gets real width to breathe in
          rather than staying capped at the sheet's old max-w-2xl. */}
      <div className="mx-auto max-w-5xl p-6">
        <LeadDetailBody data={data} />
      </div>
    </>
  );
}
