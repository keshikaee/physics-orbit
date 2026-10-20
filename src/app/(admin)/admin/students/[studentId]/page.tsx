import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { getAdminContent, getCurricula, getStudent } from "@/lib/content/queries";
import { StudentDetails } from "@/components/curriculum/student-details";
import { allowedAt, indexGrants, visibility } from "@/lib/content/access";
import { idSchema } from "@/lib/content/schemas";
import { setStudentStatusAction } from "@/lib/content/access-actions";
import { StudentAccessTree } from "@/components/admin/student-access";
import { getStudentProgress } from "@/lib/roadmap/queries";
import { StudentProgress } from "@/components/roadmap/student-progress";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";

export const metadata: Metadata = {
  title: "Student",
};

export default function StudentPage({ params }: PageProps<"/admin/students/[studentId]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Student params={params} />
    </Suspense>
  );
}

async function Student({ params }: { params: Promise<{ studentId: string }> }) {
  await requireAdmin();
  const { studentId } = await params;
  if (!idSchema.safeParse(studentId).success) notFound();

  const [student, curricula, progress] = await Promise.all([getStudent(studentId), getCurricula(), getStudentProgress(studentId)]);
  if (!student) notFound();
  // Access and progress are managed within the student's own curriculum.
  const content = student.curriculum_id ? await getAdminContent(student.curriculum_id) : { units: [], grants: [] };
  const curriculum = curricula.find((c) => c.id === student.curriculum_id) ?? null;

  const index = indexGrants(content.grants);
  // Totals of what this student can actually see right now.
  let units = 0;
  let topics = 0;
  let materials = 0;
  for (const u of content.units) {
    const uv = visibility(allowedAt(index, "unit", u, student.id), u.is_published, null);
    if (uv.visible) units++;
    for (const t of u.topics) {
      const tv = visibility(allowedAt(index, "topic", t, student.id), t.is_published, uv);
      if (tv.visible) topics++;
      for (const m of t.materials) if (visibility(allowedAt(index, "material", m, student.id), m.is_published, tv).visible) materials++;
    }
  }
  const active = student.status === "active";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-5 sm:p-8 animate-rise">
      <Link href="/admin/students" className="inline-flex items-center gap-1.5 text-sm text-orbit-text-secondary hover:text-orbit-text">
        <ArrowLeft size={15} aria-hidden="true" /> All students
      </Link>

      <header className="flex flex-col gap-4 rounded-2xl border border-orbit-border bg-white p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:p-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-orbit-text">{student.full_name}</h1>
          <p className="truncate text-sm text-orbit-text-secondary">{student.email}</p>
          {curriculum && (
            <p className="mt-1.5">
              <span className="rounded-full bg-orbit-primary-muted px-2.5 py-0.5 text-xs font-medium text-orbit-primary-hover">
                {curriculum.name}
              </span>
            </p>
          )}
          <p className="mt-2 text-xs text-orbit-text-muted">
            Joined{" "}
            {new Date(student.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            · Can see {units} {units === 1 ? "unit" : "units"}, {topics} {topics === 1 ? "subtopic" : "subtopics"}, {materials}{" "}
            {materials === 1 ? "material" : "materials"}
          </p>
        </div>
        <form action={setStudentStatusAction} className="flex items-center gap-3">
          <input type="hidden" name="studentId" value={student.id} />
          <input type="hidden" name="status" value={active ? "suspended" : "active"} />
          <span
            className={
              active
                ? "rounded-full bg-orbit-primary-muted px-2.5 py-0.5 text-xs font-medium text-orbit-primary-hover"
                : "rounded-full bg-orbit-warning-muted px-2.5 py-0.5 text-xs font-medium text-orbit-warning"
            }
          >
            {active ? "Active" : "Deactivated"}
          </span>
          <button type="submit" className="btn-secondary rounded-xl px-4 py-2.5 text-sm font-medium">
            {active ? "Deactivate" : "Reactivate"}
          </button>
        </form>
      </header>

      {!active && (
        <p className="rounded-xl border border-[#f5dfb3] bg-orbit-warning-muted p-4 text-sm text-orbit-warning">
          This account is deactivated: the student can&apos;t sign in or see any content. Their access settings below are kept.
        </p>
      )}

      <StudentDetails student={student} curricula={curricula} />

      {!curriculum ? (
        <p className="rounded-xl border border-[#f5dfb3] bg-orbit-warning-muted p-4 text-sm text-orbit-warning">
          This student hasn&apos;t chosen a curriculum yet, so they can&apos;t see any content. They&apos;ll be asked when they next sign
          in, or you can set it above. Access and progress are managed within their curriculum.
        </p>
      ) : (
        <>
          <StudentProgress studentId={student.id} units={content.units} index={index} progress={progress} />

          <section
            aria-labelledby="access-heading"
            className="overflow-hidden rounded-2xl border border-orbit-border bg-white shadow-[var(--shadow-card)]"
          >
            <div className="border-b border-orbit-border-subtle p-5">
              <h2 id="access-heading" className="font-semibold text-orbit-text">
                Learning access
              </h2>
              <p className="mt-1 flex gap-2 text-sm text-orbit-text-secondary">
                <Info size={16} className="mt-0.5 shrink-0 text-orbit-primary" aria-hidden="true" />
                <span>
                  Switch items on or off for this student. They see an item only when it, its subtopic and its unit are all switched on and
                  published. Switching off an item that is open to all students limits it to everyone else.
                </span>
              </p>
            </div>
            <StudentAccessTree studentId={student.id} units={content.units} index={index} />
          </section>
        </>
      )}
    </div>
  );
}
