import "server-only";

import { and, desc, eq, ilike, or, sql, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, leadActivity, callLogs, type leadStageEnum } from "@/lib/db/schema";
import type { LeadListFilters } from "@/lib/validation/leads";
import { phonesMatch } from "@/lib/leads/phone";
import type { Session } from "@/lib/auth/session";

type LeadStage = (typeof leadStageEnum.enumValues)[number];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listLeads(orgId: string, filters: LeadListFilters, scopeOwnerId: string | null) {
  const conditions = [eq(leads.orgId, orgId), eq(leads.isDeleted, filters.trash)];

  // scopeOwnerId is non-null for reps (always "my leads"), null for
  // managers viewing the whole team — the ownerId filter further narrows a
  // manager's view to one specific rep, matching the source system's
  // "My Leads" default + manager rep-picker.
  if (scopeOwnerId) {
    conditions.push(eq(leads.ownerId, scopeOwnerId));
  } else if (filters.ownerId !== "all") {
    conditions.push(eq(leads.ownerId, filters.ownerId));
  }

  if (filters.stage !== "all") {
    conditions.push(eq(leads.stage, filters.stage));
  }

  if (filters.temperature !== "all") {
    conditions.push(eq(leads.temperature, filters.temperature));
  }

  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(leads.firstName, term),
        ilike(leads.lastName, term),
        ilike(leads.company, term),
        ilike(leads.email, term),
      )!,
    );
  }

  const where = and(...conditions);

  const [rows, [{ count }]] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(where)
      // desc(id) as a tie-breaker: a batch import/seed inserts many rows
      // with the identical createdAt timestamp, and createdAt alone gives
      // Postgres no deterministic order among ties — the query could
      // legitimately return them in a different order on every execution,
      // which read as a lead randomly "moving" in the list/kanban column on
      // an unrelated refetch (e.g. after running research) even though
      // nothing about that lead had changed.
      .orderBy(desc(leads.createdAt), desc(leads.id))
      .limit(filters.perPage)
      .offset((filters.page - 1) * filters.perPage),
    db.select({ count: sql<number>`count(*)::int` }).from(leads).where(where),
  ]);

  return {
    leads: rows,
    pagination: {
      page: filters.page,
      perPage: filters.perPage,
      total: count,
      pages: Math.max(1, Math.ceil(count / filters.perPage)),
    },
  };
}

export async function getLeadById(orgId: string, leadId: string) {
  // A non-UUID id (e.g. the modal route slot momentarily matching a literal
  // path segment like "new" or "import" before its own shadow route takes
  // over) would otherwise reach Postgres as an invalid UUID literal and
  // throw — treat it the same as "not found" instead.
  if (!UUID_PATTERN.test(leadId)) return undefined;

  return db.query.leads.findFirst({
    where: and(eq(leads.id, leadId), eq(leads.orgId, orgId)),
    with: {
      owner: true,
    },
  });
}

/**
 * Every lead-mutating Server Action (stage change, close-out, call/email
 * logging, ICP answers, grade override, delete, skip) needs the same check
 * before touching the row: the lead exists in this org, AND — unless the
 * caller is admin/super_admin, who see the whole org's pipeline by design —
 * the caller actually owns it. Without the ownership half, any rep could
 * write to any other rep's lead by calling the action directly (bypassing
 * the fact that a rep's own Leads list already filters to "my leads", which
 * only hides the row from the UI, not from someone who already has its id).
 * Returns the row (so callers don't need a second lookup) or null.
 */
export async function assertLeadWriteAccess(session: Session, leadId: string) {
  const lead = await getLeadById(session.user.orgId, leadId);
  if (!lead) return null;
  const isAdmin = session.user.role === "admin" || session.user.role === "super_admin";
  if (!isAdmin && lead.ownerId !== session.user.id) return null;
  return lead;
}

export async function countLeadsByStage(orgId: string, scopeOwnerId: string | null = null): Promise<Record<LeadStage, number>> {
  const conditions = [eq(leads.orgId, orgId), eq(leads.isDeleted, false)];
  if (scopeOwnerId) conditions.push(eq(leads.ownerId, scopeOwnerId));

  const rows = await db
    .select({ stage: leads.stage, count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(...conditions))
    .groupBy(leads.stage);

  const counts = Object.fromEntries(rows.map((r) => [r.stage, r.count])) as Record<LeadStage, number>;
  return counts;
}

export type LeadActivityEntry = {
  id: string;
  type: string;
  createdAt: Date;
  actorName: string | null;
  payload: Record<string, unknown>;
};

/** Full chronological activity feed for one lead — ports the source system's per-lead activity feed (activities[] rendered directly on the lead). */
export async function getLeadActivityTimeline(orgId: string, leadId: string): Promise<LeadActivityEntry[]> {
  const rows = await db.query.leadActivity.findMany({
    where: and(eq(leadActivity.orgId, orgId), eq(leadActivity.leadId, leadId)),
    orderBy: (fields, { desc }) => [desc(fields.createdAt)],
    with: { actor: { columns: { displayName: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    createdAt: row.createdAt,
    actorName: row.actor?.displayName ?? null,
    payload: row.payload,
  }));
}

export async function logLeadActivity(params: {
  orgId: string;
  leadId: string;
  actorId: string | null;
  type: (typeof leadActivity.$inferInsert)["type"];
  payload?: Record<string, unknown>;
}) {
  await db.insert(leadActivity).values({
    orgId: params.orgId,
    leadId: params.leadId,
    actorId: params.actorId,
    type: params.type,
    payload: params.payload ?? {},
  });
}

/** lowercase("firstName|lastName|company") — matches the source system's name+company dedup key exactly. */
export function nameCompanyDedupeKey(firstName: string | null, lastName: string | null, company: string | null): string {
  return `${firstName ?? ""}|${lastName ?? ""}|${company ?? ""}`.toLowerCase();
}

export async function findExistingLeadKeys(orgId: string) {
  const rows = await db
    .select({ email: leads.email, zohoRecordId: leads.zohoRecordId, firstName: leads.firstName, lastName: leads.lastName, company: leads.company })
    .from(leads)
    .where(and(eq(leads.orgId, orgId), eq(leads.isDeleted, false)));

  return {
    emails: new Set(rows.filter((r) => r.email).map((r) => r.email!.toLowerCase())),
    zohoIds: new Set(rows.filter((r) => r.zohoRecordId).map((r) => r.zohoRecordId!)),
    // Only leads that were themselves saved without an email need a name+company
    // key — matches the source system's own asymmetric tracking (an email-bearing
    // lead is never a match target for this fallback).
    nameCompanyKeys: new Set(
      rows.filter((r) => !r.email && (r.firstName || r.lastName)).map((r) => nameCompanyDedupeKey(r.firstName, r.lastName, r.company)),
    ),
  };
}

export async function listCallLogs(leadId: string) {
  return db.query.callLogs.findMany({
    where: eq(callLogs.leadId, leadId),
    orderBy: desc(callLogs.createdAt),
    with: { loggedByUser: { columns: { displayName: true } } },
  });
}

export async function leadIdsBelongToOrg(orgId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.orgId, orgId), inArray(leads.id, ids)));
  return rows.map((r) => r.id);
}

/**
 * Active (non-deleted) leads for scope computation — Focus Queue,
 * Attention Needed, dashboard stats. `ownerId` null means org-wide (a
 * manager's "team" view); non-null scopes to one rep, matching the source
 * system's per-user vs. admin-merged queue distinction.
 */
export async function listActiveLeadsForScope(orgId: string, ownerId: string | null) {
  const conditions = [eq(leads.orgId, orgId), eq(leads.isDeleted, false)];
  if (ownerId) {
    conditions.push(eq(leads.ownerId, ownerId));
  }
  return db.query.leads.findMany({
    where: and(...conditions),
    with: { owner: true },
  });
}

/**
 * Ports the source system's aircallFindLeadByPhone exactly: fuzzy phone
 * match (exact digits, or matching last-8-digit suffix) across the org's
 * leads, preferring the dialing rep's own copy when duplicates exist across
 * owners. Used by the Aircall webhook to attach a call.ended event to the
 * right lead — Aircall's own payload only carries a raw caller-id digit
 * string, not a lead id.
 */
export async function findLeadByPhone(orgId: string, phone: string, preferOwnerId: string | null) {
  const candidates = await db.query.leads.findMany({
    where: and(eq(leads.orgId, orgId), eq(leads.isDeleted, false), isNotNull(leads.phone)),
    columns: { id: true, phone: true, ownerId: true },
  });
  const matches = candidates.filter((c) => c.phone && phonesMatch(c.phone, phone));
  if (matches.length === 0) return null;
  if (preferOwnerId) {
    const ownedMatch = matches.find((m) => m.ownerId === preferOwnerId);
    if (ownedMatch) return ownedMatch;
  }
  return matches[0];
}
