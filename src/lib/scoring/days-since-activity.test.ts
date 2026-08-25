import { describe, it, expect } from "vitest";
import { calculateDaysSinceActivity } from "./days-since-activity";

const NOW = new Date("2026-01-15T12:00:00Z");

describe("calculateDaysSinceActivity", () => {
  it("uses lastActivityAt when present", () => {
    const days = calculateDaysSinceActivity(
      {
        lastActivityAt: new Date("2026-01-10T12:00:00Z"),
        followupDate: null,
        createdAt: new Date("2025-12-01T12:00:00Z"),
      },
      NOW,
    );
    expect(days).toBe(5);
  });

  it("falls back to createdAt when no activity or followup", () => {
    const days = calculateDaysSinceActivity(
      { lastActivityAt: null, followupDate: null, createdAt: new Date("2026-01-05T12:00:00Z") },
      NOW,
    );
    expect(days).toBe(10);
  });

  it("uses an overdue followup date if more recent than lastActivityAt", () => {
    const days = calculateDaysSinceActivity(
      {
        lastActivityAt: new Date("2026-01-01T12:00:00Z"),
        followupDate: new Date("2026-01-12T12:00:00Z"), // overdue, more recent
        createdAt: new Date("2025-12-01T12:00:00Z"),
      },
      NOW,
    );
    expect(days).toBe(3);
  });

  it("ignores a future followup date", () => {
    const days = calculateDaysSinceActivity(
      {
        lastActivityAt: new Date("2026-01-10T12:00:00Z"),
        followupDate: new Date("2026-01-20T12:00:00Z"), // in the future
        createdAt: new Date("2025-12-01T12:00:00Z"),
      },
      NOW,
    );
    expect(days).toBe(5);
  });

  it("never returns a negative number", () => {
    const days = calculateDaysSinceActivity(
      { lastActivityAt: new Date("2026-01-20T12:00:00Z"), followupDate: null, createdAt: new Date("2025-12-01T12:00:00Z") },
      NOW,
    );
    expect(days).toBe(0);
  });
});
