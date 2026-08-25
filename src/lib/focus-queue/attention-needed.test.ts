import { describe, it, expect } from "vitest";
import { findAttentionNeeded, type AttentionLeadInput } from "./attention-needed";

const NOW = new Date("2026-01-15T12:00:00Z");

function makeLead(overrides: Partial<AttentionLeadInput>): AttentionLeadInput {
  return {
    id: "lead-1",
    firstName: "Jamie",
    lastName: "Fox",
    company: "Acme Co",
    stage: "engaged",
    temperature: "warm",
    velocity: "stable",
    fitGrade: null,
    followupDate: null,
    daysSinceActivity: 1,
    ownerId: null,
    ownerName: null,
    callsMadeCount: 0,
    lastCallOutcome: null,
    ...overrides,
  };
}

describe("findAttentionNeeded", () => {
  it("excludes nurture_parked/won/lost leads entirely", () => {
    const leads = [
      makeLead({ id: "a", stage: "won", daysSinceActivity: 30 }),
      makeLead({ id: "b", stage: "lost", daysSinceActivity: 30 }),
      makeLead({ id: "c", stage: "nurture_parked", daysSinceActivity: 30 }),
    ];
    expect(findAttentionNeeded(leads, NOW)).toHaveLength(0);
  });

  it("flags a hot/warm lead going cold after 7+ inactive days", () => {
    const leads = [makeLead({ temperature: "hot", daysSinceActivity: 8 })];
    const result = findAttentionNeeded(leads, NOW);
    expect(result[0].issues.map((i) => i.type)).toContain("going_cold");
  });

  it("does not flag going_cold for a cold lead (already expected to be cold)", () => {
    const leads = [makeLead({ temperature: "cold", daysSinceActivity: 8 })];
    const result = findAttentionNeeded(leads, NOW);
    expect(result.some((r) => r.issues.some((i) => i.type === "going_cold"))).toBe(false);
  });

  it("flags an on_fire lead with stalled velocity as critical", () => {
    const leads = [makeLead({ temperature: "on_fire", velocity: "stalled", daysSinceActivity: 1 })];
    const result = findAttentionNeeded(leads, NOW);
    const issue = result[0].issues.find((i) => i.type === "stalled_hot");
    expect(issue?.severity).toBe("critical");
  });

  it("flags an overdue callback, critical past 3 days", () => {
    const threeDaysOverdue = new Date(NOW.getTime() - 4 * 86_400_000);
    const leads = [makeLead({ followupDate: threeDaysOverdue })];
    const result = findAttentionNeeded(leads, NOW);
    const issue = result[0].issues.find((i) => i.type === "callback_overdue");
    expect(issue?.severity).toBe("critical");
  });

  it("does not flag a same-day followup as overdue", () => {
    const leads = [makeLead({ followupDate: NOW })];
    const result = findAttentionNeeded(leads, NOW);
    expect(result.some((r) => r.issues.some((i) => i.type === "callback_overdue"))).toBe(false);
  });

  it("flags stale research after 5+ days with no outreach", () => {
    const leads = [makeLead({ stage: "research", daysSinceActivity: 6 })];
    const result = findAttentionNeeded(leads, NOW);
    expect(result[0].issues.map((i) => i.type)).toContain("stale_research");
  });

  it("flags 3+ call attempts with no answer and no positive outcome", () => {
    const leads = [makeLead({ callsMadeCount: 3, lastCallOutcome: "left_voicemail" })];
    const result = findAttentionNeeded(leads, NOW);
    const issue = result[0].issues.find((i) => i.type === "multiple_attempts");
    expect(issue?.message).toBe("3 call attempts with no answer");
    expect(issue?.severity).toBe("warning");
  });

  it("flags multiple attempts when no call outcome has been logged at all", () => {
    const leads = [makeLead({ callsMadeCount: 4, lastCallOutcome: null })];
    const result = findAttentionNeeded(leads, NOW);
    expect(result[0].issues.map((i) => i.type)).toContain("multiple_attempts");
  });

  it("does not flag multiple attempts under 3 calls", () => {
    const leads = [makeLead({ callsMadeCount: 2, lastCallOutcome: "no_answer_retry" })];
    const result = findAttentionNeeded(leads, NOW);
    expect(result.some((r) => r.issues.some((i) => i.type === "multiple_attempts"))).toBe(false);
  });

  it("does not flag multiple attempts once a positive outcome is logged", () => {
    const leads = [makeLead({ callsMadeCount: 5, lastCallOutcome: "interested_followup" })];
    const result = findAttentionNeeded(leads, NOW);
    expect(result.some((r) => r.issues.some((i) => i.type === "multiple_attempts"))).toBe(false);
  });

  it("returns nothing for a healthy, recently-active lead", () => {
    const leads = [makeLead({ temperature: "warm", daysSinceActivity: 1, stage: "engaged" })];
    expect(findAttentionNeeded(leads, NOW)).toHaveLength(0);
  });

  it("sorts critical issues before warnings", () => {
    const leads = [
      makeLead({ id: "warn", temperature: "hot", daysSinceActivity: 8 }), // warning
      makeLead({ id: "crit", temperature: "on_fire", velocity: "stalled", daysSinceActivity: 1 }), // critical
    ];
    const result = findAttentionNeeded(leads, NOW);
    expect(result[0].leadId).toBe("crit");
  });
});
