import { describe, it, expect } from "vitest";
import { calculateVelocity } from "./velocity";

const NOW = new Date("2026-01-15T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("calculateVelocity", () => {
  it("is stalled when inactive 14+ days regardless of history", () => {
    const v = calculateVelocity([daysAgo(1), daysAgo(2)], 14, NOW);
    expect(v).toBe("stalled");
  });

  it("is accelerating with recent activity and none before", () => {
    const v = calculateVelocity([daysAgo(1), daysAgo(2)], 1, NOW);
    expect(v).toBe("accelerating");
  });

  it("is stalled with no activity at all in either window", () => {
    const v = calculateVelocity([], 10, NOW);
    expect(v).toBe("stalled");
  });

  it("is accelerating when recent activity outpaces the previous window 1.5x+", () => {
    const activity = [daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(9)]; // 3 recent, 1 previous
    const v = calculateVelocity(activity, 1, NOW);
    expect(v).toBe("accelerating");
  });

  it("is stable when recent and previous windows are similar", () => {
    const activity = [daysAgo(1), daysAgo(2), daysAgo(9), daysAgo(10)]; // 2 recent, 2 previous
    const v = calculateVelocity(activity, 1, NOW);
    expect(v).toBe("stable");
  });

  it("is slowing when recent activity drops off relative to before", () => {
    const activity = [daysAgo(1), daysAgo(9), daysAgo(10)]; // 1 recent, 2 previous -> ratio 0.5
    const v = calculateVelocity(activity, 1, NOW);
    expect(v).toBe("slowing");
  });
});
