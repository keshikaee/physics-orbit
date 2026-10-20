import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { getMarkingQueue } from "@/lib/roadmap/queries";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";
import { EmptyState } from "@/components/content/empty-state";

export const metadata: Metadata = {
  title: "Marking",
};

export default function MarkingPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Marking />
    </Suspense>
  );
}

async function Marking() {
  await requireAdmin();
  const queue = await getMarkingQueue();
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-5 sm:p-8 animate-rise">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-orbit-text">Marking</h1>
        <p className="mt-1 text-sm text-orbit-text-secondary">Quiz attempts with short answers waiting for your mark, oldest first.</p>
      </header>
      {queue.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing to mark">
          Attempts with short answers that need your judgement will appear here.
        </EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {queue.map((a) => (
            <li key={a.id}>
              <Link
                href={`/admin/students/${a.student_id}/attempts/${a.id}`}
                className="group card-lift flex items-center gap-4 rounded-2xl border border-orbit-border bg-white p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-orbit-text">{a.profiles?.full_name ?? "Student"}</p>
                  <p className="truncate text-sm text-orbit-text-secondary">
                    {a.quizzes?.roadmap_nodes?.roadmaps?.units?.code} · {a.quizzes?.roadmap_nodes?.title} · {a.quizzes?.title} (attempt {a.attempt_no})
                  </p>
                  <p className="text-xs text-orbit-text-muted">
                    Submitted {new Date(a.submitted_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} ·{" "}
                    {Number(a.score)}/{Number(a.max_score)} auto-marked so far
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-orbit-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
