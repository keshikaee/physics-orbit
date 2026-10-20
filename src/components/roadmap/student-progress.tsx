import Link from "next/link";
import { CheckCircle2, ChevronRight, Clock, EyeOff, History, Route } from "lucide-react";
import type { AdminUnit } from "@/lib/content/queries";
import type { getStudentProgress } from "@/lib/roadmap/queries";
import { allowedAt, stepVisibility, visibility, type GrantIndex, type Visibility } from "@/lib/content/access";
import { orderSteps, progressOf, stepStates } from "@/lib/roadmap/progress";
import { Badge } from "@/components/content/badges";
import { cn } from "@/lib/utils";
import { STATE_LABEL, STEP_KIND } from "./step-meta";
import { ProgressActions } from "./progress-actions";
import { AccessSwitch } from "@/components/admin/access-switch";
import { setStudentAccessAction } from "@/lib/content/access-actions";

/*
 * Admin view of one student's roadmaps: what they can see, what they have
 * completed, their quiz attempts, and audited overrides. Visibility here
 * mirrors the database rule (can_view_node); the database stays the authority.
 */

type Progress = Awaited<ReturnType<typeof getStudentProgress>>;

const ACTION_LABEL: Record<string, string> = {
  mark_complete: "Marked complete",
  mark_incomplete: "Marked not complete",
  reset_step: "Reset step",
  remark: "Re-marked an answer",
  curriculum_change: "Changed curriculum",
};

export function StudentProgress({
  studentId,
  units,
  index,
  progress,
}: {
  studentId: string;
  units: AdminUnit[];
  index: GrantIndex;
  progress: Progress;
}) {
  const completedAt = new Map(progress.completions.map((c) => [c.node_id, c]));
  const completed = new Set(completedAt.keys());
  const attemptsByQuiz = new Map<string, Progress["attempts"]>();
  for (const a of progress.attempts) attemptsByQuiz.set(a.quiz_id, [...(attemptsByQuiz.get(a.quiz_id) ?? []), a]);
  const quizzesByNode = new Map<string, Progress["quizzes"]>();
  for (const q of progress.quizzes) quizzesByNode.set(q.node_id, [...(quizzesByNode.get(q.node_id) ?? []), q]);
  const stepTitle = new Map(progress.roadmaps.flatMap((r) => r.roadmap_nodes.map((n) => [n.id, n.title] as const)));

  const roadmaps = progress.roadmaps
    .map((r) => ({ r, unit: units.find((u) => u.id === r.unit_id) }))
    .filter((x): x is { r: Progress["roadmaps"][number]; unit: AdminUnit } => Boolean(x.unit))
    .sort((a, b) => a.unit.order_index - b.unit.order_index);

  return (
    <section id="progress" aria-labelledby="progress-heading" className="overflow-hidden rounded-2xl border border-orbit-border bg-white shadow-[var(--shadow-card)]">
      <div className="border-b border-orbit-border-subtle p-5">
        <h2 id="progress-heading" className="font-semibold text-orbit-text">
          Roadmap progress
        </h2>
        <p className="mt-1 text-sm text-orbit-text-secondary">
          Completion is recorded by the server when the student meets each step&apos;s rule. Overrides and resets need a reason and are logged.
        </p>
      </div>

      {roadmaps.length === 0 ? (
        <p className="p-5 text-sm text-orbit-text-muted">No unit has a roadmap yet.</p>
      ) : (
        <div className="divide-y divide-orbit-border-subtle">
          {roadmaps.map(({ r, unit }) => {
            // What this student can see — same rule as public.can_view_node.
            const uv = visibility(allowedAt(index, "unit", unit, studentId), unit.is_published, null);
            const topicVis = new Map<string, Visibility>();
            const materialVis = new Map<string, Visibility>();
            for (const t of unit.topics) {
              const tv = visibility(allowedAt(index, "topic", t, studentId), t.is_published, uv);
              topicVis.set(t.id, tv);
              for (const m of t.materials) materialVis.set(m.id, visibility(allowedAt(index, "material", m, studentId), m.is_published, tv));
            }
            const hidden: Visibility = { allowed: false, visible: false, blockedBy: null };
            const vis = new Map(
              r.roadmap_nodes.map((n) => [
                n.id,
                stepVisibility(
                  allowedAt(index, "node", { ...n, is_published: true }, studentId),
                  r.is_published,
                  uv,
                  n.topic_id ? (topicVis.get(n.topic_id) ?? hidden) : null,
                  n.roadmap_node_materials.map((m) => materialVis.get(m.material_id) ?? hidden),
                ),
              ]),
            );
            const visibleSteps = r.roadmap_nodes.filter((n) => vis.get(n.id)!.visible);
            const started = new Set(
              r.roadmap_nodes.filter((n) => (quizzesByNode.get(n.id) ?? []).some((q) => attemptsByQuiz.has(q.id))).map((n) => n.id),
            );
            const states = stepStates(visibleSteps, r.roadmap_edges, completed, started);
            const p = progressOf(visibleSteps, completed);
            const ordered = orderSteps(r.roadmap_nodes, r.roadmap_edges);

            return (
              <details key={r.id} className="group" open={roadmaps.length === 1}>
                <summary className="flex cursor-pointer list-none items-center gap-3 p-5 hover:bg-orbit-panel/60">
                  <Route size={18} className="shrink-0 text-orbit-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-orbit-primary-text">{unit.code}</span>
                    <span className="block font-medium text-orbit-text">{unit.title}</span>
                  </span>
                  <span className="text-right text-sm text-orbit-text-secondary">
                    {p.total ? `${p.done} of ${p.total} required steps` : "No required steps visible"}
                    {!r.is_published && <span className="block text-xs text-orbit-text-muted">Roadmap is a draft</span>}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-orbit-text-muted transition-transform group-open:rotate-90" aria-hidden="true" />
                </summary>

                <ol className="space-y-2 px-3 pb-4 sm:px-5">
                  {ordered.map((n) => {
                    const v = vis.get(n.id)!;
                    const state = v.visible ? states.get(n.id)! : null;
                    const quizzes = quizzesByNode.get(n.id) ?? [];
                    const done = completedAt.get(n.id);
                    return (
                      <li
                        key={n.id}
                        className={cn(
                          "rounded-xl border p-3",
                          state === "completed" ? "border-orbit-primary/40 bg-orbit-panel-hover/50" : "border-orbit-border",
                          !v.visible && "bg-orbit-canvas",
                        )}
                      >
                        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-orbit-primary-text">
                              {STEP_KIND[n.kind].label}
                              {!n.is_required && <span className="font-normal text-orbit-text-muted"> · optional</span>}
                            </p>
                            <p className={cn("font-medium", v.visible ? "text-orbit-text" : "text-orbit-text-muted")}>{n.title}</p>
                          </div>
                          <AccessSwitch action={setStudentAccessAction} studentId={studentId} kind="node" id={n.id} allowed={v.allowed} title={n.title} />
                          {!v.visible ? (
                            <Badge>
                              <EyeOff size={12} aria-hidden="true" />
                              {v.blockedBy === "unpublished" ? "Roadmap draft" : v.allowed ? "Hidden by unit or linked content" : "No access"}
                            </Badge>
                          ) : state === "completed" ? (
                            <Badge tone="success">
                              <CheckCircle2 size={12} aria-hidden="true" /> Completed
                            </Badge>
                          ) : (
                            <Badge tone={state === "in_progress" ? "success" : "muted"}>{STATE_LABEL[state!]}</Badge>
                          )}
                        </div>
                        {done && (
                          <p className="mt-1 text-xs text-orbit-text-muted">
                            {done.source === "auto" ? "Completed by meeting the rule" : done.source === "student" ? "Marked done by the student" : "Marked complete by an admin"} on{" "}
                            {new Date(done.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}
                        {quizzes.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {quizzes.map((q) => {
                              const attempts = attemptsByQuiz.get(q.id) ?? [];
                              return (
                                <li key={q.id} className="text-sm">
                                  <span className="text-orbit-text">{q.title}</span>
                                  {attempts.length === 0 ? (
                                    <span className="text-orbit-text-muted"> — not attempted</span>
                                  ) : (
                                    <span className="ml-1 inline-flex flex-wrap gap-1.5 align-middle">
                                      {attempts.map((a) => (
                                        <Link
                                          key={a.id}
                                          href={`/admin/students/${studentId}/attempts/${a.id}`}
                                          className={cn(
                                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium hover:underline",
                                            a.status === "awaiting_marking"
                                              ? "border-[#f5dfb3] bg-orbit-warning-muted text-orbit-warning"
                                              : a.passed
                                                ? "border-transparent bg-orbit-primary-muted text-orbit-primary-hover"
                                                : "border-orbit-border bg-white text-orbit-text-secondary",
                                          )}
                                        >
                                          {a.status === "awaiting_marking" && <Clock size={11} aria-hidden="true" />}#{a.attempt_no} {Number(a.score)}/{Number(a.max_score)}
                                          {a.status === "awaiting_marking" ? " · to mark" : a.passed ? " · passed" : ""}
                                        </Link>
                                      ))}
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <ProgressActions studentId={studentId} nodeId={n.id} completed={Boolean(done)} hasAttempts={quizzes.some((q) => attemptsByQuiz.has(q.id))} />
                      </li>
                    );
                  })}
                </ol>
              </details>
            );
          })}
        </div>
      )}

      {progress.audit.length > 0 && (
        <div className="border-t border-orbit-border-subtle p-5">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-orbit-text">
            <History size={15} aria-hidden="true" /> Progress changes by admins
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {progress.audit.map((a) => (
              <li key={a.id} className="text-orbit-text-secondary">
                <span className="text-orbit-text">{ACTION_LABEL[a.action] ?? a.action}</span>
                {a.node_id && stepTitle.get(a.node_id) && <> · “{stepTitle.get(a.node_id)}”</>}
                {a.action === "remark" && <> · {String(a.details.from)} → {String(a.details.to)} marks</>}
                {a.action === "curriculum_change" && (
                  <>
                    {" "}
                    · {String(a.details.from)} → {String(a.details.to)}
                    {Number(a.details.grants_removed) > 0 && <>, {String(a.details.grants_removed)} individual access settings removed</>}
                  </>
                )}
                {a.action === "reset_step" && typeof a.details.attempts_removed === "number" && <> · {a.details.attempts_removed} attempts removed</>}
                {a.reason && <> · “{a.reason}”</>}
                <span className="text-xs text-orbit-text-muted">
                  {" "}
                  — {a.profiles?.full_name ?? "Admin"}, {new Date(a.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
