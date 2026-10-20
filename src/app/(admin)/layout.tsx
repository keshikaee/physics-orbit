import type { Metadata } from "next";
import { Suspense } from "react";
import { AppNav } from "@/components/layout/app-nav";
import { SidebarSkeleton } from "@/components/layout/dashboard-skeleton";
import { ProfileCard, ProfileCardSkeleton } from "@/components/layout/user-chip";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Admin",
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-orbit-canvas md:flex-row">
      <Suspense fallback={<SidebarSkeleton />}>
        <AppNav
          variant="admin"
          profile={
            <Suspense fallback={<ProfileCardSkeleton />}>
              <AdminProfile />
            </Suspense>
          }
        />
      </Suspense>
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

async function AdminProfile() {
  const profile = await requireAdmin();
  return <ProfileCard profile={profile} />;
}
