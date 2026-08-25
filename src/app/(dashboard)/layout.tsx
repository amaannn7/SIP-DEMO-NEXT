import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { resolveBranding } from "@/lib/config/branding";
import { Sidebar } from "@/components/layout/sidebar";
import { DashboardMain } from "@/components/layout/dashboard-main";
import { SidebarCollapseProvider } from "@/components/layout/sidebar-collapse-context";
import { SessionRoleProvider } from "@/components/layout/session-role-context";
import { ActivityHeartbeat } from "@/components/layout/activity-heartbeat";
import { OnboardingWizard } from "@/components/layout/onboarding-wizard";

export default async function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, session.user.orgId),
  });
  const branding = resolveBranding(org?.brandingConfig);

  return (
    <SessionRoleProvider role={session.user.role}>
      <SidebarCollapseProvider>
        <div className="app-shell-bg min-h-screen">
          <ActivityHeartbeat />
          {!session.user.hasCompletedOnboarding && !session.impersonatedBy && <OnboardingWizard initialName={session.user.displayName} />}
          <Sidebar session={session} branding={branding} />
          <DashboardMain>{children}</DashboardMain>
          {modal}
        </div>
      </SidebarCollapseProvider>
    </SessionRoleProvider>
  );
}
