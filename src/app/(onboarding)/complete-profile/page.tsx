import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireStudentAccount } from "@/lib/auth/dal";
import { AuthCard } from "@/components/auth/auth-card";
import { CompleteProfileForm } from "@/components/auth/complete-profile-form";

export const metadata: Metadata = {
  title: "Complete your profile",
};

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={null}>
      <CompleteProfile />
    </Suspense>
  );
}

async function CompleteProfile() {
  const profile = await requireStudentAccount();
  if (profile.curriculum) redirect("/dashboard");
  return (
    <AuthCard title="Complete your profile" subtitle={`Hi ${profile.full_name.split(" ")[0]} — tell us your curriculum so we can show you the right course.`}>
      <CompleteProfileForm />
    </AuthCard>
  );
}
