import { AlertCircle } from "lucide-react";
import { AuthCard } from "../auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <AuthCard title="Set a new password" description="Choose a password you haven’t used before.">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p
          className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          This reset link is missing its token. Request a new one from the forgot password page.
        </p>
      )}
    </AuthCard>
  );
}
