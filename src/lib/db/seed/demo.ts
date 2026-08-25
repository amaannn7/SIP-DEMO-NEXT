/**
 * Levata's own sales-pitch demo seed — used ONLY for the sales-pitch demo
 * build, never for a real client deployment (use seed:client for that).
 * Models Levata's own sales pipeline (levatahq.com): ICP fields, AI brand
 * context, and demo leads all reflect Levata's actual service lines and
 * ideal-customer profile, not a placeholder or a past client's identity.
 * Creates an org, an admin, and a couple of reps so the demo login story
 * (not just the static dashboard page) actually works end to end.
 *
 * No brandingConfig override here — the org inherits DEFAULT_BRANDING
 * (lib/config/branding.ts), which is already Levata's own name/logo/violet
 * accent, so there's nothing client-specific to set at seed time.
 */
import { db } from "@/lib/db";
import { organizations, users, icpFields, orgSettings } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { DEFAULT_ICP_FIELDS } from "./default-icp-fields";
import { seedDemoLeads } from "./demo-leads";
import { seedDefaultChatChannel } from "./default-chat-channel";

const DEMO_PASSWORD = "demo1234";
const DEMO_ORG_NAME = "Levata";
const DEMO_EMAIL_DOMAIN = "salesintel.demo";

async function main() {
  const [org] = await db
    .insert(organizations)
    .values({
      name: DEMO_ORG_NAME,
    })
    .returning({ id: organizations.id });

  // Role-labeled, not name-labeled — a demo login should read as "which
  // role am I signing in as" at a glance rather than requiring a lookup
  // table of which fictional person maps to which permission level.
  const seedUsers = [
    { email: `superadmin@${DEMO_EMAIL_DOMAIN}`, displayName: "Super Admin", role: "super_admin" as const },
    { email: `admin@${DEMO_EMAIL_DOMAIN}`, displayName: "Admin", role: "admin" as const },
    { email: `rep@${DEMO_EMAIL_DOMAIN}`, displayName: "Rep", role: "rep" as const },
  ];

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const insertedUsers: { id: string; role: (typeof seedUsers)[number]["role"] }[] = [];
  for (const user of seedUsers) {
    const [row] = await db
      .insert(users)
      .values({
        orgId: org.id,
        email: user.email,
        passwordHash,
        displayName: user.displayName,
        role: user.role,
      })
      .returning({ id: users.id });
    insertedUsers.push({ id: row.id, role: user.role });
  }

  // AiBrandContext drives every AI-generated research/email/call-pitch
  // prompt — this is Levata's own positioning, sourced from levatahq.com
  // (service lines, ICP, buying triggers, four-phase Diagnose/Architect/
  // Build/Compound methodology), not a past client's identity.
  await db.insert(orgSettings).values({
    orgId: org.id,
    brandContext: {
      companyDescription:
        "Levata designs and operates custom intelligence systems for growth-stage and mid-market B2B companies — AI & Intelligence, Digital Infrastructure, Automation & Systems, Product Engineering, and a Sales Intelligence Platform, aligned under one team.",
      valueProposition:
        "A four-phase engagement — Diagnose, Architect, Build, Compound — that replaces disconnected tools and manual operations with one integrated system, so growth compounds monthly instead of requiring another point solution every quarter.",
      socialProof:
        "Clients across SaaS, e-commerce, professional services, and retail in Australia, Canada, Singapore, Qatar, UAE, New Zealand, and Sri Lanka, including Macktiles, Elevate, Besanz, and Sterling Nutritions.",
      toneGuidelines:
        "Confident, strategic, outcomes-focused. Direct and problem-first — name the real cost (hours lost to manual work, disconnected data, traffic that doesn't convert) before the fix. Talk in terms of systems and infrastructure, not deliverables or features. No exclamation marks, no filler enthusiasm. The goal is booking a strategy call, not closing in the first message.",
    },
  });
  await db.insert(icpFields).values(DEFAULT_ICP_FIELDS.map((f) => ({ ...f, orgId: org.id })));
  await seedDefaultChatChannel(org.id, insertedUsers[0].id);

  // Leads are owned by reps only, matching how a real org's pipeline is distributed.
  const repIds = insertedUsers.filter((u) => u.role === "rep").map((u) => u.id);
  const leadCount = 55;
  await seedDemoLeads(org.id, repIds, leadCount);

  console.log(`Seeded demo organization "${DEMO_ORG_NAME}" with ${seedUsers.length} users and ${leadCount} leads.`);
  console.log(`All demo accounts use the password: ${DEMO_PASSWORD}`);
  seedUsers.forEach((u) => console.log(`  ${u.email} (${u.role})`));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
