import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { requireStudent } from "@/lib/auth/dal";
import { idSchema } from "@/lib/content/schemas";
import { getQuizForStudent } from "@/lib/roadmap/queries";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";
import { EmptyState } from "@/components/content/empty-state";
import { RichText } from "@/components/content/notes-view";
import { QuizRunner } from "@/components/roadmap/quiz-runner";

export const metadata: Metadata = {
  title: "Quiz",
};

export default function QuizPage({ params }: PageProps<"/quizzes/[quizId]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Quiz params={params} />
    </Suspense>
  );
}

async function Quiz({ params }: { params: Promise<{ quizId: string }> }) {
  const profile = await requireStudent();
  const { quizId } = await params;
  if (!idSchema.safeParse(quizId).success) notFound();
  const data = await getQuizForStudent(quizId, profile.id);
  if (!data) notFound(); // missing, unpublished, or not shared with this student (RLS)

  const { quiz, unit, step, attempts, questions, locked } = data;
  const used = attempts.length;
  const left = quiz.max_attempts === null ? null : quiz.max_attempts - used;
  const latest = attempts[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5 sm:p-8 animate-rise">
      <Link href={`/courses/${unit.slug}`} className="inline-flex items-center gap-1.5 text-sm text-orbit-text-secondary hover:text-orbit-text">
        <ArrowLeft size={15} aria-hidden="true" /> {unit.code} roadmap
      </Link>

      <header className="rounded-2xl border border-orbit-border bg-white p-6 shadow-[var(--shadow-card)]">
        <p className="text-sm font-medium text-orbit-primary-text">{step.title}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-orbit-text">{quiz.title}</h1>
        {quiz.description && (
          <div className="mt-2 text-sm leading-relaxed text-orbit-text-secondary">
            <RichText source={quiz.description} />
          </div>
        )}
        <p className="mt-3 text-sm text-orbit-text-muted">
          {questions.length} {questions.length === 1 ? "question" : "questions"} · pass mark {quiz.pass_percent}% ·{" "}
          {left === null ? "unlimited attempts" : `${used} of ${quiz.max_attempts} ${quiz.max_attempts === 1 ? "attempt" : "attempts"} used`}
        </p>
        {latest && (
          <Link href={`/quizzes/${quiz.id}/attempts/${latest.id}`} className="mt-3 inline-block text-sm font-medium text-orbit-primary-text hover:underline">
            View your latest result
          </Link>
        )}
      </header>

      {locked ? (
        <EmptyState icon={Lock} title="Finish the earlier steps first">
          This quiz unlocks when you complete the steps before it on the roadmap.
        </EmptyState>
      ) : left !== null && left <= 0 ? (
        <EmptyState icon={Lock} title="No attempts left">
          You have used all your attempts for this quiz.
        </EmptyState>
      ) : questions.length === 0 ? (
        <EmptyState icon={Lock} title="No questions yet">
          Your teacher hasn&apos;t added questions to this quiz yet.
        </EmptyState>
      ) : (
        <QuizRunner quizId={quiz.id} questions={questions} />
      )}
    </div>
  );
}
