import { callOutcomeEnum, nextActionEnum } from "@/lib/db/schema";

export type CallOutcome = (typeof callOutcomeEnum.enumValues)[number];
export type NextAction = (typeof nextActionEnum.enumValues)[number];

/** Exact wording, ported verbatim — not paraphrased. */
export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  no_answer_retry: "No answer, will retry",
  left_voicemail: "No answer, left voicemail",
  gatekeeper: "Gatekeeper, could not reach decision-maker",
  wrong_number: "Wrong number / person no longer at company",
  not_interested: "Not interested, asked not to be contacted",
  interested_followup: "Interested, follow-up scheduled",
  consultation_booked: "Consultation booked",
  callback_requested: "Call back requested, date/time noted",
  not_right_time_park_90: "Spoke, not the right time; park for 90 days",
};

export const CALL_OUTCOME_OPTIONS: { value: CallOutcome; label: string }[] = callOutcomeEnum.enumValues.map(
  (value) => ({ value, label: CALL_OUTCOME_LABELS[value] }),
);

/** Exact wording, ported verbatim — Step 4 of the source system's Outcome tab wizard. */
export const NEXT_ACTION_LABELS: Record<NextAction, string> = {
  followup_email: "Send Follow-up Email",
  followup_date: "Schedule Follow-up",
  consultation_booked: "Book Consultation",
  nurture_parked: "Nurture / Park",
};

export const NEXT_ACTION_OPTIONS: { value: NextAction; label: string }[] = nextActionEnum.enumValues.map((value) => ({
  value,
  label: NEXT_ACTION_LABELS[value],
}));
