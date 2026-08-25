import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/session";
import { listLeads } from "@/lib/db/queries/leads";
import { listOrgUsers } from "@/lib/db/queries/users";
import { leadListFiltersSchema } from "@/lib/validation/leads";

const RESULT_LIMIT = 6;

/**
 * Backs the global topbar search's dropdown — leads and teammates in one
 * round trip, each capped to a small preview count (the same pattern
 * /api/leads already uses for the Leads page's own live search, just
 * combined with a second entity type here). Teammates matches the same
 * visibility rule as the admin Users page: a non-super-admin never sees
 * super-admin accounts, even in search results.
 */
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    throw err;
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ leads: [], leadsTotal: 0, people: [] });
  }

  const isManager = session.user.role === "admin" || session.user.role === "super_admin";
  const isSuperAdmin = session.user.role === "super_admin";
  const scopeOwnerId = isManager ? null : session.user.id;

  const filters = leadListFiltersSchema.parse({ search: query, perPage: RESULT_LIMIT });

  const [{ leads, pagination }, orgUsers] = await Promise.all([
    listLeads(session.user.orgId, filters, scopeOwnerId),
    listOrgUsers(session.user.orgId),
  ]);

  const q = query.toLowerCase();
  const people = orgUsers
    .filter((u) => u.id !== session.user.id && (isSuperAdmin || u.role !== "super_admin"))
    .filter((u) => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    .slice(0, RESULT_LIMIT)
    .map((u) => ({ id: u.id, displayName: u.displayName, email: u.email, role: u.role, avatarUrl: u.avatarUrl }));

  return NextResponse.json({ leads, leadsTotal: pagination.total, people });
}
