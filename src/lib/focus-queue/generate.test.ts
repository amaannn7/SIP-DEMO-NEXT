import { describe, it, expect } from "vitest";
import { generateFocusQueue, type FocusQueueLeadInput } from "./generate";

const NOW = new Date("2026-01-15T12:00:00Z");
const SLA_DAYS = {
  new_lead: 1,
  research: 1,
  email_sent: 5,
  call_attempted: 3,
  engaged: 7,
  consultation_booked: 14,
  nurture_parked: 90,
};

function makeLead(overrides: Partial<FocusQueueLeadInput>): FocusQueueLeadInput {
  return {
    id: "lead-1",
    firstName: "Jamie",
    lastName: "Fox",
    company: "Acme Co",
    title: "Manager",
    source: "manual",
    stage: "new_lead",
    temperature: "cold",
    velocity: "stalled",
    fitGrade: null,
    followupDate: null,
    skippedUntil: null,
    createdAt: NOW,
    daysSinceActivity: 10,
    ownerId: null,
    ownerName: null,
    lastCallOutcome: null,
    ...overrides,
  };
}

describe("generateFocusQueue", () => {
  it("excludes won/lost/nurture_parked leads entirely", () => {
    const leads = [makeLead({ id: "a", stage: "won" }), makeLead({ id: "b", stage: "lost" }), makeLead({ id: "c", stage: "nurture_parked" })];
    const { items, total } = generateFocusQueue(leads, SLA_DAYS, 10, NOW);
    expect(items).toHaveLength(0);
    expect(total).toBe(0);
  });

  it("excludes snoozed leads until their skippedUntil passes", () => {
    const future = new Date(NOW.getTime() + 86_400_000);
    const past = new Date(NOW.getTime() - 86_400_000);
    const leads = [makeLead({ id: "snoozed", skippedUntil: future }), makeLead({ id: "unsnoozed", skippedUntil: past })];
    const { items } = generateFocusQueue(leads, SLA_DAYS, 10, NOW);
    expect(items.map((i) => i.leadId)).toEqual(["unsnoozed"]);
  });

  it("gives inbound call_attempted leads the highest priority", () => {
    const leads = [
      makeLead({ id: "inbound", source: "inbound", stage: "call_attempted" }),
      makeLead({ id: "hot", stage: "consultation_booked", temperature: "on_fire" }),
    ];
    const { items } = generateFocusQueue(leads, SLA_DAYS, 10, NOW);
    expect(items[0].leadId).toBe("inbound");
    expect(items[0].urgency).toBe("critical");
    expect(items[0].reason).toContain("call within 2 hours");
  });

  it("boosts an overdue followup and reports days overdue", () => {
    const overdueDate = new Date(NOW.getTime() - 3 * 86_400_000);
    // engaged has a 7-day SLA, and daysSinceActivity=1 keeps SLA itself
    // on_track — isolates the followup-overdue urgency bump from the SLA
    // override (which always wins when SLA is independently critical).
    const leads = [makeLead({ id: "overdue", stage: "engaged", daysSinceActivity: 1, followupDate: overdueDate })];
    const { items } = generateFocusQueue(leads, SLA_DAYS, 10, NOW);
    expect(items[0].isOverdue).toBe(true);
    expect(items[0].reason).toMatch(/overdue by \d+ day/);
    expect(items[0].urgency).toBe("high");
  });

  it("lets a critical SLA status override the followup-overdue urgency", () => {
    const overdueDate = new Date(NOW.getTime() - 3 * 86_400_000);
    // new_lead's 1-day SLA is blown far past critical (2x) by daysSinceActivity=10.
    const leads = [makeLead({ id: "overdue", stage: "new_lead", daysSinceActivity: 10, followupDate: overdueDate })];
    const { items } = generateFocusQueue(leads, SLA_DAYS, 10, NOW);
    expect(items[0].urgency).toBe("critical");
  });

  it("flags a same-day followup as due today, not overdue", () => {
    const leads = [makeLead({ id: "today", followupDate: NOW })];
    const { items } = generateFocusQueue(leads, SLA_DAYS, 10, NOW);
    expect(items[0].isOverdue).toBe(false);
    expect(items[0].reason).toBe("Callback due today");
  });

  it("penalizes stalled velocity and rewards accelerating velocity", () => {
    const stalled = makeLead({ id: "stalled", velocity: "stalled", stage: "engaged" });
    const accelerating = makeLead({ id: "accelerating", velocity: "accelerating", stage: "engaged" });
    const { items } = generateFocusQueue([stalled, accelerating], SLA_DAYS, 10, NOW);
    const stalledItem = items.find((i) => i.leadId === "stalled")!;
    const accelItem = items.find((i) => i.leadId === "accelerating")!;
    expect(accelItem.priorityScore).toBeGreaterThan(stalledItem.priorityScore);
  });

  it("sorts by priority score descending", () => {
    const leads = [
      makeLead({ id: "low", stage: "new_lead", temperature: "cold" }),
      makeLead({ id: "high", stage: "consultation_booked", temperature: "on_fire", daysSinceActivity: 1 }),
    ];
    const { items } = generateFocusQueue(leads, SLA_DAYS, 10, NOW);
    expect(items[0].leadId).toBe("high");
  });

  it("caps results at the given limit but reports the true total", () => {
    const leads = Array.from({ length: 15 }, (_, i) => makeLead({ id: `lead-${i}` }));
    const { items, total } = generateFocusQueue(leads, SLA_DAYS, 10, NOW);
    expect(items).toHaveLength(10);
    expect(total).toBe(15);
  });

  it("suggests research for a brand new lead", () => {
    const leads = [makeLead({ id: "new", stage: "new_lead" })];
    const { items } = generateFocusQueue(leads, SLA_DAYS, 10, NOW);
    expect(items[0].suggestedAction).toBe("research");
  });

  it("suggests a call for email_sent under 3 days, followup after", () => {
    const recent = makeLead({ id: "recent", stage: "email_sent", daysSinceActivity: 1 });
    const stale = makeLead({ id: "stale", stage: "email_sent", daysSinceActivity: 5 });
    const { items } = generateFocusQueue([recent, stale], SLA_DAYS, 10, NOW);
    expect(items.find((i) => i.leadId === "recent")!.suggestedAction).toBe("call");
    expect(items.find((i) => i.leadId === "stale")!.suggestedAction).toBe("followup");
  });

  it("suggests a follow-up call for engaged leads whose last call needs a retry", () => {
    const leads = ["no_answer_retry", "left_voicemail", "callback_requested"].map((outcome) =>
      makeLead({ id: outcome, stage: "engaged", lastCallOutcome: outcome }),
    );
    const { items } = generateFocusQueue(leads, SLA_DAYS, 10, NOW);
    for (const item of items) {
      expect(item.suggestedAction).toBe("call");
    }
  });

  it("suggests booking a consultation for engaged leads with no retry-needed outcome", () => {
    const leads = [
      makeLead({ id: "no-outcome", stage: "engaged", lastCallOutcome: null }),
      makeLead({ id: "interested", stage: "engaged", lastCallOutcome: "interested_followup" }),
    ];
    const { items } = generateFocusQueue(leads, SLA_DAYS, 10, NOW);
    for (const item of items) {
      expect(item.suggestedAction).toBe("consultation");
    }
  });
});
