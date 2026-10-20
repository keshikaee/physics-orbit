import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { idSchema } from "@/lib/content/schemas";
import { getQuizEditor } from "@/lib/roadmap/queries";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";
import { QuizEditor } from "@/components/roadmap/quiz-editor";

export const metadata: Metadata = {
  title: "Edit quiz",
};

export default function QuizEditorPage({ params }: PageProps<"/admin/quizzes/[quizId]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: Promise<{ quizId: string }> }) {
  await requireAdmin();
  const { quizId } = await params;
  if (!idSchema.safeParse(quizId).success) notFound();
  const data = await getQuizEditor(quizId);
  if (!data) notFound();
  const roadmapHref = `/admin/content/${data.unit.id}/roadmap`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-5 sm:p-8 animate-rise">
      <header className="space-y-3">
        <Link href={roadmapHref} className="inline-flex items-center gap-1.5 text-sm text-orbit-text-secondary hover:text-orbit-text">
          <ArrowLeft size={15} aria-hidden="true" /> {data.unit.code} roadmap
        </Link>
        <div>
          <p className="text-sm font-medium text-orbit-primary-text">Quiz · {data.step.title}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-orbit-text">{data.quiz.title}</h1>
        </div>
      </header>
      <QuizEditor key={data.quiz.id} data={data} roadmapHref={roadmapHref} />
    </div>
  );
}
