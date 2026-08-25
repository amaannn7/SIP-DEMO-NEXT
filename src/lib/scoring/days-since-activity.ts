/**
 * Days since a lead's last activity, floored to whole days. Ports the
 * source system's calculateDaysSinceLastActivity: falls back through
 * lastActivityAt, then an overdue followupDate, then createdAt.
 */
export function calculateDaysSinceActivity(
  lead: {
    lastActivityAt: Date | null;
    followupDate: Date | null;
    createdAt: Date;
  },
  now: Date = new Date(),
): number {
  let lastActivityDate: Date | null = lead.lastActivityAt;

  // A followup date already in the past means "we should have acted by
  // then" — treat it as the most recent known activity if it's later than
  // what we already have.
  if (lead.followupDate && lead.followupDate.getTime() < now.getTime()) {
    if (!lastActivityDate || lead.followupDate.getTime() > lastActivityDate.getTime()) {
      lastActivityDate = lead.followupDate;
    }
  }

  if (!lastActivityDate) {
    lastActivityDate = lead.createdAt;
  }

  const diffMs = now.getTime() - lastActivityDate.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}
