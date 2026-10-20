import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, BookOpen, ChevronRight, Lock } from "lucide-react";
import { requireStudent } from "@/lib/auth/dal";
import { getUnitWithTopics } from "@/lib/content/queries";
import { getStudentRoadmap } from "@/lib/roadmap/queries";
import { StudentRoadmap } from "@/components/roadmap/student-roadmap";
import { EmptyState } from "@/components/content/empty-state";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";
import { UnitArt } from "@/components/illustrations/unit-art";

export const metadata: Metadata = {
  title: "Unit",
};

export default function UnitPage({ params }: PageProps<"/courses/[unitSlug]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <UnitOverview params={params} />
    </Suspense>
  );
}

async function UnitOverview({ params }: { params: Promise<{ unitSlug: string }> }) {
  const profile = await requireStudent();
  const { unitSlug } = await params;
  const result = await getUnitWithTopics(unitSlug, profile.curriculum.id);
  if (!result) notFound(); // missing OR unpublished (RLS hides it)

  const { unit, topics } = result;
  // Only a published roadmap the student may see comes back (RLS).
  const roadmap = unit.is_placeholder ? null : await getStudentRoadmap(unit.id, profile.id);
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-5 sm:p-8 animate-rise">
      <Link
        href="/courses"
        className="inline-flex items-center gap-1.5 text-sm text-orbit-text-secondary transition-colors hover:text-orbit-text"
      >
        <ArrowLeft size={15} aria-hidden="true" /> All units
      </Link>

      <header className="overflow-hidden rounded-3xl border border-orbit-border bg-white shadow-[var(--shadow-card)] sm:flex">
        <div className="flex-1 p-6 sm:p-8">
          <p className="text-sm font-medium text-orbit-primary-text">{unit.code}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-orbit-text">{unit.title}</h1>
          {unit.description && <p className="mt-3 max-w-2xl leading-relaxed text-orbit-text-secondary">{unit.description}</p>}
          {!unit.is_placeholder && (
            <p className="mt-4 text-sm text-orbit-text-muted">
              {topics.length} {topics.length === 1 ? "subtopic" : "subtopics"}
            </p>
          )}
        </div>
        <UnitArt position={unit.order_index} muted={unit.is_placeholder} className="h-36 sm:h-auto sm:w-64" />
      </header>

      {roadmap && <StudentRoadmap data={roadmap} unitSlug={unit.slug} />}

      {unit.is_placeholder ? (
        <EmptyState icon={Lock} title="Content coming soon">
          Your teacher is preparing this unit. It will appear here once it&apos;s ready.
        </EmptyState>
      ) : topics.length === 0 ? (
        <EmptyState icon={BookOpen} title="No subtopics yet">
          Subtopics will appear here when they are shared with you.
        </EmptyState>
      ) : (
        <section aria-labelledby="topics-heading">
          <h2 id="topics-heading" className="mb-4 text-xl font-semibold text-orbit-text">
            Subtopics
          </h2>
          <ol className="space-y-3">
            {topics.map((topic, i) => (
              <li key={topic.id}>
                <Link
                  href={`/courses/${unit.slug}/${topic.slug}`}
                  className="group card-lift flex items-center gap-4 rounded-2xl border border-orbit-border bg-white p-5"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orbit-panel-hover font-semibold text-orbit-primary-hover"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-orbit-text">{topic.title}</h3>
                    {topic.description && (
                      <p className="mt-1 text-sm leading-relaxed text-orbit-text-secondary">{topic.description}</p>
                    )}
                    <p className="mt-2.5 text-xs font-medium text-orbit-text-muted">
                      {topic.material_count === 0
                        ? "Materials coming soon"
                        : `${topic.material_count} ${topic.material_count === 1 ? "material" : "materials"}`}
                    </p>
                  </div>
                  <ChevronRight
                    size={18}
                    className="shrink-0 text-orbit-text-muted transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
