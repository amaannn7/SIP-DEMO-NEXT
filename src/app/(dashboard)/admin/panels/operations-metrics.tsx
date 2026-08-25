import Link from "next/link";
import { Target, CheckCircle2, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { StatTile } from "@/components/dashboard/stat-tile";
import type { OperationsMetrics } from "@/lib/db/queries/admin-dashboard";

/**
 * Reuses the shared StatTile rather than the near-duplicate local `Tile` this
 * panel used to carry — same icon-chip + display-numeral treatment as the rep
 * dashboard, so a KPI looks identical wherever it appears. Accent is chosen by
 * meaning: warnings go magenta/red only when the count is actually non-zero.
 */
export function OperationsMetricsRow({ metrics }: { metrics: OperationsMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <StatTile label="Active Pipeline" value={metrics.activePipeline} icon={Target} accent="primary" hint="Open leads" />

      <Link href="/leads?stage=consultation_booked" className="block">
        <StatTile
          label="Consultations MTD"
          value={metrics.consultationsMtd}
          icon={CheckCircle2}
          accent="success"
          hint="Month to date"
        />
      </Link>

      <Link href="/leads" className="block">
        <StatTile
          label="Overdue Actions"
          value={metrics.overdueActions}
          icon={AlertTriangle}
          accent={metrics.overdueActions > 0 ? "accent" : "primary"}
          hint={metrics.overdueActions > 0 ? "Needs attention" : "All clear"}
        />
      </Link>

      <StatTile
        label="Stale Stages"
        value={metrics.staleStages}
        icon={Clock}
        accent={metrics.staleStages > 0 ? "warning" : "primary"}
        hint={metrics.staleStages > 0 ? "Aging past threshold" : "Nothing stalled"}
      />

      <StatTile
        label="Response Rate"
        value={`${metrics.responseRatePercent}%`}
        icon={TrendingUp}
        accent="success"
        hint="Replies per email sent"
      />
    </div>
  );
}
