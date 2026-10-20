import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { getAdminContent, getCurricula } from "@/lib/content/queries";
import { CurriculumPicker, pickCurriculum } from "@/components/curriculum/curriculum-picker";
import { indexGrants } from "@/lib/content/access";
import { AccessOverview } from "@/components/admin/access-overview";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";

export const metadata: Metadata = {
  title: "Access Management",
};

export default function AccessPage({ searchParams }: PageProps<"/admin/access">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Access searchParams={searchParams} />
    </Suspense>
  );
}

async function Access({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const [curricula, params] = await Promise.all([getCurricula(), searchParams]);
  const curriculum = pickCurriculum(curricula, params.curriculum);
  if (!curriculum) return null;
  const { units, grants, students } = await getAdminContent(curriculum.id);
  const grantMap = Object.fromEntries([...indexGrants(grants)].map(([k, v]) => [k, [...v]]));

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-5 sm:p-8 animate-rise">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-orbit-text">Access Management</h1>
        <p className="mt-1 max-w-3xl text-sm text-orbit-text-secondary">
          A student sees an item only if they have access to it <em>and</em> to its subtopic and unit, and all three are published.
          A restriction higher up always wins. Students only ever see content from their own curriculum.
        </p>
      </header>

      <CurriculumPicker curricula={curricula} selected={curriculum.slug} basePath="/admin/access" />

      <section aria-labelledby="by-content" className="space-y-3">
        <h2 id="by-content" className="text-lg font-semibold text-orbit-text">
          By content
        </h2>
        <AccessOverview units={units} grants={grantMap} students={students} groupName={curriculum.name} />
      </section>

      <section aria-labelledby="by-student" className="space-y-3">
        <h2 id="by-student" className="text-lg font-semibold text-orbit-text">
          By student
        </h2>
        {students.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-orbit-border bg-white p-6 text-center text-sm text-orbit-text-muted">
            No {curriculum.name} students yet.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/admin/students/${s.id}`}
                  className="group card-lift flex items-center gap-3 rounded-xl border border-orbit-border bg-white px-4 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-orbit-text">{s.full_name}</span>
                    <span className="block truncate text-xs text-orbit-text-muted">{s.email}</span>
                  </span>
                  <ChevronRight size={16} className="text-orbit-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
