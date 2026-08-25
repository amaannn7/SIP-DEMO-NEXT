import { Phone, Mail, Search, RotateCcw, CalendarCheck, Eye, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_CONFIG = {
  call: { label: "Call", icon: Phone, classes: "bg-[var(--chart-2)]/10 text-[var(--chart-2)]" },
  email: { label: "Email", icon: Mail, classes: "bg-[var(--accent)]/12 text-[var(--accent)]" },
  research: { label: "Research", icon: Search, classes: "bg-[var(--chart-3)]/12 text-[var(--chart-3)]" },
  followup: { label: "Follow up", icon: RotateCcw, classes: "bg-[var(--chart-2)]/10 text-[var(--chart-2)]" },
  consultation: { label: "Consultation", icon: CalendarCheck, classes: "bg-success/12 text-success" },
  review: { label: "Review", icon: Eye, classes: "bg-muted text-muted-foreground" },
  nurture: { label: "Nurture", icon: Snowflake, classes: "bg-muted text-muted-foreground" },
} as const;

export type FocusQueueAction = keyof typeof ACTION_CONFIG;

export function ActionBadge({ action }: { action: FocusQueueAction }) {
  const config = ACTION_CONFIG[action] ?? ACTION_CONFIG.review;
  const { icon: Icon, classes, label } = config;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold", classes)}>
      <Icon className="size-3" strokeWidth={2.5} />
      {label}
    </span>
  );
}
