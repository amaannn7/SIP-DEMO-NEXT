import { Topbar } from "@/components/layout/topbar";
import { requireAuthForPage } from "@/lib/auth/session";
import { getEffectiveSenderProfile } from "@/lib/db/queries/sender-profile";
import { MyContextForm } from "./my-context-form";

export default async function MyContextPage() {
  const session = await requireAuthForPage();
  const profile = await getEffectiveSenderProfile(session.user.orgId, session.user.id);

  return (
    <>
      <Topbar title="My Context" subtitle="Your sender info and email settings" />
      <div className="p-6">
        <MyContextForm profile={profile} />
      </div>
    </>
  );
}
