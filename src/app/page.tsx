import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function RootPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const isManager = session.user.role === "admin" || session.user.role === "super_admin";
  redirect(isManager ? "/admin" : "/dashboard");
}
