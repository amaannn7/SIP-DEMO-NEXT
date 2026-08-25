import Link from "next/link";
import { Phone, Mail, ChevronRight, type LucideIcon } from "lucide-react";
import { SectionCard, SectionEmpty } from "@/components/shared/section-card";
import type { ActionCardLead } from "@/lib/db/queries/today-dashboard";

/** `ActionCardLead` carries a single combined `name`, so initials are derived here rather than via LeadAvatar (which takes first/last separately). */
function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function ActionCard({
  title,
  icon: Icon,
  tone,
  items,
  total,
}: {
  title: string;
  icon: LucideIcon;
  tone: string;
  items: ActionCardLead[];
  total: number;
}) {
  return (
    <SectionCard
      title={title}
      count={total}
      action={
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in oklch, ${tone} 14%, transparent)`, color: tone }}
        >
          <Icon className="size-4" strokeWidth={2} />
        </span>
      }
    >
      {items.length === 0 ? (
        <SectionEmpty>Nothing here right now.</SectionEmpty>
      ) : (
        <div className="-mx-2 space-y-0.5">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/leads/${item.id}`}
              className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/70"
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                style={{ background: `color-mix(in oklch, ${tone} 14%, transparent)`, color: tone }}
                aria-hidden
              >
                {initials(item.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">{item.name}</p>
                {item.company && <p className="truncate text-[11px] text-muted-foreground">{item.company}</p>}
              </div>
              {item.detail && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {item.detail}
                </span>
              )}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      )}
      {total > items.length && (
        <p className="mt-3 text-[11px] text-muted-foreground">+{total - items.length} more</p>
      )}
    </SectionCard>
  );
}

export function ActionCardsGrid({
  todaysCalls,
  emailsToSend,
}: {
  todaysCalls: { items: ActionCardLead[]; total: number };
  emailsToSend: { items: ActionCardLead[]; total: number };
}) {
  return (
    // `items-start` so an empty "Today's calls" doesn't get stretched to the
    // height of a full "Emails to send" list, leaving a tall blank card.
    <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2">
      <ActionCard
        title="Today's calls"
        icon={Phone}
        tone="var(--primary)"
        items={todaysCalls.items}
        total={todaysCalls.total}
      />
      <ActionCard
        title="Emails to send"
        icon={Mail}
        tone="var(--accent)"
        items={emailsToSend.items}
        total={emailsToSend.total}
      />
    </div>
  );
}
