import { Mail, PhoneCall } from "lucide-react";
import type { TodayActivitySummary } from "@/lib/db/queries/today-dashboard";

/**
 * Was a flat near-black bar with one run-on sentence. Now a compact two-stat
 * card: the numbers are the point, so they get the display weight and the
 * prose is reduced to labels.
 */
export function TodayActivityBanner({ summary }: { summary: TodayActivitySummary }) {
  const stats = [
    {
      icon: Mail,
      value: summary.emailsSentToday,
      label: `Email${summary.emailsSentToday === 1 ? "" : "s"} sent today`,
      tone: "var(--primary)",
    },
    {
      icon: PhoneCall,
      value: summary.callsPredictedTomorrow,
      label: `Call${summary.callsPredictedTomorrow === 1 ? "" : "s"} due tomorrow`,
      tone: "var(--accent)",
    },
  ];

  return (
    <div className="card-surface relative overflow-hidden rounded-xl border border-border bg-card p-5">
      <div
        className="brand-gradient-soft pointer-events-none absolute -top-20 -right-12 size-48 rounded-full blur-3xl"
        aria-hidden
      />
      <div className="relative">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Today&apos;s activity</p>

        <div className="mt-4 grid grid-cols-2 gap-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <span
                className="flex size-8 items-center justify-center rounded-lg"
                style={{ background: `color-mix(in oklch, ${stat.tone} 14%, transparent)`, color: stat.tone }}
              >
                <stat.icon className="size-4" strokeWidth={2} />
              </span>
              <p className="tnum mt-2.5 text-2xl font-bold tracking-tight text-foreground">{stat.value}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {summary.emailsSentToday === 0 && (
          <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
            No emails sent yet today. The queue is waiting.
          </p>
        )}
      </div>
    </div>
  );
}
