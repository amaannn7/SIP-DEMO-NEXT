import { Topbar } from "@/components/layout/topbar";
import { requireRoleForPage } from "@/lib/auth/session";
import { listOrgUsers } from "@/lib/db/queries/users";
import { getSessionActivity } from "@/lib/db/queries/session-activity";
import { InviteUserForm } from "./invite-user-form";
import { UserRow } from "./user-row";
import { UserSessionsPanel } from "./user-sessions-panel";

export default async function UsersPage() {
  // Ports the source system's 'users' handler exactly: any admin (not just
  // super admin) can reach this page, but a plain admin's user list — and
  // everything else on it — never surfaces super-admin accounts at all.
  const session = await requireRoleForPage("admin");
  const isSuperAdmin = session.user.role === "super_admin";

  const [allOrgUsers, sessionActivity] = await Promise.all([
    listOrgUsers(session.user.orgId),
    getSessionActivity(session.user.orgId, 7),
  ]);
  const orgUsers = isSuperAdmin ? allOrgUsers : allOrgUsers.filter((u) => u.role !== "super_admin");

  return (
    <>
      <Topbar title="Users" subtitle="Manage team accounts and roles" />
      <div className="space-y-4 p-6">
        <div className="flex justify-end">
          <InviteUserForm isSuperAdmin={isSuperAdmin} />
        </div>

        <div className="card-surface divide-y divide-border rounded-xl border border-border bg-card">
          {orgUsers.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.id === session.user.id}
              canManage={true}
              isSuperAdmin={isSuperAdmin}
              canImpersonate={isSuperAdmin}
            />
          ))}
        </div>

        <UserSessionsPanel initialRows={sessionActivity.filter((row) => isSuperAdmin || row.role !== "super_admin")} />
      </div>
    </>
  );
}
