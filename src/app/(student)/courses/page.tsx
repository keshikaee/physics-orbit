import type { Metadata } from "next";
import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import { requireStudent } from "@/lib/auth/dal";
import { getCourseWithUnits } from "@/lib/content/queries";
import { UnitCard } from "@/components/content/unit-card";
import { getUnitProgress } from "@/lib/roadmap/queries";
import { EmptyState } from "@/components/content/empty-state";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";
import { TrackVisit } from "@/components/activity/track-visit";

export const metadata: Metadata = {
  title: "Courses",
};

export default function CoursesPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <CourseOverview />
    </Suspense>
  );
}

async function CourseOverview() {
  const profile = await requireStudent();
  const [result, progress] = await Promise.all([getCourseWithUnits(profile.curriculum.id), getUnitProgress(profile.id)]);

  if (!result) {
    return (
      <div className="mx-auto max-w-5xl p-5 sm:p-8">
        <EmptyState icon={BookOpen} title="Nothing here yet">
          No learning materials are available for your curriculum yet.
        </EmptyState>
      </div>
    );
  }

  const { course, units } = result;
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-5 sm:p-8 animate-rise">
      <TrackVisit kind="courses_view" />
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-orbit-primary-text">Your course · {profile.curriculum.name}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-orbit-text sm:text-4xl">{course.title}</h1>
        {course.description && <p className="mt-3 text-orbit-text-secondary">{course.description}</p>}
      </header>

      {units.length === 0 ? (
        <EmptyState icon={BookOpen} title="No units yet">
          No learning materials are available for your curriculum yet.
        </EmptyState>
      ) : (
        <section aria-labelledby="units-heading">
          <h2 id="units-heading" className="sr-only">
            Units
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {units.map((unit) => (
              <UnitCard key={unit.id} unit={unit} progress={progress[unit.id]} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
