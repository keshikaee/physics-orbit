import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/dal";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";
import { NameForm } from "@/components/admin/name-form";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const profile = await requireAdmin();
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-5 sm:p-8 animate-rise">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-orbit-text">Settings</h1>
      </header>
      <section className="rounded-2xl border border-orbit-border bg-white p-5 shadow-[var(--shadow-card)] sm:p-7">
        <h2 className="mb-4 font-semibold text-orbit-text">Your account</h2>
        <dl className="mb-5 grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-orbit-text-muted">Email</dt>
          <dd className="text-orbit-text">{profile.email}</dd>
          <dt className="text-orbit-text-muted">Role</dt>
          <dd className="text-orbit-text">Admin</dd>
        </dl>
        <NameForm defaultName={profile.full_name} />
      </section>
    </div>
  );
}
