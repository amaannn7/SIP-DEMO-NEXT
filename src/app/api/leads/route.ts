import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/session";
import { listLeads, countLeadsByStage } from "@/lib/db/queries/leads";
import { leadListFiltersSchema } from "@/lib/validation/leads";

/**
 * Backs the live client-side search/filter on the Leads list — LeadsTable
 * and the stage-strip counts now fetch here on filter change instead of the
 * whole page re-navigating and re-rendering top to bottom for every
 * keystroke. Server-navigated links (stage strip clicks, pagination) still
 * go through the page itself so the URL stays the source of truth and
 * bookmarking/back-button keep working.
 */
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    throw err;
  }

  const isManager = session.user.role === "admin" || session.user.role === "super_admin";
  const scopeOwnerId = isManager ? null : session.user.id;

  const params = request.nextUrl.searchParams;
  const filters = leadListFiltersSchema.parse({
    search: params.get("search") ?? undefined,
    stage: params.get("stage") ?? undefined,
    temperature: params.get("temperature") ?? undefined,
    ownerId: params.get("ownerId") ?? undefined,
    page: params.get("page") ?? undefined,
    perPage: params.get("perPage") ?? undefined,
    trash: params.get("trash") ?? undefined,
  });

  const [{ leads, pagination }, stageCounts] = await Promise.all([
    listLeads(session.user.orgId, filters, scopeOwnerId),
    countLeadsByStage(session.user.orgId, scopeOwnerId),
  ]);

  return NextResponse.json({ leads, pagination, stageCounts });
}
