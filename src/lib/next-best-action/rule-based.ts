export type NbaAction = "call" | "email" | "followup" | "research" | "wait" | "drop" | "review" | "close";
export type NbaUrgency = "critical" | "high" | "medium" | "low";

export type NextBestAction = {
  action: NbaAction;
  urgency: NbaUrgency;
  reason: string;
  talkingPoint: string;
  riskIfDelayed: string;
  source: "ai" | "rules";
};

export type NbaLeadInput = {
  stage: string;
  temperature: "on_fire" | "hot" | "warm" | "cold" | null;
  velocity: "accelerating" | "stable" | "slowing" | "stalled" | null;
  callsMadeCount: number;
  lastCallOutcome: string | null;
  daysSinceActivity: number;
  callAnchor: string | null;
};

/**
 * Ports the source system's generateRuleBasedNBA decision tree exactly —
 * the no-AI-key fallback, and also the default recommendation shown before
 * a rep opts into the AI-generated version.
 */
export function generateRuleBasedNba(lead: NbaLeadInput): NextBestAction {
  const temp = lead.temperature ?? "cold";
  const outcome = lead.lastCallOutcome ?? "";
  const { daysSinceActivity, callsMadeCount, stage } = lead;

  if (stage === "new_lead") {
    return {
      action: "research",
      urgency: "medium",
      reason: "New lead needs research before outreach",
      talkingPoint: "Run AI research to understand their business",
      riskIfDelayed: "Lead may go to competitors",
      source: "rules",
    };
  }

  if (stage === "research") {
    return {
      action: "email",
      urgency: temp === "hot" ? "high" : "medium",
      reason: "Research complete - time to reach out",
      talkingPoint: "Use research insights for personalized email",
      riskIfDelayed: "Research becomes stale after 5 days",
      source: "rules",
    };
  }

  if (stage === "email_sent" && daysSinceActivity >= 3) {
    return {
      action: "followup",
      urgency: daysSinceActivity >= 7 ? "high" : "medium",
      reason: `No response after ${daysSinceActivity} days`,
      talkingPoint: "Reference previous email, add new value",
      riskIfDelayed: "Lead forgets about you",
      source: "rules",
    };
  }

  if (stage === "call_attempted" || outcome === "callback_requested") {
    return {
      action: "call",
      urgency: "high",
      reason: "Callback is scheduled or requested",
      talkingPoint: lead.callAnchor || "Follow up on previous conversation",
      riskIfDelayed: "Breaking promise damages trust",
      source: "rules",
    };
  }

  if ((outcome === "no_answer_retry" || outcome === "left_voicemail") && callsMadeCount < 5) {
    return {
      action: "call",
      urgency: "medium",
      reason: `Try again - only ${callsMadeCount} attempts so far`,
      talkingPoint: "Try different time of day",
      riskIfDelayed: "May lose timing window",
      source: "rules",
    };
  }

  if (temp === "on_fire" || temp === "hot") {
    return {
      action: "call",
      urgency: "high",
      reason: "Hot lead - strike while iron is hot",
      talkingPoint: "They are showing buying signals",
      riskIfDelayed: "Hot leads cool down fast",
      source: "rules",
    };
  }

  return {
    action: "review",
    urgency: "low",
    reason: "Review lead and plan next steps",
    talkingPoint: "Check for any missed opportunities",
    riskIfDelayed: "Lead may become stale",
    source: "rules",
  };
}
