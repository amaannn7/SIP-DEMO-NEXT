/**
 * Split out of grade-override-actions.ts (a "use server" module) because a
 * plain data constant can't safely cross that boundary — Next.js only allows
 * async functions to be exported from a "use server" file; other exports get
 * replaced at build time and arrive as something other than the real value on
 * the client (surfaced here as "GRADE_OVERRIDE_REASONS.map is not a
 * function"). Both the server action (for its zod enum) and the client
 * control (for rendering the radio options) import from here instead.
 */
export const GRADE_OVERRIDE_REASONS = [
  { id: "warm_referral", label: "Warm referral / introduction" },
  { id: "strategic", label: "Strategic account" },
  { id: "urgency", label: "High urgency signal identified" },
  { id: "management", label: "Management override" },
  { id: "other", label: "Other (specify)" },
] as const;
