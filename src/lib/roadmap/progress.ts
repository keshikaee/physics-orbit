import type { CompletionRule } from "@/types";

/*
 * Pure roadmap rules shared by the student viewer and the admin progress
 * screens. The database decides what is completed (and refuses locked
 * submissions); these helpers only explain the same state in the UI.
 */

export type StepState = "completed" | "in_progress" | "not_started" | "locked";

export interface StepInput {
  id: string;
  is_required: boolean;
  lock_until_prereqs: boolean;
  pos_x: number;
  pos_y: number;
}
export interface EdgeInput {
  source_id: string;
  target_id: string;
}

/**
 * Locked = the admin turned on prerequisite locking for this step and a
 * required step that points to it (and that the student can see) is not
 * completed yet. Mirrors public._node_locked.
 */
export function isLocked(step: StepInput, steps: Map<string, StepInput>, edges: EdgeInput[], completed: Set<string>) {
  if (!step.lock_until_prereqs) return false;
  return edges.some((e) => {
    if (e.target_id !== step.id) return false;
    const source = steps.get(e.source_id);
    return Boolean(source && source.is_required && !completed.has(source.id));
  });
}

export function stepStates(
  steps: StepInput[],
  edges: EdgeInput[],
  completed: Set<string>,
  started: Set<string>,
): Map<string, StepState> {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const out = new Map<string, StepState>();
  for (const s of steps) {
    if (completed.has(s.id)) out.set(s.id, "completed");
    else if (isLocked(s, byId, edges, completed)) out.set(s.id, "locked");
    else if (started.has(s.id)) out.set(s.id, "in_progress");
    else out.set(s.id, "not_started");
  }
  return out;
}

/** Required steps completed / required steps in total (optional steps don't count). */
export function progressOf(steps: Pick<StepInput, "id" | "is_required">[], completed: Set<string>) {
  const required = steps.filter((s) => s.is_required);
  return { done: required.filter((s) => completed.has(s.id)).length, total: required.length };
}

/**
 * Reading order for the list view: follow the arrows (topological order),
 * breaking ties left-to-right, then top-to-bottom. Cycles can't trap it —
 * anything left over is appended in position order.
 */
export function orderSteps<T extends StepInput>(steps: T[], edges: EdgeInput[]): T[] {
  const byPosition = (a: T, b: T) => a.pos_x - b.pos_x || a.pos_y - b.pos_y;
  const ids = new Set(steps.map((s) => s.id));
  const incoming = new Map(steps.map((s) => [s.id, 0]));
  const next = new Map<string, string[]>();
  for (const e of edges) {
    if (!ids.has(e.source_id) || !ids.has(e.target_id)) continue;
    incoming.set(e.target_id, (incoming.get(e.target_id) ?? 0) + 1);
    next.set(e.source_id, [...(next.get(e.source_id) ?? []), e.target_id]);
  }
  const byId = new Map(steps.map((s) => [s.id, s]));
  const ready = steps.filter((s) => incoming.get(s.id) === 0).sort(byPosition);
  const out: T[] = [];
  const seen = new Set<string>();
  while (ready.length) {
    const s = ready.shift()!;
    out.push(s);
    seen.add(s.id);
    for (const t of next.get(s.id) ?? []) {
      incoming.set(t, incoming.get(t)! - 1);
      if (incoming.get(t) === 0) {
        ready.push(byId.get(t)!);
        ready.sort(byPosition);
      }
    }
  }
  return [...out, ...steps.filter((s) => !seen.has(s.id)).sort(byPosition)];
}

/** Plain-language description of how a step is completed. */
export function ruleSummary(rule: CompletionRule, minQuizzes: number | null, requiredQuizzes: number) {
  switch (rule) {
    case "all_required":
      return requiredQuizzes === 0
        ? "Completes when its required quizzes are passed (none added yet)"
        : `Pass ${requiredQuizzes === 1 ? "the required quiz" : `all ${requiredQuizzes} required quizzes`}`;
    case "min_quizzes": {
      const n = minQuizzes ?? 1;
      return `Complete at least ${n} ${n === 1 ? "quiz" : "quizzes"}`;
    }
    case "student_mark":
      return "Student marks it as done";
    case "admin_confirm":
      return "An admin confirms completion";
  }
}
