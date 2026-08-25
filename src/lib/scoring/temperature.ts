export type EmailOutcome = "replied" | "meeting_booked" | "bounced" | "no_response" | string;

export type TemperatureInput = {
  fitScore: number;
  engagementScore: number;
  daysSinceActivity: number;
  /** Most recent email outcomes, oldest first — used for the reply/bounce boost and no-response streak. */
  emailOutcomes?: EmailOutcome[];
};

export type Temperature = "on_fire" | "hot" | "warm" | "cold";

/**
 * Ports the source system's calculateTemperature: a 0.4/0.6 fit/engagement
 * blend, decayed by inactivity, then nudged by recent email outcomes.
 */
export function calculateTemperature(input: TemperatureInput): Temperature {
  let combined = input.fitScore * 0.4 + input.engagementScore * 0.6;

  if (input.daysSinceActivity > 7) {
    const decayFactor = Math.max(0.3, 1 - (input.daysSinceActivity - 7) * 0.05);
    combined *= decayFactor;
  }

  const outcomes = input.emailOutcomes ?? [];
  if (outcomes.length > 0) {
    const lastOutcome = outcomes[outcomes.length - 1];
    if (lastOutcome === "replied" || lastOutcome === "meeting_booked") {
      combined = Math.min(100, combined + 20);
    } else if (lastOutcome === "bounced") {
      combined = Math.max(0, combined - 30);
    }

    let noResponseStreak = 0;
    for (let i = outcomes.length - 1; i >= 0; i--) {
      if (outcomes[i] === "no_response") {
        noResponseStreak++;
      } else {
        break;
      }
    }
    if (noResponseStreak >= 3) {
      combined = Math.max(0, combined - 20);
    }
  }

  if (combined >= 80 && input.daysSinceActivity <= 3) return "on_fire";
  if (combined >= 60 && input.daysSinceActivity <= 7) return "hot";
  if (combined >= 40 || input.daysSinceActivity <= 14) return "warm";
  return "cold";
}
