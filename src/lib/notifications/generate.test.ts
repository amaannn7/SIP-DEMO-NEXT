import { describe, it, expect } from "vitest";
import { generateNotifications, type NotificationLeadInput } from "./generate";

const NOW = new Date("2026-01-15T12:00:00Z");

function makeLead(overrides: Partial<NotificationLeadInput>): NotificationLeadInput {
  return {
    id: "lead-1",
    firstName: "Jamie",
    lastName: "Fox",
    company: "Acme Co",
    stage: "engaged",
    temperature: "warm",
    followupDate: null,
    daysSinceActivity: 1,
    ...overrides,
  };
}

describe("generateNotifications", () => {
  it("excludes nurture_parked/won/lost leads entirely", () => {
    const leads = [
      makeLead({ id: "a", stage: "won", temperature: "on_fire", daysSinceActivity: 5 }),
      makeLead({ id: "b", stage: "lost", temperature: "on_fire", daysSinceActivity: 5 }),
      makeLead({ id: "c", stage: "nurture_parked", temperature: "on_fire", daysSinceActivity: 5 }),
    ];
    expect(generateNotifications(leads, new Set(), NOW)).toHaveLength(0);
  });

  it("flags a hot lead idle for 1+ day", () => {
    const leads = [makeLead({ temperature: "hot", daysSinceActivity: 1 })];
    const result = generateNotifications(leads, new Set(), NOW);
    expect(result.map((n) => n.type)).toContain("hot_lead");
  });

  it("does not flag a hot lead contacted today", () => {
    const leads = [makeLead({ temperature: "hot", daysSinceActivity: 0 })];
    const result = generateNotifications(leads, new Set(), NOW);
    expect(result.some((n) => n.type === "hot_lead")).toBe(false);
  });

  it("flags a same-day followup as callback due today", () => {
    const leads = [makeLead({ followupDate: NOW })];
    const result = generateNotifications(leads, new Set(), NOW);
    expect(result.map((n) => n.type)).toContain("callback_due");
  });

  it("flags an overdue followup as callback overdue, with days-overdue in the body", () => {
    const overdueDate = new Date(NOW.getTime() - 3 * 86_400_000);
    const leads = [makeLead({ followupDate: overdueDate })];
    const result = generateNotifications(leads, new Set(), NOW);
    const notif = result.find((n) => n.type === "callback_overdue");
    expect(notif).toBeDefined();
    expect(notif!.body).toContain("3 day(s) overdue");
  });

  it("flags going_cold for hot/warm leads inactive 7-13 days, not before or after", () => {
    const before = generateNotifications([makeLead({ temperature: "hot", daysSinceActivity: 6 })], new Set(), NOW);
    expect(before.some((n) => n.type === "going_cold")).toBe(false);

    const within = generateNotifications([makeLead({ temperature: "hot", daysSinceActivity: 7 })], new Set(), NOW);
    expect(within.some((n) => n.type === "going_cold")).toBe(true);

    const after = generateNotifications([makeLead({ temperature: "hot", daysSinceActivity: 14 })], new Set(), NOW);
    expect(after.some((n) => n.type === "going_cold")).toBe(false);
  });

  it("flags stale_research for research-stage leads inactive 3+ days", () => {
    const leads = [makeLead({ stage: "research", daysSinceActivity: 3 })];
    const result = generateNotifications(leads, new Set(), NOW);
    expect(result.some((n) => n.type === "stale_research" && n.dedupeKey.startsWith("stale_research_"))).toBe(true);
  });

  it("flags a follow-up call for email_sent leads inactive 3+ days", () => {
    const leads = [makeLead({ stage: "email_sent", daysSinceActivity: 3 })];
    const result = generateNotifications(leads, new Set(), NOW);
    expect(result.some((n) => n.dedupeKey.startsWith("followup_call_"))).toBe(true);
  });

  it("flags an idle new lead after 2+ days", () => {
    const leads = [makeLead({ stage: "new_lead", daysSinceActivity: 2 })];
    const result = generateNotifications(leads, new Set(), NOW);
    expect(result.some((n) => n.dedupeKey.startsWith("new_lead_idle_"))).toBe(true);
  });

  it("skips a check whose dedupe key already exists", () => {
    const leads = [makeLead({ temperature: "hot", daysSinceActivity: 1 })];
    const existing = new Set([`hot_lead_${leads[0].id}`]);
    const result = generateNotifications(leads, existing, NOW);
    expect(result.some((n) => n.type === "hot_lead")).toBe(false);
  });

  it("a single lead can trigger multiple distinct checks at once", () => {
    const overdueDate = new Date(NOW.getTime() - 2 * 86_400_000);
    const leads = [makeLead({ stage: "research", temperature: "hot", daysSinceActivity: 3, followupDate: overdueDate })];
    const result = generateNotifications(leads, new Set(), NOW);
    const types = result.map((n) => n.type);
    expect(types).toContain("hot_lead");
    expect(types).toContain("callback_overdue");
    expect(types).toContain("stale_research");
  });
});
