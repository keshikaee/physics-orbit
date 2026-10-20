import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = {
  title: "Choose a New Password",
};

/* Reached from the emailed reset link via /auth/callback, which signs the user in. */
export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password" subtitle="Enter a new password for your account">
      <ResetPasswordForm />
    </AuthCard>
  );
}
