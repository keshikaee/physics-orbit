import type { Metadata } from "next";
import { Suspense } from "react";
import { AppNav } from "@/components/layout/app-nav";
import { SidebarSkeleton } from "@/components/layout/dashboard-skeleton";
import { ProfileCard, ProfileCardSkeleton } from "@/components/layout/user-chip";
import { requireStudent } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Student Portal",
};

export default function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-orbit-canvas md:flex-row">
      <Suspense fallback={<SidebarSkeleton />}>
        <AppNav
          variant="student"
          profile={
            <Suspense fallback={<ProfileCardSkeleton />}>
              <StudentProfile />
            </Suspense>
          }
        />
      </Suspense>
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

async function StudentProfile() {
  const profile = await requireStudent();
  return <ProfileCard profile={profile} />;
}
