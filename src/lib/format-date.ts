// Every date rendered from server-rendered content must format identically
// on the server and in the browser, or React throws a hydration mismatch —
// `toLocaleDateString()` with no locale argument uses the server's OS locale
// during SSR and the visitor's browser locale during hydration, which can
// disagree (e.g. en-US "8/18/2026" vs a browser set to en-GB "18/08/2026").
// Pinning a fixed locale here, instead of at every call site, means a new
// date added anywhere in the app can't reintroduce this bug by omission.
const LOCALE = "en-US";

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString(LOCALE, { month: "short", day: "numeric" });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString(LOCALE);
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString(LOCALE);
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });
}

export function formatWeekdayDate(date: Date): string {
  return date.toLocaleDateString(LOCALE, { weekday: "long", month: "short", day: "numeric" });
}

/** "3m ago" / "2h ago" / "5d ago", falling back to a plain date past a week — ports the source system's getTimeAgo exactly. */
export function formatTimeAgo(date: Date): string {
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
  return formatDate(date);
}

/** "1h 30m" / "45m" — ports the source system's _fmtMins exactly. */
export function formatActiveMins(totalMins: number): string {
  if (!totalMins) return "0m";
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

/** "Aug 18, 2:30 PM" — ports the source system's _fmtDT exactly. */
export function formatDateTimeShort(date: Date): string {
  return date.toLocaleString(LOCALE, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
