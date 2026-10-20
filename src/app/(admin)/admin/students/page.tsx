import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/dal";
import { getCurricula, getStudents } from "@/lib/content/queries";
import { StudentList } from "@/components/admin/student-list";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";

export const metadata: Metadata = {
  title: "Students",
};

export default function StudentsPage({ searchParams }: PageProps<"/admin/students">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Students searchParams={searchParams} />
    </Suspense>
  );
}

async function Students({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const [students, curricula, params] = await Promise.all([getStudents(), getCurricula(), searchParams]);
  const initial = curricula.find((c) => c.slug === params.curriculum)?.id ?? "all";
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8 animate-rise">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-orbit-text">Students</h1>
        <p className="mt-1 text-sm text-orbit-text-secondary">View students by curriculum. Open a student to see their details, progress and access.</p>
      </header>
      <StudentList students={students} curricula={curricula} initialFilter={initial} />
    </div>
  );
}
