import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { getStudent } from "@/lib/content/queries";
import { idSchema } from "@/lib/content/schemas";
import { getStudentActivity } from "@/lib/activity/queries";
import { buildTimeline, type TimelineItem } from "@/lib/activity/analytics";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { TrackingNote } from "@/components/activity/stat-grid";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Interaction history",
};

const FILTERS = {
  all: { label: "Everything", keep: () => true },
  signins: { label: "Sign-ins", keep: (i: TimelineItem) => i.type === "event" && i.kind === "sign_in" },
  visits: { label: "Page visits", keep: (i: TimelineItem) => i.type === "event" && i.kind !== "sign_in" },
  materials: { label: "Materials", keep: (i: TimelineItem) => i.type === "event" && i.kind === "material_view" },
  quizzes: { label: "Quiz submissions", keep: (i: TimelineItem) => i.type === "attempt" },
  steps: { label: "Completed steps", keep: (i: TimelineItem) => i.type === "completion" },
} as const;
type FilterId = keyof typeof FILTERS;
const MAX = 1000;

export default function StudentActivityPage({ params, searchParams }: PageProps<"/admin/students/[studentId]/activity">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <History params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function History({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const [{ studentId }, query] = await Promise.all([params, searchParams]);
  if (!idSchema.safeParse(studentId).success) notFound();
  const filter: FilterId = typeof query.type === "string" && query.type in FILTERS ? (query.type as FilterId) : "all";

  const [student, activity] = await Promise.all([getStudent(studentId), getStudentActivity(studentId)]);
  if (!student) notFound();
  const all = buildTimeline(activity.events, activity.attempts, activity.completions);
  const shown = all.filter(FILTERS[filter].keep);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-5 sm:p-8 animate-rise">
      <Link
        href={`/admin/students/${student.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-orbit-text-secondary hover:text-orbit-text"
      >
        <ArrowLeft size={15} aria-hidden="true" /> {student.full_name}
      </Link>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-orbit-text">Interaction history</h1>
        <p className="mt-1 text-sm text-orbit-text-secondary">
          Everything {student.full_name} has done on Physics Orbit, newest first. Times are Sri Lanka time.
        </p>
      </header>

      <nav aria-label="Filter history" className="flex flex-wrap gap-2">
        {(Object.keys(FILTERS) as FilterId[]).map((id) => (
          <Link
            key={id}
            href={id === "all" ? `/admin/students/${student.id}/activity` : `/admin/students/${student.id}/activity?type=${id}`}
            aria-current={filter === id ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === id
                ? "border-orbit-primary bg-orbit-primary text-white"
                : "border-orbit-border bg-white text-orbit-text-secondary hover:bg-orbit-panel",
            )}
          >
            {FILTERS[id].label} <span className={filter === id ? "text-white/80" : "text-orbit-text-muted"}>({all.filter(FILTERS[id].keep).length})</span>
          </Link>
        ))}
      </nav>

      <div className="overflow-hidden rounded-2xl border border-orbit-border bg-white shadow-[var(--shadow-card)]">
        <ActivityTimeline items={shown.slice(0, MAX)} studentId={student.id} />
        {shown.length > MAX && (
          <p className="border-t border-orbit-border-subtle px-5 py-2.5 text-xs text-orbit-text-muted">
            Showing the latest {MAX} of {shown.length}.
          </p>
        )}
        <TrackingNote />
      </div>
    </div>
  );
}
