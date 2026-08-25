export type NotificationType = "hot_lead" | "callback_due" | "callback_overdue" | "going_cold" | "stale_research";

export type GeneratedNotification = {
  dedupeKey: string;
  type: NotificationType;
  leadId: string;
  title: string;
  body: string;
};

export type NotificationLeadInput = {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  stage: string;
  temperature: "on_fire" | "hot" | "warm" | "cold" | null;
  followupDate: Date | null;
  daysSinceActivity: number;
};

function toDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Ports the source system's generateNotifications: per-lead checks that
 * each produce at most one notification, keyed so a re-run never creates a
 * duplicate for an issue that's already unread. `existingKeys` is the set
 * of dedupeKeys already present (read or unread) for this user — the
 * source system only checked unread ones, but persisting is now a real
 * unique-indexed insert (see schema.ts), so re-showing a re-dismissed
 * notification isn't needed the way it was for the source's ephemeral
 * generation model.
 */
export function generateNotifications(leads: NotificationLeadInput[], existingKeys: Set<string>, now: Date = new Date()): GeneratedNotification[] {
  const today = toDayString(now);
  const generated: GeneratedNotification[] = [];

  for (const lead of leads) {
    if (["nurture_parked", "won", "lost"].includes(lead.stage)) continue;

    const name = `${lead.firstName} ${lead.lastName}`.trim();
    const company = lead.company ?? "";
    const temp = lead.temperature ?? "cold";
    const { daysSinceActivity, stage } = lead;

    const checks: { cond: boolean; key: string; type: NotificationType; title: string; body: string }[] = [
      {
        cond: (temp === "on_fire" || temp === "hot") && daysSinceActivity >= 1,
        key: `hot_lead_${lead.id}`,
        type: "hot_lead",
        title: "Hot lead needs attention",
        body: `${name} from ${company} hasn't been contacted in ${daysSinceActivity} day(s)`,
      },
      {
        cond: lead.followupDate !== null && toDayString(lead.followupDate) === today,
        key: `callback_due_${lead.id}`,
        type: "callback_due",
        title: "Callback due today",
        body: `${name} from ${company}`,
      },
      {
        cond: lead.followupDate !== null && lead.followupDate.getTime() < now.getTime() && toDayString(lead.followupDate) < today,
        key: `callback_overdue_${lead.id}`,
        type: "callback_overdue",
        title: "Callback overdue",
        body: `${name} from ${company}, ${lead.followupDate ? Math.floor((now.getTime() - lead.followupDate.getTime()) / 86_400_000) : 0} day(s) overdue`,
      },
      {
        cond: (temp === "hot" || temp === "warm") && daysSinceActivity >= 7 && daysSinceActivity < 14,
        key: `going_cold_${lead.id}`,
        type: "going_cold",
        title: "Lead going cold",
        body: `${name} from ${company}, ${daysSinceActivity} days inactive`,
      },
      {
        cond: stage === "research" && daysSinceActivity >= 3,
        key: `stale_research_${lead.id}`,
        type: "stale_research",
        title: `Send outreach to ${name}`,
        body: `Research done ${daysSinceActivity} days ago, ${company}`,
      },
      {
        cond: stage === "email_sent" && daysSinceActivity >= 3,
        key: `followup_call_${lead.id}`,
        type: "callback_due",
        title: "Follow-up call needed",
        body: `${name} from ${company}, email sent ${daysSinceActivity} days ago`,
      },
      {
        cond: stage === "new_lead" && daysSinceActivity >= 2,
        key: `new_lead_idle_${lead.id}`,
        type: "stale_research",
        title: "New lead needs attention",
        body: `${name} from ${company}, added ${daysSinceActivity} days ago`,
      },
    ];

    for (const check of checks) {
      if (check.cond && !existingKeys.has(check.key)) {
        generated.push({ dedupeKey: check.key, type: check.type, leadId: lead.id, title: check.title, body: check.body });
        existingKeys.add(check.key);
      }
    }
  }

  return generated;
}
