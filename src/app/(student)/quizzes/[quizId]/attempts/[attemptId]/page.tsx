import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, PlayCircle } from "lucide-react";
import { requireStudent } from "@/lib/auth/dal";
import { idSchema } from "@/lib/content/schemas";
import { getAttemptReview, getQuizForStudent } from "@/lib/roadmap/queries";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";
import { AttemptResponses, AttemptSummary } from "@/components/roadmap/attempt-review";

export const metadata: Metadata = {
  title: "Quiz result",
};

export default function AttemptPage({ params }: PageProps<"/quizzes/[quizId]/attempts/[attemptId]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Attempt params={params} />
    </Suspense>
  );
}

async function Attempt({ params }: { params: Promise<{ quizId: string; attemptId: string }> }) {
  const profile = await requireStudent();
  const { quizId, attemptId } = await params;
  if (!idSchema.safeParse(quizId).success || !idSchema.safeParse(attemptId).success) notFound();

  // The review function only returns the caller's own attempts.
  const [review, quiz] = await Promise.all([getAttemptReview(attemptId), getQuizForStudent(quizId, profile.id)]);
  if (!review || review.quiz.id !== quizId) notFound();

  const left = quiz ? (quiz.quiz.max_attempts === null ? null : quiz.quiz.max_attempts - quiz.attempts.length) : 0;
  const canRetry = quiz && !quiz.locked && (left === null || left > 0) && quiz.questions.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5 sm:p-8 animate-rise">
      {quiz && (
        <Link href={`/courses/${quiz.unit.slug}`} className="inline-flex items-center gap-1.5 text-sm text-orbit-text-secondary hover:text-orbit-text">
          <ArrowLeft size={15} aria-hidden="true" /> {quiz.unit.code} roadmap
        </Link>
      )}
      <header>
        <p className="text-sm font-medium text-orbit-primary-text">Result</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-orbit-text">{review.quiz.title}</h1>
      </header>
      <AttemptSummary review={review} />
      <AttemptResponses review={review} />
      {canRetry && (
        <Link href={`/quizzes/${quizId}`} className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium">
          <PlayCircle size={16} aria-hidden="true" /> Try again{left !== null ? ` (${left} ${left === 1 ? "attempt" : "attempts"} left)` : ""}
        </Link>
      )}
    </div>
  );
}
