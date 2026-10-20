"use client";

import "@xyflow/react/dist/style.css";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { Background, Controls, MarkerType, ReactFlow, ReactFlowProvider, type Edge } from "@xyflow/react";
import { CheckCircle2, ChevronRight, Circle, CircleDot, LayoutList, Loader2, Lock, Network, PlayCircle } from "lucide-react";
import type { StudentRoadmapData } from "@/lib/roadmap/queries";
import { orderSteps, progressOf, ruleSummary, stepStates, type StepState } from "@/lib/roadmap/progress";
import { setStepDoneAction } from "@/lib/roadmap/student-actions";
import { MATERIAL_ICONS } from "@/components/admin/material-icons";
import { cn } from "@/lib/utils";
import { stepNodeTypes, type StepCardNode } from "./step-card";
import { STATE_LABEL, STEP_KIND } from "./step-meta";

/* Read-only roadmap for one student: their own progress, only steps they may see. */

const EDGE_COLOR = "#9fb8a8";
const edgeStyle = {
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR, width: 18, height: 18 },
  style: { stroke: EDGE_COLOR, strokeWidth: 1.5 },
  selectable: false,
  focusable: false,
};

function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 768px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true,
  );
}

export function StudentRoadmap({ data, unitSlug }: { data: StudentRoadmapData; unitSlug: string }) {
  const wide = useWide();
  const [choice, setChoice] = useState<"diagram" | "list" | null>(null);
  const view = choice ?? (wide ? "diagram" : "list");
  const [selected, setSelected] = useState<string | null>(null);

  const completed = useMemo(() => new Set(data.completed), [data.completed]);
  const quizzesByStep = useMemo(() => {
    const m = new Map<string, StudentRoadmapData["quizzes"]>();
    for (const q of data.quizzes) m.set(q.node_id, [...(m.get(q.node_id) ?? []), q]);
    return m;
  }, [data.quizzes]);
  const attemptsByQuiz = useMemo(() => {
    const m = new Map<string, StudentRoadmapData["attempts"]>();
    for (const a of data.attempts) m.set(a.quiz_id, [...(m.get(a.quiz_id) ?? []), a]);
    return m;
  }, [data.attempts]);
  const started = useMemo(
    () => new Set(data.steps.filter((s) => (quizzesByStep.get(s.id) ?? []).some((q) => attemptsByQuiz.has(q.id))).map((s) => s.id)),
    [data.steps, quizzesByStep, attemptsByQuiz],
  );
  const states = useMemo(() => stepStates(data.steps, data.edges, completed, started), [data.steps, data.edges, completed, started]);
  const progress = progressOf(data.steps, completed);
  const lockedIds = useMemo(() => new Set(data.lockedSteps.map((s) => s.id)), [data.lockedSteps]);
  const titleOf = useMemo(() => new Map([...data.steps, ...data.lockedSteps].map((s) => [s.id, s.title])), [data.steps, data.lockedSteps]);

  const nodes: StepCardNode[] = useMemo(
    () => [
      ...data.steps.map((s) => ({
        id: s.id,
        type: "step" as const,
        position: { x: s.pos_x, y: s.pos_y },
        selected: s.id === selected,
        data: { kind: s.kind, title: s.title, state: states.get(s.id), optional: !s.is_required },
      })),
      ...data.lockedSteps.map((s) => ({
        id: s.id,
        type: "step" as const,
        position: { x: s.pos_x, y: s.pos_y },
        selected: s.id === selected,
        data: { kind: s.kind, title: s.title, state: "locked" as StepState, restricted: true },
      })),
    ],
    [data.steps, data.lockedSteps, states, selected],
  );
  const edges: Edge[] = useMemo(
    () => data.edges.map((e) => ({ id: `${e.source_id}>${e.target_id}`, source: e.source_id, target: e.target_id, ...edgeStyle })),
    [data.edges],
  );

  const ordered = useMemo(
    () => orderSteps([...data.steps, ...data.lockedSteps.map((s) => ({ ...s, is_required: false, lock_until_prereqs: false }))], data.edges),
    [data.steps, data.lockedSteps, data.edges],
  );

  const detail = (id: string, inList = false) => {
    const step = data.steps.find((s) => s.id === id);
    if (!step) {
      return (
        <div className="space-y-2">
          <StepHeading kind={data.lockedSteps.find((s) => s.id === id)?.kind ?? "lesson"} title={titleOf.get(id) ?? ""} state="locked" />
          <p className="text-sm text-orbit-text-secondary">You don&apos;t have access to this step. Ask your teacher if you think you should.</p>
        </div>
      );
    }
    const state = states.get(id)!;
    const waitingOn = data.edges
      .filter((e) => e.target_id === id)
      .map((e) => data.steps.find((s) => s.id === e.source_id))
      .filter((s) => s && s.is_required && !completed.has(s.id))
      .map((s) => s!.title);
    return (
      <StepDetail
        step={step}
        state={state}
        unitSlug={unitSlug}
        topic={step.topic_id ? data.topics[step.topic_id] : undefined}
        materials={data.materialsByStep[id] ?? []}
        quizzes={quizzesByStep.get(id) ?? []}
        attemptsByQuiz={attemptsByQuiz}
        waitingOn={state === "locked" ? waitingOn : []}
        selfMarked={data.selfMarked.includes(id)}
        inList={inList}
      />
    );
  };

  return (
    <section aria-labelledby="roadmap-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="roadmap-heading" className="text-xl font-semibold text-orbit-text">
            Roadmap
          </h2>
          {progress.total > 0 && (
            <p className="mt-1 text-sm text-orbit-text-secondary">
              {progress.done} of {progress.total} required {progress.total === 1 ? "step" : "steps"} complete
            </p>
          )}
        </div>
        <div className="inline-flex rounded-xl border border-orbit-border bg-white p-1" role="group" aria-label="Roadmap view">
          {(
            [
              ["diagram", "Diagram", Network],
              ["list", "List", LayoutList],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setChoice(v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
                view === v ? "bg-orbit-panel-hover text-orbit-primary-hover" : "text-orbit-text-secondary hover:text-orbit-text",
              )}
            >
              <Icon size={15} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </div>

      {progress.total > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-orbit-panel-hover" aria-hidden="true">
          <div className="h-full rounded-full bg-orbit-primary transition-[width] duration-700" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
        </div>
      )}

      {data.steps.length + data.lockedSteps.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-orbit-border bg-white p-6 text-center text-sm text-orbit-text-muted">
          No roadmap steps are shared with you yet.
        </p>
      ) : view === "diagram" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="roadmap-canvas relative h-[56vh] min-h-[380px] overflow-hidden rounded-2xl border border-orbit-border bg-orbit-canvas">
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={stepNodeTypes}
                onNodeClick={(_, n) => setSelected(n.id)}
                onPaneClick={() => setSelected(null)}
                nodesDraggable={false}
                nodesConnectable={false}
                edgesFocusable={false}
                elementsSelectable
                zoomOnScroll={false}
                preventScrolling={false}
                fitView
                fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                minZoom={0.2}
                maxZoom={2}
              >
                <Background gap={20} size={1} color="#dfe8e2" />
                <Controls showInteractive={false} position="bottom-left" />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
          <aside className="rounded-2xl border border-orbit-border bg-white p-4 shadow-[var(--shadow-card)] lg:max-h-[56vh] lg:overflow-y-auto" aria-live="polite">
            {selected ? (
              detail(selected)
            ) : (
              <div className="space-y-3 text-sm text-orbit-text-secondary">
                <p className="font-medium text-orbit-text">Select a step to open it.</p>
                <p>Steps turn green when you complete their tasks. Drag to move around; use the buttons to zoom.</p>
                <ul className="space-y-1.5 text-xs">
                  <StateKey state="not_started" />
                  <StateKey state="in_progress" />
                  <StateKey state="completed" />
                  <StateKey state="locked" />
                </ul>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <ol className="space-y-2.5">
          {ordered.map((s, i) => {
            const state = lockedIds.has(s.id) ? "locked" : states.get(s.id)!;
            const open = selected === s.id;
            return (
              <li key={s.id} className={cn("overflow-hidden rounded-2xl border bg-white transition-colors duration-500", state === "completed" ? "border-orbit-primary/60" : "border-orbit-border")}>
                <button
                  type="button"
                  onClick={() => setSelected(open ? null : s.id)}
                  aria-expanded={open}
                  className={cn("flex w-full items-center gap-3 p-4 text-left", state === "completed" && "bg-orbit-panel-hover/60")}
                >
                  <StateIcon state={state} index={i + 1} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-orbit-primary-text">{STEP_KIND[s.kind].label}</span>
                    <span className={cn("block font-semibold", state === "locked" ? "text-orbit-text-muted" : "text-orbit-text")}>{s.title}</span>
                    <span className="block text-xs text-orbit-text-secondary">{lockedIds.has(s.id) ? "No access" : STATE_LABEL[state]}</span>
                  </span>
                  <ChevronRight size={18} className={cn("shrink-0 text-orbit-text-muted transition-transform", open && "rotate-90")} aria-hidden="true" />
                </button>
                {open && <div className="border-t border-orbit-border-subtle p-4">{detail(s.id, true)}</div>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function StateKey({ state }: { state: StepState }) {
  return (
    <li className="flex items-center gap-2">
      <StateIcon state={state} small /> {STATE_LABEL[state]}
    </li>
  );
}

function StateIcon({ state, index, small }: { state: StepState; index?: number; small?: boolean }) {
  const size = small ? 15 : 20;
  const box = small ? "h-5 w-5" : "h-9 w-9";
  if (state === "completed")
    return (
      <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-orbit-primary text-white", box)}>
        <CheckCircle2 size={size - 3} strokeWidth={2.25} aria-hidden="true" />
      </span>
    );
  if (state === "locked")
    return (
      <span className={cn("flex shrink-0 items-center justify-center rounded-full border border-dashed border-orbit-border bg-orbit-canvas text-orbit-text-muted", box)}>
        <Lock size={size - 6} aria-hidden="true" />
      </span>
    );
  if (state === "in_progress")
    return (
      <span className={cn("flex shrink-0 items-center justify-center rounded-full border border-[#b9d9c4] bg-orbit-panel text-orbit-primary", box)}>
        <CircleDot size={size - 4} aria-hidden="true" />
      </span>
    );
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full border border-orbit-border bg-white text-sm font-semibold text-orbit-text-secondary", box)}>
      {index ?? <Circle size={size - 6} aria-hidden="true" />}
    </span>
  );
}

function StepHeading({ kind, title, state }: { kind: keyof typeof STEP_KIND; title: string; state: StepState }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-orbit-primary-text">{STEP_KIND[kind].label}</p>
      <h3 className="mt-0.5 text-lg font-semibold text-orbit-text">{title}</h3>
      <p className={cn("mt-1 inline-flex items-center gap-1.5 text-sm", state === "completed" ? "font-medium text-orbit-primary-hover" : "text-orbit-text-secondary")}>
        <StateIcon state={state} small /> {STATE_LABEL[state]}
      </p>
    </div>
  );
}

function quizStatus(q: StudentRoadmapData["quizzes"][number], attempts: StudentRoadmapData["attempts"]) {
  if (!attempts.length) return { text: "Not attempted", tone: "muted" as const };
  if (attempts.some((a) => a.passed)) {
    const best = attempts.filter((a) => a.passed).sort((a, b) => Number(b.score) - Number(a.score))[0]!;
    return { text: `Passed · ${Number(best.score)}/${Number(best.max_score)}`, tone: "good" as const };
  }
  if (attempts.some((a) => a.status === "awaiting_marking")) return { text: "Waiting for your teacher to mark", tone: "muted" as const };
  if (!q.require_pass) return { text: "Submitted", tone: "good" as const };
  const best = [...attempts].sort((a, b) => Number(b.score) - Number(a.score))[0]!;
  return { text: `Not passed yet · best ${Number(best.score)}/${Number(best.max_score)} (pass ${q.pass_percent}%)`, tone: "warn" as const };
}

function StepDetail({
  step,
  state,
  unitSlug,
  topic,
  materials,
  quizzes,
  attemptsByQuiz,
  waitingOn,
  selfMarked,
  inList,
}: {
  selfMarked: boolean;
  inList: boolean;
  step: StudentRoadmapData["steps"][number];
  state: StepState;
  unitSlug: string;
  topic?: { id: string; slug: string; title: string };
  materials: StudentRoadmapData["materialsByStep"][string];
  quizzes: StudentRoadmapData["quizzes"];
  attemptsByQuiz: Map<string, StudentRoadmapData["attempts"]>;
  waitingOn: string[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const locked = state === "locked";
  const requiredQuizzes = quizzes.filter((q) => q.is_required).length;

  return (
    <div className="space-y-4">
      {!inList && <StepHeading kind={step.kind} title={step.title} state={state} />}
      {step.description && <p className="text-sm leading-relaxed text-orbit-text-secondary">{step.description}</p>}

      {locked && (
        <p className="flex gap-2 rounded-xl border border-orbit-border bg-orbit-canvas p-3 text-sm text-orbit-text-secondary">
          <Lock size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>Complete {waitingOn.length ? waitingOn.map((t) => `“${t}”`).join(", ") : "the earlier steps"} first.</span>
        </p>
      )}

      {(topic || materials.length > 0) && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-orbit-text-muted">Learn</p>
          {topic && (
            <Link href={`/courses/${unitSlug}/${topic.slug}`} className="flex items-center gap-2 rounded-xl border border-orbit-border px-3 py-2.5 text-sm font-medium text-orbit-text hover:bg-orbit-panel">
              <span className="min-w-0 flex-1 truncate">Open “{topic.title}”</span>
              <ChevronRight size={15} className="text-orbit-text-muted" aria-hidden="true" />
            </Link>
          )}
          {materials.map((m) => {
            const Icon = MATERIAL_ICONS[m.kind].icon;
            return (
              <Link key={m.id} href={`/courses/${unitSlug}/${m.topicSlug}/${m.id}`} className="flex items-center gap-2 rounded-xl border border-orbit-border px-3 py-2.5 text-sm text-orbit-text hover:bg-orbit-panel">
                <Icon size={15} className="shrink-0 text-orbit-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{m.title}</span>
                <ChevronRight size={15} className="text-orbit-text-muted" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      )}

      {quizzes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-orbit-text-muted">Tasks</p>
          {quizzes.map((q) => {
            const attempts = attemptsByQuiz.get(q.id) ?? [];
            const status = quizStatus(q, attempts);
            const left = q.max_attempts === null ? null : q.max_attempts - attempts.length;
            const canStart = !locked && (left === null || left > 0) && q.question_count > 0;
            return (
              <div key={q.id} className="rounded-xl border border-orbit-border p-3">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-sm font-medium text-orbit-text">
                    {q.title}
                    {!q.is_required && <span className="font-normal text-orbit-text-muted"> · optional</span>}
                  </p>
                </div>
                <p className={cn("mt-0.5 text-xs", status.tone === "good" ? "font-medium text-orbit-primary-hover" : status.tone === "warn" ? "text-orbit-warning" : "text-orbit-text-secondary")}>
                  {status.text}
                </p>
                <p className="mt-0.5 text-xs text-orbit-text-muted">
                  {q.question_count} {q.question_count === 1 ? "question" : "questions"} · pass {q.pass_percent}% ·{" "}
                  {left === null ? "unlimited attempts" : `${attempts.length} of ${q.max_attempts} ${q.max_attempts === 1 ? "attempt" : "attempts"} used`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {canStart && (
                    <Link href={`/quizzes/${q.id}`} className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium">
                      <PlayCircle size={14} aria-hidden="true" /> {attempts.length ? "Try again" : "Start quiz"}
                    </Link>
                  )}
                  {attempts[0] && (
                    <Link href={`/quizzes/${q.id}/attempts/${attempts[0].id}`} className="btn-secondary inline-flex items-center rounded-lg px-3 py-2 text-xs font-medium">
                      View latest result
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl bg-orbit-canvas p-3 text-xs text-orbit-text-secondary">
        <p>
          <span className="font-medium text-orbit-text">To complete:</span> {ruleSummary(step.completion_rule, step.min_quizzes, requiredQuizzes)}.
        </p>
        {step.completion_rule === "admin_confirm" && state !== "completed" && <p className="mt-1">Your teacher marks this step complete when you&apos;ve done it.</p>}
      </div>

      {step.completion_rule === "student_mark" && !locked && (state !== "completed" || selfMarked) && (
        <div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await setStepDoneAction(step.id, state !== "completed");
                if (!r.ok) setError(r.message ?? "Could not update.");
              })
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-60",
              state === "completed" ? "btn-secondary" : "btn-primary",
            )}
          >
            {pending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
            {state === "completed" ? "Mark as not done" : "Mark as done"}
          </button>
          {error && <p className="mt-1.5 text-sm text-orbit-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
