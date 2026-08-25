import { describe, it, expect } from "vitest";
import { calculateSlaStatus } from "./sla-status";

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

describe("calculateSlaStatus", () => {
  it("is on_track when well within the stage's SLA window", () => {
    const status = calculateSlaStatus(
      { stage: "email_sent", source: "manual", createdAt: NOW },
      1,
      SLA_DAYS,
      NOW,
    );
    expect(status.urgency).toBe("on_track");
    expect(status.isOverdue).toBe(false);
  });

  it("is due_soon just before the SLA deadline", () => {
    const status = calculateSlaStatus(
      { stage: "new_lead", source: "manual", createdAt: NOW }, // max 1 day
      0,
      SLA_DAYS,
      NOW,
    );
    // daysSinceActivity(0) >= maxDays(1) - 1 -> due_soon
    expect(status.urgency).toBe("due_soon");
  });

  it("is overdue past the SLA window", () => {
    const status = calculateSlaStatus(
      { stage: "email_sent", source: "manual", createdAt: NOW }, // max 5 days
      6,
      SLA_DAYS,
      NOW,
    );
    expect(status.urgency).toBe("overdue");
    expect(status.isOverdue).toBe(true);
  });

  it("is critical at 2x+ the SLA window", () => {
    const status = calculateSlaStatus(
      { stage: "email_sent", source: "manual", createdAt: NOW }, // max 5 days
      11,
      SLA_DAYS,
      NOW,
    );
    expect(status.urgency).toBe("critical");
  });

  it("treats an inbound lead in call_attempted as a 2-hour SLA", () => {
    const createdAt = new Date(NOW.getTime() - 3 * 3_600_000); // 3 hours ago
    const status = calculateSlaStatus({ stage: "call_attempted", source: "inbound", createdAt }, 0, SLA_DAYS, NOW);
    expect(status.urgency).toBe("critical");
    expect(status.isOverdue).toBe(true);
    expect(status.slaDays).toBe(0);
  });

  it("marks an inbound lead still inside its 2-hour window as urgency 'high', not on_track", () => {
    // Matches the source system's calculateSLAStatus exactly: the general
    // per-stage path's vocabulary is on_track/due_soon/overdue/critical, but
    // this specific inbound branch uses 'high' for "not yet breached but
    // time-critical" rather than 'on_track' — an inbound lead 1 hour old is
    // not the same urgency as a fresh outbound lead.
    const createdAt = new Date(NOW.getTime() - 1 * 3_600_000); // 1 hour ago, still within the 2-hour window
    const status = calculateSlaStatus({ stage: "call_attempted", source: "inbound", createdAt }, 0, SLA_DAYS, NOW);
    expect(status.urgency).toBe("high");
    expect(status.isOverdue).toBe(false);
    expect(status.hoursRemaining).toBe(1);
  });

  it("does not apply the inbound 2-hour rule to non-inbound leads", () => {
    const createdAt = new Date(NOW.getTime() - 3 * 3_600_000);
    const status = calculateSlaStatus({ stage: "call_attempted", source: "manual", createdAt }, 0, SLA_DAYS, NOW);
    expect(status.slaDays).toBe(3); // ordinary call_attempted SLA, not the 2-hour rule
  });

  it("marks won leads as complete with no SLA", () => {
    const status = calculateSlaStatus({ stage: "won", source: "manual", createdAt: NOW }, 50, SLA_DAYS, NOW);
    expect(status.urgency).toBe("complete");
    expect(status.slaDays).toBeNull();
    expect(status.isOverdue).toBe(false);
  });

  it("marks lost leads as complete with no SLA", () => {
    const status = calculateSlaStatus({ stage: "lost", source: "manual", createdAt: NOW }, 50, SLA_DAYS, NOW);
    expect(status.urgency).toBe("complete");
  });

  it("never flags nurture_parked as overdue, even far past its 90-day window", () => {
    const status = calculateSlaStatus({ stage: "nurture_parked", source: "manual", createdAt: NOW }, 200, SLA_DAYS, NOW);
    expect(status.isOverdue).toBe(false);
    expect(status.urgency).toBe("on_track");
    expect(status.slaDays).toBe(90);
  });
});
