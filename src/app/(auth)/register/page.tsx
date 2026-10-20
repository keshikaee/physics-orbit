import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Register",
};

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      subtitle="Join Physics Orbit to start learning"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-orbit-primary-text hover:text-orbit-primary-hover font-medium">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
