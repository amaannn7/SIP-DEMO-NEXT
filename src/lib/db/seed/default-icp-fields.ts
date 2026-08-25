import type { icpFields } from "@/lib/db/schema";

/**
 * Default ICP fields for Levata's own sales pipeline (levatahq.com) —
 * qualifies inbound/outbound leads against Levata's actual service lines
 * and stated ideal-customer profile: growth-stage/mid-market B2B companies,
 * sold to founder/C-suite decision-makers, ready for a systems-level
 * engagement rather than a single-point fix. Weights total 100 across the
 * 5 scored dimensions (service_interest 25, decision_role 25,
 * company_stage 20, primary_pain_point 15, timeline 15).
 *
 * `current_tooling` and `next_step_agreed` are capture-only (weight 0) —
 * useful context for a rep, but not inputs to the fit score.
 */
export const DEFAULT_ICP_FIELDS: Array<Omit<typeof icpFields.$inferInsert, "id" | "orgId" | "createdAt" | "updatedAt">> = [
  {
    key: "service_interest",
    label: "Service Interest",
    subtitle: "Which of Levata's offerings is this conversation about?",
    fieldType: "select",
    weight: 25,
    isRequired: false,
    sortOrder: 0,
    options: [
      { value: "ai_intelligence", label: "AI & Intelligence", weight: 1, isIdeal: true },
      { value: "digital_infrastructure", label: "Digital Infrastructure", weight: 1, isIdeal: true },
      { value: "automation_systems", label: "Automation & Systems", weight: 1, isIdeal: true },
      { value: "product_engineering", label: "Product Engineering", weight: 0.8, isIdeal: true },
      { value: "sales_intelligence_platform", label: "Sales Intelligence Platform", weight: 0.8, isIdeal: true },
      { value: "not_sure_general", label: "Not Sure Yet / General Inquiry", weight: 0.3 },
    ],
  },
  {
    key: "decision_role",
    label: "Decision Role",
    subtitle: "What role do they play in a buying decision this size?",
    fieldType: "select",
    weight: 25,
    isRequired: false,
    sortOrder: 1,
    options: [
      { value: "founder_ceo", label: "Founder / CEO", weight: 1, isIdeal: true },
      { value: "coo", label: "COO", weight: 1, isIdeal: true },
      { value: "other_csuite", label: "Other C-suite", weight: 0.85, isIdeal: true },
      { value: "manager_lead", label: "Manager / Team Lead", weight: 0.5 },
      // Source pattern: an unknown decision-maker still earns partial
      // credit rather than 0, since it's a common state early in a
      // conversation and shouldn't read as disqualifying on its own.
      { value: "unknown", label: "Unknown", weight: 0.35 },
      { value: "not_decision_maker", label: "Not Decision-maker", weight: 0, isDisqualifying: true },
    ],
  },
  {
    key: "company_stage",
    label: "Company Stage",
    subtitle: "Where is the business right now?",
    fieldType: "select",
    weight: 20,
    isRequired: false,
    sortOrder: 2,
    options: [
      { value: "growth_scaling", label: "Growth-stage, Scaling", weight: 1, isIdeal: true },
      { value: "established_midmarket", label: "Established Mid-market", weight: 1, isIdeal: true },
      { value: "enterprise", label: "Enterprise", weight: 0.7 },
      { value: "early_stage_startup", label: "Early-stage Startup", weight: 0.4 },
    ],
  },
  {
    key: "primary_pain_point",
    label: "Primary Pain Point",
    subtitle: "What's the strongest angle for this prospect?",
    fieldType: "select",
    weight: 15,
    isRequired: false,
    sortOrder: 3,
    options: [
      { value: "scaling_chaos", label: "Scaling Chaos / Manual Ops", weight: 1, isIdeal: true },
      { value: "disconnected_tools", label: "Disconnected Tools / Data Silos", weight: 1, isIdeal: true },
      { value: "underperforming_digital", label: "Underperforming Digital Presence", weight: 0.8 },
      { value: "ai_without_system", label: "AI Adoption Without a System", weight: 0.8 },
      { value: "unclear", label: "Unclear", weight: 0.2 },
    ],
  },
  {
    key: "timeline",
    label: "Timeline",
    subtitle: "When could this move?",
    fieldType: "select",
    weight: 15,
    isRequired: false,
    sortOrder: 4,
    options: [
      { value: "immediate", label: "Immediate", weight: 1, isIdeal: true },
      { value: "1_3_months", label: "1-3 Months", weight: 1, isIdeal: true },
      { value: "3_6_months", label: "3-6 Months", weight: 0.6 },
      { value: "future_nurture", label: "Future / Nurture", weight: 0 },
      { value: "unknown", label: "Unknown", weight: 0 },
    ],
  },
  {
    key: "current_tooling",
    label: "Current Tooling",
    subtitle: "What are they using today for this?",
    fieldType: "select",
    weight: 0,
    isRequired: false,
    sortOrder: 5,
    options: [
      { value: "manual_spreadsheets", label: "Manual / Spreadsheets", weight: 0 },
      { value: "point_solutions", label: "Several Disconnected Point Solutions", weight: 0 },
      { value: "legacy_platform", label: "Legacy Platform", weight: 0 },
      { value: "in_house_build", label: "In-house Build", weight: 0 },
      { value: "nothing_yet", label: "Nothing Yet", weight: 0 },
      { value: "unclear", label: "Unclear", weight: 0 },
    ],
  },
  {
    key: "next_step_agreed",
    label: "Next Step Agreed",
    subtitle: "What did they agree to after the conversation?",
    fieldType: "select",
    weight: 0,
    isRequired: false,
    sortOrder: 6,
    options: [
      { value: "strategy_call_booked", label: "Strategy Call Booked", weight: 0 },
      { value: "proposal_requested", label: "Proposal Requested", weight: 0 },
      { value: "send_case_studies", label: "Send Case Studies", weight: 0 },
      { value: "call_back", label: "Call Back", weight: 0 },
      { value: "nurture", label: "Nurture", weight: 0 },
      { value: "not_interested", label: "Not Interested", weight: 0 },
    ],
  },
  {
    key: "notes_objections",
    label: "Notes / Objections",
    subtitle: "Capture objections, buying signals, or specific project details.",
    fieldType: "text",
    weight: 0,
    isRequired: false,
    sortOrder: 7,
    options: null,
  },
];
