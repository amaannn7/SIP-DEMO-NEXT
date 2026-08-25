export const SKIP_DURATIONS = {
  "1hour": { label: "1 hour", ms: 60 * 60 * 1000 },
  "1day": { label: "1 day", ms: 24 * 60 * 60 * 1000 },
  "3days": { label: "3 days", ms: 3 * 24 * 60 * 60 * 1000 },
  "1week": { label: "1 week", ms: 7 * 24 * 60 * 60 * 1000 },
} as const;

export type SkipDuration = keyof typeof SKIP_DURATIONS;
