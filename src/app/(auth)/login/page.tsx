import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your Physics Orbit account"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-orbit-primary-text hover:text-orbit-primary-hover font-medium">
            Register here
          </Link>
        </>
      }
    >
      {/* LoginForm reads ?next= and ?error= from the URL */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
