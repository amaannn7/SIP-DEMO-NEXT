import { emailOutcomeEnum } from "@/lib/db/schema";

export type EmailOutcome = (typeof emailOutcomeEnum.enumValues)[number];

export const EMAIL_OUTCOME_LABELS: Record<EmailOutcome, string> = {
  replied: "Replied",
  bounced: "Bounced",
  no_response: "No response",
  meeting_booked: "Meeting booked",
};

export const EMAIL_OUTCOME_OPTIONS: { value: EmailOutcome; label: string }[] = emailOutcomeEnum.enumValues.map((value) => ({
  value,
  label: EMAIL_OUTCOME_LABELS[value],
}));
