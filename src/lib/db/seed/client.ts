/**
 * Minimal seed for a real client deployment: one organization, one
 * super-admin account, nothing else. Run via `npm run seed:client`.
 *
 * This is what NEW-CLIENT-SETUP.md points a fresh deployment at — contrast
 * with seed:demo, which is generic showcase sample data for sales-pitch
 * demos and should never run against a real client's database.
 */
import { db } from "@/lib/db";
import { organizations, users, icpFields, orgSettings } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { DEFAULT_BRANDING } from "@/lib/config/branding";
import { DEFAULT_ICP_FIELDS } from "./default-icp-fields";
import { seedDefaultChatChannel } from "./default-chat-channel";

async function main() {
  const adminEmail = requireEnv("INITIAL_ADMIN_EMAIL");
  const adminPassword = requireEnv("INITIAL_ADMIN_PASSWORD");

  const [org] = await db
    .insert(organizations)
    .values({
      name: DEFAULT_BRANDING.companyName,
      brandingConfig: {
        companyName: DEFAULT_BRANDING.companyName,
        accentColor: DEFAULT_BRANDING.accentColor,
        sidebarColor: DEFAULT_BRANDING.sidebarColor,
      },
    })
    .returning({ id: organizations.id });

  const [admin] = await db
    .insert(users)
    .values({
      orgId: org.id,
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      displayName: "Admin",
      role: "super_admin",
    })
    .returning({ id: users.id });

  await db.insert(orgSettings).values({ orgId: org.id });
  await db.insert(icpFields).values(DEFAULT_ICP_FIELDS.map((f) => ({ ...f, orgId: org.id })));
  await seedDefaultChatChannel(org.id, admin.id);

  console.log(`Seeded organization "${DEFAULT_BRANDING.companyName}" with super admin ${adminEmail}`);
  console.log("Log in and change this password immediately.");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — required for seed:client. Check your .env.`);
  }
  return value;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
