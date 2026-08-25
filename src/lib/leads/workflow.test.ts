import { describe, it, expect } from "vitest";
import { describeNextActionDetailed, getWorkflowStepStatus, isStepUnlocked } from "./workflow";

type Overrides = Partial<{
  hasEnrichment: boolean;
  emailsSentCount: number;
  callsMadeCount: number;
  stage: string;
  fitGrade: string | null;
  source: string;
  followupDate: Date | null;
  emailSkipped: string | null;
}>;

function makeLead(overrides: Overrides) {
  return {
    hasEnrichment: false,
    emailsSentCount: 0,
    callsMadeCount: 0,
    stage: "new_lead",
    fitGrade: null,
    source: "manual",
    followupDate: null,
    emailSkipped: null,
    ...overrides,
  } as never;
}

describe("describeNextActionDetailed", () => {
  it("prompts research for a brand new lead", () => {
    expect(describeNextActionDetailed(makeLead({}))).toEqual({ label: "Start research", detail: "Verify fit and contact context" });
  });

  it("prompts the first email once research is done", () => {
    expect(describeNextActionDetailed(makeLead({ hasEnrichment: true, stage: "research" }))).toEqual({
      label: "Send first email",
      detail: "Use research to personalize",
    });
  });

  it("prompts preparing a call once an email has been sent", () => {
    expect(describeNextActionDetailed(makeLead({ hasEnrichment: true, emailsSentCount: 1, stage: "email_sent" }))).toEqual({
      label: "Prepare call",
      detail: "Follow up after outreach",
    });
  });

  it("prompts logging the outcome for call_attempted", () => {
    expect(
      describeNextActionDetailed(makeLead({ hasEnrichment: true, emailsSentCount: 1, callsMadeCount: 1, stage: "call_attempted" })),
    ).toEqual({ label: "Log call outcome", detail: "Outcome required" });
  });

  it("prompts booking a consultation for an engaged lead", () => {
    expect(
      describeNextActionDetailed(makeLead({ hasEnrichment: true, emailsSentCount: 1, callsMadeCount: 2, stage: "engaged" })),
    ).toEqual({ label: "Book consultation", detail: "Confirm next conversation" });
  });

  it("gives consultation_booked/nurture_parked/won/lost their own distinct text", () => {
    expect(describeNextActionDetailed(makeLead({ stage: "consultation_booked" }))).toEqual({
      label: "Confirm consultation",
      detail: "Prepare notes and handoff",
    });
    expect(describeNextActionDetailed(makeLead({ stage: "nurture_parked" }))).toEqual({ label: "Review later", detail: "Parked or not ready" });
    expect(describeNextActionDetailed(makeLead({ stage: "won" }))).toEqual({ label: "Closed won", detail: "No active action" });
    expect(describeNextActionDetailed(makeLead({ stage: "lost" }))).toEqual({ label: "Closed lost", detail: "No active action" });
  });

  it("overrides everything for a disqualified new/research lead", () => {
    expect(describeNextActionDetailed(makeLead({ stage: "new_lead", fitGrade: "Disqualified" }))).toEqual({
      label: "Park or reject",
      detail: "Fit grade is disqualified",
    });
    expect(describeNextActionDetailed(makeLead({ stage: "research", hasEnrichment: true, fitGrade: "Disqualified" }))).toEqual({
      label: "Park or reject",
      detail: "Fit grade is disqualified",
    });
  });

  it("does not apply the disqualified override past research (e.g. call_attempted)", () => {
    expect(
      describeNextActionDetailed(makeLead({ stage: "call_attempted", hasEnrichment: true, emailsSentCount: 1, fitGrade: "Disqualified" })),
    ).toEqual({ label: "Log call outcome", detail: "Outcome required" });
  });

  it("overrides to the inbound SLA action for an inbound call_attempted lead", () => {
    expect(describeNextActionDetailed(makeLead({ stage: "call_attempted", source: "inbound" }))).toEqual({
      label: "Call within SLA",
      detail: "Inbound booking lead",
    });
  });

  it("flags an overdue followup ahead of the plain per-stage text", () => {
    const overdue = new Date(Date.now() - 3 * 86_400_000);
    const result = describeNextActionDetailed(makeLead({ stage: "email_sent", hasEnrichment: true, followupDate: overdue }));
    expect(result.label).toBe("Follow-up overdue");
  });

  it("does not flag an overdue followup for a closed-ish stage", () => {
    const overdue = new Date(Date.now() - 3 * 86_400_000);
    const result = describeNextActionDetailed(makeLead({ stage: "nurture_parked", followupDate: overdue }));
    expect(result.label).not.toBe("Follow-up overdue");
  });

  it("flags a future followup as due, not overdue", () => {
    const future = new Date(Date.now() + 3 * 86_400_000);
    const result = describeNextActionDetailed(makeLead({ stage: "email_sent", hasEnrichment: true, followupDate: future }));
    expect(result.label).toBe("Follow up");
  });
});

describe("isStepUnlocked", () => {
  it("locks Email until research is done", () => {
    expect(isStepUnlocked("email", makeLead({ hasEnrichment: false }))).toBe(false);
    expect(isStepUnlocked("email", makeLead({ hasEnrichment: true }))).toBe(true);
  });

  it("locks Call until an email has actually been sent, not merely research done", () => {
    expect(isStepUnlocked("call", makeLead({ hasEnrichment: true, emailsSentCount: 0 }))).toBe(false);
    expect(isStepUnlocked("call", makeLead({ hasEnrichment: true, emailsSentCount: 1 }))).toBe(true);
  });

  it("also unlocks Call when Email was explicitly skipped rather than sent (skipEmailAction always lands stage on call_attempted)", () => {
    expect(
      isStepUnlocked("call", makeLead({ hasEnrichment: true, emailsSentCount: 0, emailSkipped: "phone_preferred", stage: "call_attempted" })),
    ).toBe(true);
  });

  it("also unlocks Call once a call has been started, even with no email sent or skipped (startCallAction lands stage on call_attempted too)", () => {
    expect(isStepUnlocked("call", makeLead({ hasEnrichment: true, emailsSentCount: 0, stage: "call_attempted" }))).toBe(true);
  });

  it("does NOT unlock Call from emailSkipped alone if stage somehow wasn't advanced with it", () => {
    // Guards against the earlier bug: isStepUnlocked used to special-case
    // emailSkipped directly rather than reading stage, so this state (which
    // can't happen through skipEmailAction, but shouldn't be trusted anyway)
    // would have incorrectly unlocked Call.
    expect(
      isStepUnlocked("call", makeLead({ hasEnrichment: true, emailsSentCount: 0, emailSkipped: "phone_preferred", stage: "research" })),
    ).toBe(false);
  });

  it("never locks Outcome", () => {
    expect(isStepUnlocked("outcome", makeLead({ hasEnrichment: false, emailsSentCount: 0 }))).toBe(true);
  });
});

describe("getWorkflowStepStatus", () => {
  it("marks call done by stage membership, not by callsMadeCount", () => {
    const status = getWorkflowStepStatus(makeLead({ hasEnrichment: true, emailsSentCount: 1, callsMadeCount: 0, stage: "consultation_booked" }));
    expect(status.call).toBe("done");
  });

  it("marks outcome done for engaged, not just fully-closed stages", () => {
    const status = getWorkflowStepStatus(makeLead({ hasEnrichment: true, emailsSentCount: 1, stage: "engaged" }));
    expect(status.outcome).toBe("done");
  });

  it("sets current to call for call_attempted/engaged even if research+email are also done", () => {
    const status = getWorkflowStepStatus(makeLead({ hasEnrichment: true, emailsSentCount: 1, stage: "call_attempted" }));
    expect(status.call).toBe("current");
  });

  it("sets current to outcome for the later closed-ish stages", () => {
    const status = getWorkflowStepStatus(makeLead({ hasEnrichment: true, emailsSentCount: 1, stage: "won" }));
    expect(status.outcome).toBe("current");
  });
});
