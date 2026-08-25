import { describe, it, expect } from "vitest";
import { generateRuleBasedNba, type NbaLeadInput } from "./rule-based";

function makeLead(overrides: Partial<NbaLeadInput>): NbaLeadInput {
  return {
    stage: "engaged",
    temperature: "warm",
    velocity: "stable",
    callsMadeCount: 0,
    lastCallOutcome: null,
    daysSinceActivity: 1,
    callAnchor: null,
    ...overrides,
  };
}

describe("generateRuleBasedNba", () => {
  it("recommends research for a new lead", () => {
    const nba = generateRuleBasedNba(makeLead({ stage: "new_lead" }));
    expect(nba.action).toBe("research");
    expect(nba.urgency).toBe("medium");
  });

  it("recommends email after research, high urgency if hot", () => {
    const hot = generateRuleBasedNba(makeLead({ stage: "research", temperature: "hot" }));
    expect(hot.action).toBe("email");
    expect(hot.urgency).toBe("high");

    const warm = generateRuleBasedNba(makeLead({ stage: "research", temperature: "warm" }));
    expect(warm.urgency).toBe("medium");
  });

  it("recommends followup for email_sent after 3+ days, high urgency after 7", () => {
    const recent = generateRuleBasedNba(makeLead({ stage: "email_sent", daysSinceActivity: 3 }));
    expect(recent.action).toBe("followup");
    expect(recent.urgency).toBe("medium");
    expect(recent.reason).toContain("3 days");

    const stale = generateRuleBasedNba(makeLead({ stage: "email_sent", daysSinceActivity: 7 }));
    expect(stale.urgency).toBe("high");
  });

  it("does not recommend followup for email_sent under 3 days", () => {
    const nba = generateRuleBasedNba(makeLead({ stage: "email_sent", daysSinceActivity: 2 }));
    expect(nba.action).not.toBe("followup");
  });

  it("recommends a call for call_attempted stage", () => {
    const nba = generateRuleBasedNba(makeLead({ stage: "call_attempted" }));
    expect(nba.action).toBe("call");
    expect(nba.urgency).toBe("high");
    expect(nba.reason).toContain("Callback");
  });

  it("recommends a call when the last outcome is callback_requested, regardless of stage", () => {
    const nba = generateRuleBasedNba(makeLead({ stage: "engaged", lastCallOutcome: "callback_requested" }));
    expect(nba.action).toBe("call");
    expect(nba.reason).toContain("Callback");
  });

  it("uses the lead's call anchor as the talking point when one is set", () => {
    const nba = generateRuleBasedNba(
      makeLead({ stage: "call_attempted", callAnchor: "Mentioned wanting a sample of the tile range" }),
    );
    expect(nba.talkingPoint).toBe("Mentioned wanting a sample of the tile range");
  });

  it("falls back to the generic talking point when no call anchor is set", () => {
    const nba = generateRuleBasedNba(makeLead({ stage: "call_attempted", callAnchor: null }));
    expect(nba.talkingPoint).toBe("Follow up on previous conversation");
  });

  it("recommends retrying a call after no_answer_retry/left_voicemail under 5 attempts", () => {
    const noAnswer = generateRuleBasedNba(makeLead({ stage: "engaged", lastCallOutcome: "no_answer_retry", callsMadeCount: 2 }));
    expect(noAnswer.action).toBe("call");
    expect(noAnswer.reason).toContain("2 attempts");

    const voicemail = generateRuleBasedNba(makeLead({ stage: "engaged", lastCallOutcome: "left_voicemail", callsMadeCount: 4 }));
    expect(voicemail.action).toBe("call");
  });

  it("stops recommending retries at 5+ attempts with no answer", () => {
    const nba = generateRuleBasedNba(makeLead({ stage: "engaged", lastCallOutcome: "no_answer_retry", callsMadeCount: 5 }));
    expect(nba.action).not.toBe("call");
  });

  it("recommends a call for hot/on_fire leads that fall through earlier branches", () => {
    const hot = generateRuleBasedNba(makeLead({ stage: "engaged", temperature: "hot", callsMadeCount: 0 }));
    expect(hot.action).toBe("call");
    expect(hot.reason).toContain("Hot lead");

    const onFire = generateRuleBasedNba(makeLead({ stage: "engaged", temperature: "on_fire" }));
    expect(onFire.action).toBe("call");
  });

  it("defaults to review when nothing else matches", () => {
    const nba = generateRuleBasedNba(makeLead({ stage: "engaged", temperature: "cold", velocity: "stable" }));
    expect(nba.action).toBe("review");
    expect(nba.urgency).toBe("low");
  });

  it("prioritizes stage-based branches over temperature for consultation_booked", () => {
    const nba = generateRuleBasedNba(makeLead({ stage: "consultation_booked", temperature: "on_fire" }));
    // consultation_booked has no dedicated branch, but on_fire still fires the hot-lead branch.
    expect(nba.action).toBe("call");
  });
});
