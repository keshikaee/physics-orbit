import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { idSchema } from "@/lib/content/schemas";
import { getStudent } from "@/lib/content/queries";
import { getAttemptReview } from "@/lib/roadmap/queries";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";
import { AttemptResponses, AttemptSummary } from "@/components/roadmap/attempt-review";

export const metadata: Metadata = {
  title: "Quiz attempt",
};

export default function AdminAttemptPage({ params }: PageProps<"/admin/students/[studentId]/attempts/[attemptId]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Attempt params={params} />
    </Suspense>
  );
}

async function Attempt({ params }: { params: Promise<{ studentId: string; attemptId: string }> }) {
  await requireAdmin();
  const { studentId, attemptId } = await params;
  if (!idSchema.safeParse(studentId).success || !idSchema.safeParse(attemptId).success) notFound();
  const [student, review] = await Promise.all([getStudent(studentId), getAttemptReview(attemptId)]);
  if (!student || !review || review.attempt.student_id !== studentId) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5 sm:p-8 animate-rise">
      <Link href={`/admin/students/${studentId}#progress`} className="inline-flex items-center gap-1.5 text-sm text-orbit-text-secondary hover:text-orbit-text">
        <ArrowLeft size={15} aria-hidden="true" /> {student.full_name}
      </Link>
      <header>
        <p className="text-sm font-medium text-orbit-primary-text">{student.full_name}&apos;s attempt</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-orbit-text">{review.quiz.title}</h1>
      </header>
      <AttemptSummary review={review} staff />
      <AttemptResponses review={review} marking />
    </div>
  );
}
