import type { leadSourceEnum, leadStageEnum } from "@/lib/db/schema";

type LeadSource = (typeof leadSourceEnum.enumValues)[number];
type LeadStage = (typeof leadStageEnum.enumValues)[number];

/** Ports the source system's initialStageForSource: an inbound lead has already reached out, so it starts past cold-outreach at call_attempted instead of new_lead. */
export function initialStageForSource(source: LeadSource): LeadStage {
  return source === "inbound" ? "call_attempted" : "new_lead";
}
