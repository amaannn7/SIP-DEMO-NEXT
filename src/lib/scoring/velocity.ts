export type Velocity = "accelerating" | "stable" | "slowing" | "stalled";

/**
 * Ports the source system's calculateVelocity: compares activity-event
 * timestamps in the last 7 days against the 7 days before that.
 */
export function calculateVelocity(activityTimestamps: Date[], daysSinceActivity: number, now: Date = new Date()): Velocity {
  if (daysSinceActivity >= 14) {
    return "stalled";
  }

  const nowMs = now.getTime();
  const sevenDaysAgo = nowMs - 7 * 86_400_000;
  const fourteenDaysAgo = nowMs - 14 * 86_400_000;

  let recentCount = 0;
  let previousCount = 0;

  for (const ts of activityTimestamps) {
    const t = ts.getTime();
    if (t >= sevenDaysAgo) {
      recentCount++;
    } else if (t >= fourteenDaysAgo) {
      previousCount++;
    }
  }

  if (previousCount === 0) {
    return recentCount > 0 ? "accelerating" : "stalled";
  }

  const changeRatio = recentCount / Math.max(1, previousCount);
  if (changeRatio >= 1.5) return "accelerating";
  if (changeRatio >= 0.75) return "stable";
  if (changeRatio >= 0.5) return "slowing";
  return "stalled";
}
