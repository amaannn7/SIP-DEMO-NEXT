/**
 * Realistic demo lead generator — used only by seed:demo. Produces varied,
 * plausible-looking leads across stages/sources/industries (generic, no
 * single client's identity) with backdated activity history, then runs
 * every lead through the REAL scoring engine (recomputeAndSaveLeadScores)
 * so fit/engagement/temperature/velocity are authentic outputs of the
 * actual pipeline, not hand-faked numbers — the same reason the dashboard
 * and reports were rewired off DEMO_* constants onto real queries.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, leadActivity, emailHistory, callLogs } from "@/lib/db/schema";
import { recomputeAndSaveLeadScores } from "@/lib/scoring/apply";

// Matches Levata's stated ICP industries: B2B SaaS, e-commerce,
// professional services, founder-led organizations, agencies.
const INDUSTRIES = ["B2B SaaS", "E-commerce", "Professional Services", "Marketing Agency", "Fintech", "Healthtech", "Logistics Tech", "Consumer Products"];
const COUNTRIES = ["United States", "Canada", "United Kingdom", "Australia", "Singapore", "United Arab Emirates"];
const COMPANY_PREFIXES = ["North", "Summit", "Cedar", "Harbor", "Ridge", "Bright", "Fern", "Stone", "River", "West", "Union", "Pioneer", "Vertex", "Anchor", "Maple"];
const COMPANY_SUFFIXES = ["Analytics", "Labs", "Commerce", "Partners", "Digital", "Group", "Solutions", "Holdings", "Works", "Systems", "Collective", "Ventures"];
const FIRST_NAMES = ["Priya", "Marcus", "Alicia", "Tom", "Owen", "Sasha", "Devon", "Nina", "Carlos", "Emma", "Liam", "Zoe", "Raj", "Ivy", "Sam", "Grace", "Theo", "Mika", "Jonas", "Ana"];
const LAST_NAMES = ["Chandra", "Webb", "Moreno", "Whitfield", "Blake", "Nguyen", "Foster", "Patel", "Reyes", "Clarke", "Bishop", "Larsen", "Kim", "Ortiz", "Doyle", "Hart", "Singh", "Wren"];
const TITLES = ["Founder", "CEO", "COO", "Co-founder", "Head of Operations", "VP Growth", "CTO", "General Manager"];

// Mirrors DEFAULT_ICP_FIELDS' option values exactly (Levata's own service
// lines / ICP) — these keys and values must stay in sync with
// default-icp-fields.ts, or a demo lead's customFields answers won't match
// any real option in the qualification form.
const SERVICE_INTEREST_OPTIONS = ["ai_intelligence", "digital_infrastructure", "automation_systems", "product_engineering", "sales_intelligence_platform", "not_sure_general"];
const DECISION_ROLE_OPTIONS = ["founder_ceo", "coo", "other_csuite", "manager_lead", "unknown", "not_decision_maker"];
const COMPANY_STAGE_OPTIONS = ["growth_scaling", "established_midmarket", "enterprise", "early_stage_startup"];
const PRIMARY_PAIN_POINT_OPTIONS = ["scaling_chaos", "disconnected_tools", "underperforming_digital", "ai_without_system", "unclear"];
const TIMELINE_OPTIONS = ["immediate", "1_3_months", "3_6_months", "future_nurture", "unknown"];

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Deterministic PRNG (mulberry32) so re-running the seed produces the same demo data. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

type StageProfile = {
  stage: (typeof leads.$inferInsert)["stage"];
  weight: number;
  lastActivityDaysAgo: [number, number];
  hasEnrichment: boolean;
  emailRange: [number, number];
  callRange: [number, number];
};

// Weighted stage distribution + activity recency so the funnel and
// temperature/SLA badges look like a real working pipeline, not uniform noise.
const STAGE_PROFILES: StageProfile[] = [
  { stage: "new_lead", weight: 5, lastActivityDaysAgo: [0, 2], hasEnrichment: false, emailRange: [0, 0], callRange: [0, 0] },
  { stage: "research", weight: 4, lastActivityDaysAgo: [0, 3], hasEnrichment: false, emailRange: [0, 0], callRange: [0, 0] },
  { stage: "email_sent", weight: 6, lastActivityDaysAgo: [0, 6], hasEnrichment: true, emailRange: [1, 2], callRange: [0, 1] },
  { stage: "call_attempted", weight: 5, lastActivityDaysAgo: [1, 5], hasEnrichment: true, emailRange: [1, 2], callRange: [1, 2] },
  { stage: "engaged", weight: 5, lastActivityDaysAgo: [0, 4], hasEnrichment: true, emailRange: [2, 3], callRange: [1, 3] },
  { stage: "consultation_booked", weight: 3, lastActivityDaysAgo: [0, 3], hasEnrichment: true, emailRange: [2, 4], callRange: [2, 3] },
  { stage: "nurture_parked", weight: 3, lastActivityDaysAgo: [20, 60], hasEnrichment: true, emailRange: [1, 3], callRange: [1, 2] },
  { stage: "won", weight: 2, lastActivityDaysAgo: [2, 15], hasEnrichment: true, emailRange: [2, 4], callRange: [2, 4] },
  { stage: "lost", weight: 2, lastActivityDaysAgo: [5, 25], hasEnrichment: true, emailRange: [1, 3], callRange: [1, 3] },
];

function weightedPick<T extends { weight: number }>(items: T[], rng: () => number): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

const CALL_OUTCOMES = ["no_answer_retry", "left_voicemail", "interested_followup", "callback_requested", "consultation_booked"] as const;
const EMAIL_STEPS = ["initial", "followup1", "followup2"] as const;

export async function seedDemoLeads(orgId: string, ownerIds: string[], count = 50, seed = 42): Promise<void> {
  const rng = mulberry32(seed);
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    const profile = weightedPick(STAGE_PROFILES, rng);
    const firstName = pick(FIRST_NAMES, rng);
    const lastName = pick(LAST_NAMES, rng);
    let company = `${pick(COMPANY_PREFIXES, rng)} ${pick(COMPANY_SUFFIXES, rng)}`;
    while (usedNames.has(company)) {
      company = `${pick(COMPANY_PREFIXES, rng)} ${pick(COMPANY_SUFFIXES, rng)}`;
    }
    usedNames.add(company);

    const lastActivityAt = daysAgo(profile.lastActivityDaysAgo[0] + Math.floor(rng() * (profile.lastActivityDaysAgo[1] - profile.lastActivityDaysAgo[0] + 1)));
    const createdAt = daysAgo(profile.lastActivityDaysAgo[1] + Math.floor(rng() * 30) + 5);
    const ownerId = ownerIds[Math.floor(rng() * ownerIds.length)];

    const source = pick(["import", "inbound", "manual", "other"] as const, rng);

    const followupDate =
      profile.stage === "engaged" || profile.stage === "consultation_booked" || profile.stage === "call_attempted"
        ? daysAgo(-Math.floor(rng() * 7)) // negative daysAgo = a future date
        : profile.stage === "nurture_parked"
          ? daysAgo(-Math.floor(rng() * 60 - 30))
          : null;

    const [lead] = await db
      .insert(leads)
      .values({
        orgId,
        ownerId,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`,
        phone: `+1-555-${String(Math.floor(rng() * 900) + 100)}-${String(Math.floor(rng() * 9000) + 1000)}`,
        company,
        title: pick(TITLES, rng),
        industry: pick(INDUSTRIES, rng),
        country: pick(COUNTRIES, rng),
        website: `https://${company.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`,
        companySize: pick(["1-10", "11-50", "51-200", "201-500", "500+"], rng),
        stage: profile.stage,
        source,
        customFields: {
          service_interest: pick(SERVICE_INTEREST_OPTIONS, rng),
          decision_role: pick(DECISION_ROLE_OPTIONS, rng),
          company_stage: pick(COMPANY_STAGE_OPTIONS, rng),
          primary_pain_point: pick(PRIMARY_PAIN_POINT_OPTIONS, rng),
          timeline: pick(TIMELINE_OPTIONS, rng),
        },
        hasEnrichment: profile.hasEnrichment,
        followupDate,
        lastActivityAt,
        createdAt,
        updatedAt: lastActivityAt,
      })
      .returning({ id: leads.id });

    await db.insert(leadActivity).values({
      orgId,
      leadId: lead.id,
      actorId: ownerId,
      type: "created",
      payload: { source },
      createdAt,
    });

    const emailCount = profile.emailRange[0] + Math.floor(rng() * (profile.emailRange[1] - profile.emailRange[0] + 1));
    for (let e = 0; e < emailCount; e++) {
      const sentAt = daysAgo(profile.lastActivityDaysAgo[1] - e * 3 + Math.floor(rng() * 2));
      const step = EMAIL_STEPS[Math.min(e, EMAIL_STEPS.length - 1)];
      await db.insert(emailHistory).values({
        orgId,
        leadId: lead.id,
        sequenceStep: step,
        subject: emailSubject(step, company),
        body: `Hi ${firstName},\n\nFollowing up regarding ${company}. Let me know if you have a few minutes this week to connect.`,
        sentAt,
        createdAt: sentAt,
      });
      await db.insert(leadActivity).values({
        orgId,
        leadId: lead.id,
        actorId: ownerId,
        type: "email_generated",
        payload: { sequenceStep: step },
        createdAt: sentAt,
      });
    }

    const callCount = profile.callRange[0] + Math.floor(rng() * (profile.callRange[1] - profile.callRange[0] + 1));
    let lastOutcome: (typeof CALL_OUTCOMES)[number] | null = null;
    for (let c = 0; c < callCount; c++) {
      const calledAt = daysAgo(profile.lastActivityDaysAgo[1] - c * 2 + Math.floor(rng() * 2));
      const outcome = pick([...CALL_OUTCOMES], rng);
      lastOutcome = outcome;
      await db.insert(callLogs).values({
        orgId,
        leadId: lead.id,
        loggedBy: ownerId,
        outcome,
        notes: null,
        createdAt: calledAt,
      });
      await db.insert(leadActivity).values({
        orgId,
        leadId: lead.id,
        actorId: ownerId,
        type: "call_logged",
        payload: { outcome },
        createdAt: calledAt,
      });
    }

    if (callCount > 0) {
      await db
        .update(leads)
        .set({ callsMadeCount: callCount, lastCallOutcome: lastOutcome })
        .where(eq(leads.id, lead.id));
    }
    if (emailCount > 0) {
      await db
        .update(leads)
        .set({ emailsSentCount: emailCount, lastEmailStep: EMAIL_STEPS[Math.min(emailCount - 1, EMAIL_STEPS.length - 1)] })
        .where(eq(leads.id, lead.id));
    }

    await recomputeAndSaveLeadScores(orgId, lead.id);
  }
}

function emailSubject(step: (typeof EMAIL_STEPS)[number], company: string): string {
  if (step === "initial") return `Quick question about ${company}`;
  if (step === "followup1") return `Following up: ${company}`;
  return `One more thought for ${company}`;
}
