import type { leads } from "@/lib/db/schema";
import { formatShortDate } from "@/lib/format-date";

export type WorkflowStep = "profile" | "research" | "email" | "call" | "outcome";

export const WORKFLOW_STEPS: { key: WorkflowStep; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "research", label: "Research" },
  { key: "email", label: "Email" },
  { key: "call", label: "Call" },
  { key: "outcome", label: "Outcome" },
];

type WorkflowLead = Pick<
  typeof leads.$inferSelect,
  "hasEnrichment" | "emailsSentCount" | "callsMadeCount" | "stage" | "fitGrade" | "source" | "followupDate" | "emailSkipped"
>;

// Stage sets ported verbatim from the source system's renderLeadWorkflow —
// Call/Outcome "done" is determined by which stage the lead has reached,
// not simply "a call/outcome was ever logged."
const CALL_DONE_STAGES = new Set(["call_attempted", "engaged", "consultation_booked", "won"]);
const OUTCOME_DONE_STAGES = new Set(["engaged", "consultation_booked", "nurture_parked", "won", "lost"]);
// The source system's "emailSent" gate for unlocking Call is a disjunction of
// stage membership OR emails_sent>0 (index.html renderLeadModal), not
// emails_sent alone — a lead that reached call_attempted some other way (e.g.
// starting a call before any email) still counts as "emailSent" for gating
// purposes. Kept as its own set so isStepUnlocked ports that exact condition
// rather than approximating it via emailSkipped.
const CALL_UNLOCKED_STAGES = new Set(["email_sent", "call_attempted", "engaged", "consultation_booked", "won"]);
const CURRENT_IDX_TO_STEP: WorkflowStep[] = ["profile", "research", "email", "call", "outcome"];

/**
 * Derives workflow-step completion + which step is "current" — ports the
 * source system's renderLeadWorkflow exactly, including its specific
 * currentIdx precedence (email/research-based by default, overridden by
 * call_attempted/engaged, overridden again by the later closed-ish stages).
 */
export function getWorkflowStepStatus(lead: WorkflowLead): Record<WorkflowStep, "done" | "current" | "upcoming"> {
  const hasResearch = lead.hasEnrichment;
  const emailSent = lead.emailsSentCount > 0;

  const done: Record<WorkflowStep, boolean> = {
    profile: true,
    research: hasResearch,
    email: emailSent,
    call: CALL_DONE_STAGES.has(lead.stage),
    outcome: OUTCOME_DONE_STAGES.has(lead.stage),
  };

  let currentIdx = hasResearch ? (emailSent ? 3 : 2) : 1;
  if (lead.stage === "call_attempted" || lead.stage === "engaged") currentIdx = 3;
  if (["consultation_booked", "nurture_parked", "won", "lost"].includes(lead.stage)) currentIdx = 4;
  const currentStep = CURRENT_IDX_TO_STEP[currentIdx];

  const status = {} as Record<WorkflowStep, "done" | "current" | "upcoming">;
  for (const step of CURRENT_IDX_TO_STEP) {
    status[step] = step === currentStep ? "current" : done[step] ? "done" : "upcoming";
  }
  return status;
}

/**
 * Email tab needs research; Call tab needs an email actually sent (not just
 * research) — ports the source system's emailTabLocked/callPitchTabLocked
 * exactly. Outcome has no lock condition in the source system at all.
 */
export function isStepUnlocked(step: WorkflowStep, lead: WorkflowLead): boolean {
  if (step === "email") return lead.hasEnrichment;
  // Ports the source system's exact "emailSent" gate: stage membership OR
  // emails_sent>0 — not emails_sent alone. Skipping Email (emailSkipped) and
  // starting a call (startCallAction) both land the lead in
  // CALL_UNLOCKED_STAGES directly, so they're already covered by stage
  // membership without needing their own special-cased checks here.
  if (step === "call") return CALL_UNLOCKED_STAGES.has(lead.stage) || lead.emailsSentCount > 0;
  return true;
}

export function describeNextAction(lead: WorkflowLead): string {
  return describeNextActionDetailed(lead).label;
}

const STAGE_ACTIONS: Record<string, { label: string; detail: string }> = {
  new_lead: { label: "Start research", detail: "Verify fit and contact context" },
  research: { label: "Send first email", detail: "Use research to personalize" },
  email_sent: { label: "Prepare call", detail: "Follow up after outreach" },
  call_attempted: { label: "Log call outcome", detail: "Outcome required" },
  engaged: { label: "Book consultation", detail: "Confirm next conversation" },
  consultation_booked: { label: "Confirm consultation", detail: "Prepare notes and handoff" },
  nurture_parked: { label: "Review later", detail: "Parked or not ready" },
  won: { label: "Closed won", detail: "No active action" },
  lost: { label: "Closed lost", detail: "No active action" },
};

/**
 * Ports the source system's leadNextAction exactly: four priority overrides
 * (disqualified grade, inbound-lead SLA, overdue followup, due followup)
 * checked in order before falling back to the plain per-stage text.
 */
export function describeNextActionDetailed(lead: WorkflowLead): { label: string; detail: string } {
  const { stage } = lead;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const followupDay = lead.followupDate
    ? new Date(lead.followupDate.getFullYear(), lead.followupDate.getMonth(), lead.followupDate.getDate())
    : null;
  const isOverdue = followupDay !== null && followupDay < today && !["consultation_booked", "nurture_parked", "won", "lost"].includes(stage);

  if (lead.fitGrade === "Disqualified" && (stage === "new_lead" || stage === "research")) {
    return { label: "Park or reject", detail: "Fit grade is disqualified" };
  }
  if (lead.source === "inbound" && stage === "call_attempted") {
    return { label: "Call within SLA", detail: "Inbound booking lead" };
  }
  if (isOverdue && followupDay) {
    return { label: "Follow-up overdue", detail: `Due ${formatShortDate(followupDay)}` };
  }
  if (followupDay && stage !== "won" && stage !== "lost") {
    return { label: "Follow up", detail: `Due ${formatShortDate(followupDay)}` };
  }

  return STAGE_ACTIONS[stage] ?? { label: "Review lead", detail: "Check stage and owner" };
}
