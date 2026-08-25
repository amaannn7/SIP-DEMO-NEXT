import "server-only";

import { and, eq, desc, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, orgSettings, enrichmentResults, emailHistory, jobRuns, users } from "@/lib/db/schema";
import { callLLM } from "@/lib/ai/call-llm";
import {
  buildEmailPrompt,
  parseLabeledFields,
  assembleEmailBody,
  getEmailStepFields,
  type EmailOutcomeCounts,
} from "@/lib/ai/prompts/email";
import { enrichmentResultSchema } from "@/lib/ai/prompts/enrichment";
import { resolveEffectiveBrandContext } from "@/lib/ai/prompts/effective-brand";
import { renderSenderIdentity } from "@/lib/ai/prompts/shared";
import { logLeadActivity } from "@/lib/db/queries/leads";
import { getEffectiveSenderProfile } from "@/lib/db/queries/sender-profile";
import type { GenerateEmailJobData } from "@/lib/jobs/queue";

export async function handleGenerateEmail(data: GenerateEmailJobData): Promise<void> {
  const { jobRunId, orgId, leadId, actorId, sequenceStep, customInstructions, includeSignature = true } = data;

  await db.update(jobRuns).set({ status: "processing" }).where(eq(jobRuns.id, jobRunId));

  try {
    const [lead, settings, latestEnrichment, sentEmails] = await Promise.all([
      db.query.leads.findFirst({ where: eq(leads.id, leadId) }),
      db.query.orgSettings.findFirst({ where: eq(orgSettings.orgId, orgId) }),
      db.query.enrichmentResults.findFirst({
        where: eq(enrichmentResults.leadId, leadId),
        orderBy: desc(enrichmentResults.createdAt),
      }),
      // Only SENT emails are real "previous outreach" — in the source system,
      // generating never persisted at all, so email_history there was built
      // exclusively from sent emails by construction. A draft the rep never
      // sent (or regenerated away) shouldn't shape the next email, anchor its
      // thread, or count toward the performance-feedback guidance below.
      db.query.emailHistory.findMany({
        where: and(eq(emailHistory.leadId, leadId), isNotNull(emailHistory.sentAt)),
        orderBy: desc(emailHistory.createdAt),
      }),
    ]);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    const latestEmail = sentEmails[0] ?? null;
    const emailOutcomeCounts: EmailOutcomeCounts = { replied: 0, noResponse: 0, bounced: 0, meetingBooked: 0 };
    for (const email of sentEmails) {
      if (email.outcome === "replied") emailOutcomeCounts.replied++;
      else if (email.outcome === "no_response") emailOutcomeCounts.noResponse++;
      else if (email.outcome === "bounced") emailOutcomeCounts.bounced++;
      else if (email.outcome === "meeting_booked") emailOutcomeCounts.meetingBooked++;
    }

    // The source system's generate-email endpoint uses the caller's own
    // settings ($user['id'] from requireAuth()), not the lead owner's — unlike
    // its call-pitch/enrich-lead endpoints, which explicitly resolve the true
    // lead owner. Ported here via actorId (the rep who clicked Generate), so
    // My Context always reflects whoever is actually generating the email.
    const owner = await db.query.users.findFirst({ where: eq(users.id, actorId), columns: { displayName: true } });
    const senderProfile = await getEffectiveSenderProfile(orgId, actorId);

    const enrichmentParsed = latestEnrichment
      ? enrichmentResultSchema.safeParse({
          research_score: { score: latestEnrichment.researchScore ?? 0, quality: latestEnrichment.researchQuality ?? "", factors: latestEnrichment.researchFactors },
          sources: latestEnrichment.sources,
          company_profile: latestEnrichment.companyProfile,
          industry_intelligence: latestEnrichment.industryIntelligence,
          prospect_analysis: latestEnrichment.prospectAnalysis,
          sales_strategy: latestEnrichment.salesStrategy,
        })
      : null;

    const brand = resolveEffectiveBrandContext(settings?.brandContext ?? {}, senderProfile);

    const prompt = buildEmailPrompt({
      step: sequenceStep,
      lead: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        title: lead.title,
        company: lead.company,
        industry: lead.industry,
        country: lead.country,
        website: lead.website,
        companySize: lead.companySize,
      },
      brand,
      senderIdentity: renderSenderIdentity(
        senderProfile ?? { senderName: "", senderTitle: "", senderCompany: "" },
        owner?.displayName ?? "",
      ),
      enrichment: enrichmentParsed?.success ? enrichmentParsed.data : null,
      previousEmail: latestEmail ? { subject: latestEmail.subject, body: latestEmail.body } : null,
      emailOutcomeCounts,
      customInstructions,
    });

    const result = await callLLM(orgId, prompt);
    if (!result.success) throw new Error(result.error);

    const fields = parseLabeledFields(result.content, getEmailStepFields(sequenceStep));
    const subject = fields.SUBJECT ?? "(no subject generated)";
    let body = assembleEmailBody(sequenceStep, fields, lead.firstName);
    // Ports the source system's "Include signature" checkbox (default
    // checked) — a per-generation opt-out for a quick informal email where
    // the rep doesn't want the full signature block appended.
    if (includeSignature && senderProfile?.signature) {
      body = `${body}\n\n${senderProfile.signature}`;
    }

    const threadId = latestEmail?.threadId ?? undefined;

    // Ports the source system's generate -> review/edit -> "Mark as Sent"
    // flow exactly: generating a draft never counts toward emails_sent or
    // advances the stage on its own — a rep can regenerate freely without
    // inflating either. Only markEmailSentAction (triggered by the rep's
    // explicit "Mark as sent" click) does that, matching save-email in the
    // source system.
    const [row] = await db
      .insert(emailHistory)
      .values({
        orgId,
        leadId,
        jobRunId,
        sequenceStep,
        ...(threadId ? { threadId } : {}),
        subject,
        body,
      })
      .returning({ id: emailHistory.id });

    await Promise.all([
      db.update(jobRuns).set({ status: "completed", resultId: row.id, completedAt: new Date() }).where(eq(jobRuns.id, jobRunId)),
      logLeadActivity({
        orgId,
        leadId,
        actorId: null,
        type: "email_generated",
        payload: { jobRunId, sequenceStep, subject },
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db.update(jobRuns).set({ status: "failed", error: message, completedAt: new Date() }).where(eq(jobRuns.id, jobRunId));
    throw err;
  }
}
