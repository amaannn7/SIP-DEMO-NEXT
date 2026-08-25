export type ReportRangePreset = "today" | "this_week" | "this_month" | "custom";

export type ReportDateRange = { from: Date; to: Date; preset: ReportRangePreset };

/** Server-local calendar boundaries — matches the daily-targets "today" convention used elsewhere in this build. */
export function resolveReportRange(preset: ReportRangePreset, customFrom?: string, customTo?: string, now: Date = new Date()): ReportDateRange {
  if (preset === "custom" && customFrom && customTo) {
    return { from: new Date(`${customFrom}T00:00:00`), to: new Date(`${customTo}T23:59:59.999`), preset };
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (preset === "this_week") {
    // Week starts Monday.
    const day = startOfToday.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(startOfToday);
    monday.setDate(monday.getDate() - diffToMonday);
    return { from: monday, to: endOfToday, preset };
  }

  if (preset === "this_month") {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { from: firstOfMonth, to: endOfToday, preset };
  }

  return { from: startOfToday, to: endOfToday, preset: "today" };
}
