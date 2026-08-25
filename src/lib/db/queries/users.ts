import "server-only";

import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function listOrgUsers(orgId: string) {
  return db.query.users.findMany({
    where: eq(users.orgId, orgId),
    orderBy: asc(users.createdAt),
  });
}
