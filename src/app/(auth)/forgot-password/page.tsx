import { AuthCard } from "../auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we’ll generate a reset link."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
