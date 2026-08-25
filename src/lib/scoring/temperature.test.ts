import { describe, it, expect } from "vitest";
import { calculateTemperature } from "./temperature";

describe("calculateTemperature", () => {
  it("is on_fire for a high combined score and very recent activity", () => {
    const temp = calculateTemperature({ fitScore: 90, engagementScore: 90, daysSinceActivity: 1 });
    expect(temp).toBe("on_fire");
  });

  it("is hot for a moderately high score within a week", () => {
    const temp = calculateTemperature({ fitScore: 70, engagementScore: 65, daysSinceActivity: 5 });
    expect(temp).toBe("hot");
  });

  it("is warm for a mid score or recent-ish activity", () => {
    const temp = calculateTemperature({ fitScore: 50, engagementScore: 40, daysSinceActivity: 10 });
    expect(temp).toBe("warm");
  });

  it("is cold for a low score and stale activity", () => {
    const temp = calculateTemperature({ fitScore: 10, engagementScore: 10, daysSinceActivity: 30 });
    expect(temp).toBe("cold");
  });

  it("decays combined score with inactivity beyond 7 days", () => {
    // combined = 80*0.4 + 70*0.6 = 74 -> hot fresh, but 20 days of inactivity
    // decays it well below the warm floor.
    const fresh = calculateTemperature({ fitScore: 80, engagementScore: 70, daysSinceActivity: 3 });
    const stale = calculateTemperature({ fitScore: 80, engagementScore: 70, daysSinceActivity: 20 });
    expect(fresh).toBe("hot");
    expect(stale).toBe("cold");
  });

  it("boosts on a reply outcome", () => {
    const withoutReply = calculateTemperature({ fitScore: 40, engagementScore: 40, daysSinceActivity: 5 });
    const withReply = calculateTemperature({
      fitScore: 40,
      engagementScore: 40,
      daysSinceActivity: 5,
      emailOutcomes: ["replied"],
    });
    expect(withoutReply).toBe("warm");
    expect(withReply).toBe("hot");
  });

  it("penalizes a bounced email", () => {
    // daysSinceActivity=0: no decay (only applies beyond 7 days), and low
    // enough that the "OR days <= 14" warm branch is in play regardless —
    // so instead assert on the returned temperature ordering directly:
    // combined 65 (hot) drops to 35 (warm, via the <=14 recency branch)
    // once the -30 bounce penalty lands.
    const withoutBounce = calculateTemperature({ fitScore: 65, engagementScore: 65, daysSinceActivity: 0 });
    const withBounce = calculateTemperature({
      fitScore: 65,
      engagementScore: 65,
      daysSinceActivity: 0,
      emailOutcomes: ["bounced"],
    });
    expect(withoutBounce).toBe("hot"); // combined 65 >= 60, days <= 7
    expect(withBounce).toBe("warm"); // combined 65 - 30 = 35, but days <= 14 keeps it out of cold
  });

  it("penalizes 3+ consecutive no-response outcomes", () => {
    const temp = calculateTemperature({
      fitScore: 60,
      engagementScore: 60,
      daysSinceActivity: 2,
      // Last outcome is "no_response" (no reply-boost applies), and there
      // are 3 consecutive no_response entries counting back from the end.
      emailOutcomes: ["replied", "no_response", "no_response", "no_response"],
    });
    // combined = 60, minus 20 for the streak = 40 -> warm threshold exactly
    expect(temp).toBe("warm");
  });
});
