import { describe, it, expect } from "vitest";
import { generateWorkbenchBuckets, type WorkbenchLeadInput } from "./generate";

const NOW = new Date("2026-01-15T12:00:00Z");

function makeLead(overrides: Partial<WorkbenchLeadInput>): WorkbenchLeadInput {
  return {
    id: "lead-1",
    firstName: "Jamie",
    lastName: "Fox",
    company: "Acme Co",
    stage: "new_lead",
    source: "manual",
    temperature: "cold",
    velocity: "stable",
    fitGrade: null,
    followupDate: null,
    hasEnrichment: false,
    ownerId: null,
    ownerName: null,
    ...overrides,
  };
}

describe("generateWorkbenchBuckets", () => {
  it("excludes won/lost leads from every bucket", () => {
    const buckets = generateWorkbenchBuckets(
      [makeLead({ id: "a", stage: "won", temperature: "on_fire" }), makeLead({ id: "b", stage: "lost", temperature: "hot" })],
      NOW,
    );
    for (const bucket of Object.values(buckets)) expect(bucket).toHaveLength(0);
  });

  it("buckets by exact stage for needs_research/needs_outreach/needs_calling, mutually exclusive", () => {
    const buckets = generateWorkbenchBuckets(
      [
        makeLead({ id: "a", stage: "new_lead" }),
        makeLead({ id: "b", stage: "research" }),
        makeLead({ id: "c", stage: "email_sent" }),
        makeLead({ id: "d", stage: "call_attempted" }),
        makeLead({ id: "e", stage: "engaged" }),
      ],
      NOW,
    );
    expect(buckets.needs_research.map((l) => l.leadId)).toEqual(["a"]);
    expect(buckets.needs_outreach.map((l) => l.leadId)).toEqual(["b"]);
    expect(buckets.needs_calling.map((l) => l.leadId).sort()).toEqual(["c", "d"]);
  });

  it("inbound_urgent requires source=inbound AND stage=call_attempted, and can overlap needs_calling", () => {
    const buckets = generateWorkbenchBuckets(
      [
        makeLead({ id: "a", source: "inbound", stage: "call_attempted" }),
        makeLead({ id: "b", source: "inbound", stage: "new_lead" }),
        makeLead({ id: "c", source: "manual", stage: "call_attempted" }),
      ],
      NOW,
    );
    expect(buckets.inbound_urgent.map((l) => l.leadId)).toEqual(["a"]);
    expect(buckets.needs_calling.map((l) => l.leadId).sort()).toEqual(["a", "c"]);
  });

  it("needs_followup requires (followup today OR stalled velocity) AND hasEnrichment, excluding consultation_booked/nurture_parked", () => {
    const buckets = generateWorkbenchBuckets(
      [
        makeLead({ id: "a", followupDate: NOW, hasEnrichment: true, stage: "email_sent" }),
        makeLead({ id: "b", followupDate: NOW, hasEnrichment: false, stage: "email_sent" }),
        makeLead({ id: "c", velocity: "stalled", hasEnrichment: true, stage: "email_sent" }),
        makeLead({ id: "d", followupDate: NOW, hasEnrichment: true, stage: "consultation_booked" }),
        makeLead({ id: "e", followupDate: NOW, hasEnrichment: true, stage: "nurture_parked" }),
      ],
      NOW,
    );
    expect(buckets.needs_followup.map((l) => l.leadId).sort()).toEqual(["a", "c"]);
  });

  it("hot_focus requires on_fire/hot temperature, excluding consultation_booked/nurture_parked", () => {
    const buckets = generateWorkbenchBuckets(
      [
        makeLead({ id: "a", temperature: "on_fire" }),
        makeLead({ id: "b", temperature: "hot" }),
        makeLead({ id: "c", temperature: "warm" }),
        makeLead({ id: "d", temperature: "hot", stage: "consultation_booked" }),
      ],
      NOW,
    );
    expect(buckets.hot_focus.map((l) => l.leadId).sort()).toEqual(["a", "b"]);
  });

  it("overdue is a strict day-string comparison, excluding won/lost/consultation_booked/nurture_parked", () => {
    const yesterday = new Date("2026-01-14T12:00:00Z");
    const buckets = generateWorkbenchBuckets(
      [
        makeLead({ id: "a", followupDate: yesterday, stage: "email_sent" }),
        makeLead({ id: "b", followupDate: NOW, stage: "email_sent" }),
        makeLead({ id: "c", followupDate: yesterday, stage: "consultation_booked" }),
      ],
      NOW,
    );
    expect(buckets.overdue.map((l) => l.leadId)).toEqual(["a"]);
  });

  it("sorts each bucket by temperature rank then fit grade rank, descending", () => {
    const buckets = generateWorkbenchBuckets(
      [
        makeLead({ id: "cold-a", stage: "new_lead", temperature: "cold", fitGrade: "A" }),
        makeLead({ id: "hot-c", stage: "new_lead", temperature: "hot", fitGrade: "C" }),
        makeLead({ id: "hot-a", stage: "new_lead", temperature: "hot", fitGrade: "A" }),
      ],
      NOW,
    );
    expect(buckets.needs_research.map((l) => l.leadId)).toEqual(["hot-a", "hot-c", "cold-a"]);
  });

  it("a lead can appear in multiple buckets at once", () => {
    const buckets = generateWorkbenchBuckets(
      [makeLead({ id: "a", stage: "email_sent", temperature: "hot", velocity: "stalled", hasEnrichment: true })],
      NOW,
    );
    expect(buckets.needs_calling.map((l) => l.leadId)).toEqual(["a"]);
    expect(buckets.hot_focus.map((l) => l.leadId)).toEqual(["a"]);
    expect(buckets.needs_followup.map((l) => l.leadId)).toEqual(["a"]);
  });
});
