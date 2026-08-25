/** Server-local calendar date as YYYY-MM-DD — matches the source system's viewerToday() concept, without per-user timezone config (not modeled here). */
export function todayDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfDay(dateString: string): Date {
  return new Date(`${dateString}T00:00:00`);
}

export function endOfDay(dateString: string): Date {
  return new Date(`${dateString}T23:59:59.999`);
}
