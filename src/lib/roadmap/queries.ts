import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStudents, getUnitCurriculum } from "@/lib/content/queries";
import type {
  Material,
  NodeKind,
  Question,
  QuestionChoice,
  QuestionKey,
  Quiz,
  QuizAttempt,
  Roadmap,
  RoadmapEdge,
  RoadmapNode,
  Topic,
  Unit,
} from "@/types";

/*
 * Read helpers for roadmaps and quizzes. RLS decides visibility: students
 * get only published, permitted steps and quizzes (never answer keys);
 * admins get everything.
 */

type CountRel = { count: number }[] | null;
const countOf = (rel: CountRel) => rel?.[0]?.count ?? 0;
const byOrder = <T extends { order_index: number }>(a: T, b: T) => a.order_index - b.order_index;

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}: ${error?.message ?? "unknown error"}`);
}

export type QuizSummary = Pick<
  Quiz,
  "id" | "node_id" | "title" | "description" | "order_index" | "pass_percent" | "max_attempts" | "reveal" | "require_pass" | "is_required" | "is_published"
> & { question_count: number };

const QUIZ_COLUMNS =
  "id, node_id, title, description, order_index, pass_percent, max_attempts, reveal, require_pass, is_required, is_published, questions(count)";

function toQuizSummary(row: Record<string, unknown>): QuizSummary {
  const { questions, ...q } = row as QuizSummary & { questions: CountRel };
  return { ...q, question_count: countOf(questions) };
}

/* ─── Admin: roadmap editor ─── */

export type EditorTopic = Pick<Topic, "id" | "title" | "is_published" | "order_index"> & {
  materials: Pick<Material, "id" | "title" | "kind" | "is_published" | "order_index">[];
};

export async function getRoadmapEditor(unitId: string) {
  const supabase = await createClient();
  const { data: unit, error: unitError } = await supabase
    .from("units")
    .select("id, slug, code, title, is_published, topics(id, title, is_published, order_index, materials(id, title, kind, is_published, order_index))")
    .eq("id", unitId)
    .maybeSingle();
  if (unitError) fail("unit", unitError);
  if (!unit) return null;

  const { topics, ...unitRow } = unit as Pick<Unit, "id" | "slug" | "code" | "title" | "is_published"> & { topics: EditorTopic[] };
  topics.sort(byOrder);
  for (const t of topics) t.materials.sort(byOrder);

  const { data: roadmap, error: rmError } = await supabase.from("roadmaps").select("*").eq("unit_id", unitId).maybeSingle();
  if (rmError) fail("roadmap", rmError);

  const curriculum = await getUnitCurriculum(unitId);
  const students = curriculum ? await getStudents(curriculum.id) : [];
  if (!roadmap) {
    return { unit: unitRow, curriculum, topics, students, roadmap: null, nodes: [], edges: [], links: [], grants: [], quizzes: [], completions: {} as Record<string, number> };
  }

  const [nodes, edges, links, quizzes] = await Promise.all([
    supabase.from("roadmap_nodes").select("*").eq("roadmap_id", roadmap.id),
    supabase.from("roadmap_edges").select("source_id, target_id").eq("roadmap_id", roadmap.id),
    supabase.from("roadmap_node_materials").select("node_id, material_id, order_index, roadmap_nodes!inner(roadmap_id)").eq("roadmap_nodes.roadmap_id", roadmap.id),
    supabase.from("quizzes").select(`${QUIZ_COLUMNS}, roadmap_nodes!inner(roadmap_id)`).eq("roadmap_nodes.roadmap_id", roadmap.id),
  ]);
  if (nodes.error) fail("steps", nodes.error);
  if (edges.error) fail("connections", edges.error);
  if (links.error) fail("linked materials", links.error);
  if (quizzes.error) fail("quizzes", quizzes.error);

  const nodeIds = (nodes.data as RoadmapNode[]).map((n) => n.id);
  const [grants, completions] = nodeIds.length
    ? await Promise.all([
        supabase.from("content_grants").select("student_id, node_id").in("node_id", nodeIds),
        supabase.from("node_completions").select("node_id").in("node_id", nodeIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (grants.error) fail("step access", grants.error);
  if (completions.error) fail("completions", completions.error);

  const completionCounts: Record<string, number> = {};
  for (const c of completions.data as { node_id: string }[]) completionCounts[c.node_id] = (completionCounts[c.node_id] ?? 0) + 1;

  return {
    unit: unitRow,
    curriculum,
    topics,
    students,
    roadmap: roadmap as Roadmap,
    nodes: nodes.data as RoadmapNode[],
    edges: edges.data as RoadmapEdge[],
    links: (links.data as { node_id: string; material_id: string; order_index: number }[]).sort(byOrder),
    grants: grants.data as { student_id: string; node_id: string }[],
    quizzes: (quizzes.data as Record<string, unknown>[])
      .map((q) => {
        delete q.roadmap_nodes; // join used only for filtering
        return toQuizSummary(q);
      })
      .sort(byOrder),
    completions: completionCounts,
  };
}
export type RoadmapEditorData = NonNullable<Awaited<ReturnType<typeof getRoadmapEditor>>>;

/** Units with whether they have a roadmap — for the admin content screen. */
export async function getRoadmapIndex() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("roadmaps").select("unit_id, is_published, roadmap_nodes(count)");
  if (error) fail("roadmaps", error);
  return new Map(
    (data as { unit_id: string; is_published: boolean; roadmap_nodes: CountRel }[]).map((r) => [
      r.unit_id,
      { published: r.is_published, steps: countOf(r.roadmap_nodes) },
    ]),
  );
}

/** Roadmap steps that link a subtopic or material — for delete warnings. */
export async function getRoadmapReferences() {
  const supabase = await createClient();
  const [topics, materials] = await Promise.all([
    supabase.from("roadmap_nodes").select("topic_id, title").not("topic_id", "is", null),
    supabase.from("roadmap_node_materials").select("material_id, roadmap_nodes(title)"),
  ]);
  if (topics.error) fail("roadmap links", topics.error);
  if (materials.error) fail("roadmap links", materials.error);
  const refs: Record<string, string[]> = {};
  for (const r of topics.data as { topic_id: string; title: string }[]) (refs[r.topic_id] ??= []).push(r.title);
  for (const r of materials.data as unknown as { material_id: string; roadmap_nodes: { title: string } | null }[]) {
    if (r.roadmap_nodes) (refs[r.material_id] ??= []).push(r.roadmap_nodes.title);
  }
  return refs;
}

/* ─── Student: roadmap viewer ─── */

export type StudentStep = Pick<
  RoadmapNode,
  "id" | "kind" | "title" | "description" | "pos_x" | "pos_y" | "topic_id" | "is_required" | "completion_rule" | "min_quizzes" | "lock_until_prereqs"
>;
export type StepMaterial = Pick<Material, "id" | "title" | "kind"> & { topicSlug: string };
export type OwnAttempt = Pick<QuizAttempt, "id" | "quiz_id" | "attempt_no" | "status" | "score" | "max_score" | "passed" | "submitted_at">;
export type LockedStep = { id: string; kind: NodeKind; title: string; pos_x: number; pos_y: number };

export async function getStudentRoadmap(unitId: string, studentId: string) {
  const supabase = await createClient();
  const { data: roadmap, error } = await supabase
    .from("roadmaps")
    .select("id, restricted_display")
    .eq("unit_id", unitId)
    .maybeSingle();
  if (error) fail("roadmap", error);
  if (!roadmap) return null; // none, unpublished, or unit not visible (RLS)

  const [nodes, edges] = await Promise.all([
    supabase
      .from("roadmap_nodes")
      .select("id, kind, title, description, pos_x, pos_y, topic_id, is_required, completion_rule, min_quizzes, lock_until_prereqs")
      .eq("roadmap_id", roadmap.id),
    supabase.from("roadmap_edges").select("source_id, target_id").eq("roadmap_id", roadmap.id),
  ]);
  if (nodes.error) fail("steps", nodes.error);
  if (edges.error) fail("connections", edges.error);

  const steps = nodes.data as StudentStep[];
  const ids = steps.map((s) => s.id);
  const topicIds = [...new Set(steps.map((s) => s.topic_id).filter((t): t is string => Boolean(t)))];
  const none = { data: [], error: null };

  const [links, topics, quizzes, completions, locked, lockedEdges] = await Promise.all([
    ids.length
      ? supabase.from("roadmap_node_materials").select("node_id, order_index, materials(id, title, kind, topics(slug))").in("node_id", ids)
      : none,
    topicIds.length ? supabase.from("topics").select("id, slug, title").in("id", topicIds) : none,
    ids.length ? supabase.from("quizzes").select(QUIZ_COLUMNS).in("node_id", ids) : none,
    ids.length ? supabase.from("node_completions").select("node_id, source").eq("student_id", studentId).in("node_id", ids) : none,
    roadmap.restricted_display === "lock" ? supabase.rpc("roadmap_locked_steps", { p_roadmap: roadmap.id }) : none,
    roadmap.restricted_display === "lock" ? supabase.rpc("roadmap_locked_edges", { p_roadmap: roadmap.id }) : none,
  ]);
  for (const [what, r] of [["materials", links], ["subtopics", topics], ["quizzes", quizzes], ["progress", completions], ["locked steps", locked], ["connections", lockedEdges]] as const) {
    if (r.error) fail(what, r.error);
  }

  const quizRows = (quizzes.data as Record<string, unknown>[]).map(toQuizSummary).sort(byOrder);
  const attempts = quizRows.length
    ? await supabase
        .from("quiz_attempts")
        .select("id, quiz_id, attempt_no, status, score, max_score, passed, submitted_at")
        .eq("student_id", studentId)
        .in("quiz_id", quizRows.map((q) => q.id))
        .order("submitted_at", { ascending: false })
    : none;
  if (attempts.error) fail("attempts", attempts.error);

  const materialsByStep: Record<string, StepMaterial[]> = {};
  for (const l of (links.data as unknown as {
    node_id: string;
    order_index: number;
    materials: (Pick<Material, "id" | "title" | "kind"> & { topics: { slug: string } | null }) | null;
  }[]).sort(byOrder)) {
    if (!l.materials?.topics) continue; // material hidden by RLS
    (materialsByStep[l.node_id] ??= []).push({ id: l.materials.id, title: l.materials.title, kind: l.materials.kind, topicSlug: l.materials.topics.slug });
  }

  return {
    roadmapId: roadmap.id as string,
    steps,
    edges: [...(edges.data as RoadmapEdge[]), ...(lockedEdges.data as RoadmapEdge[])],
    lockedSteps: locked.data as LockedStep[],
    topics: Object.fromEntries((topics.data as Pick<Topic, "id" | "slug" | "title">[]).map((t) => [t.id, t])),
    materialsByStep,
    quizzes: quizRows,
    attempts: attempts.data as OwnAttempt[],
    completed: (completions.data as { node_id: string }[]).map((c) => c.node_id),
    /** Steps the student ticked themselves (only those can be un-ticked). */
    selfMarked: (completions.data as { node_id: string; source: string }[]).filter((c) => c.source === "student").map((c) => c.node_id),
  };
}
export type StudentRoadmapData = NonNullable<Awaited<ReturnType<typeof getStudentRoadmap>>>;

/** Required steps completed per unit, for the course cards. Only counts what the student can see. */
export async function getUnitProgress(studentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("roadmaps").select("unit_id, roadmap_nodes(id, is_required)");
  if (error) fail("progress", error);
  const rows = data as { unit_id: string; roadmap_nodes: { id: string; is_required: boolean }[] }[];
  const ids = rows.flatMap((r) => r.roadmap_nodes.map((n) => n.id));
  const { data: done, error: doneError } = ids.length
    ? await supabase.from("node_completions").select("node_id").eq("student_id", studentId).in("node_id", ids)
    : { data: [], error: null };
  if (doneError) fail("progress", doneError);
  const completed = new Set((done as { node_id: string }[]).map((d) => d.node_id));
  const out: Record<string, { done: number; total: number }> = {};
  for (const r of rows) {
    const required = r.roadmap_nodes.filter((n) => n.is_required);
    if (required.length) out[r.unit_id] = { done: required.filter((n) => completed.has(n.id)).length, total: required.length };
  }
  return out;
}

/* ─── Student: taking a quiz ─── */

export type QuizQuestion = Pick<Question, "id" | "kind" | "prompt" | "image_path" | "marks" | "order_index"> & {
  choices: Pick<QuestionChoice, "id" | "label" | "order_index">[];
};

export async function getQuizForStudent(quizId: string, studentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select(
      "id, node_id, title, description, pass_percent, max_attempts, reveal, require_pass, is_required, " +
        "questions(id, kind, prompt, image_path, marks, order_index, question_choices(id, label, order_index)), " +
        "roadmap_nodes!inner(id, title, lock_until_prereqs, roadmaps!inner(unit_id, units!inner(slug, code, title)))",
    )
    .eq("id", quizId)
    .maybeSingle();
  if (error) fail("quiz", error);
  if (!data) return null; // missing, unpublished, or not permitted (RLS)

  const row = data as unknown as Pick<Quiz, "id" | "node_id" | "title" | "description" | "pass_percent" | "max_attempts" | "reveal" | "require_pass" | "is_required"> & {
    questions: (Omit<QuizQuestion, "choices"> & { question_choices: QuizQuestion["choices"] })[];
    roadmap_nodes: { id: string; title: string; lock_until_prereqs: boolean; roadmaps: { unit_id: string; units: Pick<Unit, "slug" | "code" | "title"> } };
  };
  const { questions, roadmap_nodes: step, ...quiz } = row;

  // Prerequisite lock (the database enforces it again on submit).
  let locked = false;
  if (step.lock_until_prereqs) {
    const { data: incoming, error: inError } = await supabase
      .from("roadmap_edges")
      .select("source_id, roadmap_nodes!roadmap_edges_source_id_fkey(is_required)")
      .eq("target_id", step.id);
    if (inError) fail("prerequisites", inError);
    const required = (incoming as unknown as { source_id: string; roadmap_nodes: { is_required: boolean } | null }[])
      .filter((e) => e.roadmap_nodes?.is_required)
      .map((e) => e.source_id);
    if (required.length) {
      const { data: done } = await supabase.from("node_completions").select("node_id").eq("student_id", studentId).in("node_id", required);
      locked = (done ?? []).length < required.length;
    }
  }

  const { data: attempts, error: aError } = await supabase
    .from("quiz_attempts")
    .select("id, quiz_id, attempt_no, status, score, max_score, passed, submitted_at")
    .eq("quiz_id", quizId)
    .eq("student_id", studentId)
    .order("attempt_no", { ascending: false });
  if (aError) fail("attempts", aError);

  return {
    quiz,
    step: { id: step.id, title: step.title },
    unit: step.roadmaps.units,
    locked,
    questions: questions
      .sort(byOrder)
      .map(({ question_choices, ...q }) => ({ ...q, choices: question_choices.sort(byOrder) })) as QuizQuestion[],
    attempts: attempts as OwnAttempt[],
  };
}

/* ─── Reviews (student own / admin any) ─── */

export interface ReviewResponse {
  id: string;
  question_id: string | null;
  kind: Question["kind"];
  prompt: string;
  marks_available: number;
  answer: { choices?: string[]; text?: string; value?: number | null; unit?: string; raw?: string };
  awarded_marks: number | null;
  feedback: string;
  image: boolean;
  choices: { id: string; label: string }[];
  key: null | {
    correct_choice_ids: string[];
    numeric_answer: number | null;
    tolerance: number;
    tolerance_kind: QuestionKey["tolerance_kind"];
    units: string[];
    accepted_answers: string[];
    model_answer: string;
    explanation: string;
  };
}
export interface AttemptReview {
  attempt: QuizAttempt;
  quiz: { id: string; title: string; pass_percent: number; reveal: Quiz["reveal"]; node_id: string };
  revealed: boolean;
  responses: ReviewResponse[];
}

export async function getAttemptReview(attemptId: string): Promise<AttemptReview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attempt_review", { p_attempt: attemptId });
  if (error) fail("attempt", error);
  return (data as AttemptReview | null) ?? null;
}

/* ─── Admin: quiz editor ─── */

export async function getQuizEditor(quizId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select(
      "*, questions(*, question_choices(*), question_keys(*)), roadmap_nodes!inner(id, title, roadmaps!inner(unit_id, units!inner(id, code, title)))",
    )
    .eq("id", quizId)
    .maybeSingle();
  if (error) fail("quiz", error);
  if (!data) return null;
  const { questions, roadmap_nodes: step, ...quiz } = data as Quiz & {
    questions: (Question & { question_choices: QuestionChoice[]; question_keys: QuestionKey | QuestionKey[] | null })[];
    roadmap_nodes: { id: string; title: string; roadmaps: { unit_id: string; units: Pick<Unit, "id" | "code" | "title"> } };
  };
  const { count: attempts } = await supabase.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("quiz_id", quizId);
  return {
    quiz: quiz as Quiz,
    step: { id: step.id, title: step.title },
    unit: step.roadmaps.units,
    attempts: attempts ?? 0,
    questions: questions.sort(byOrder).map(({ question_choices, question_keys, ...q }) => ({
      ...q,
      choices: question_choices.sort(byOrder),
      key: (Array.isArray(question_keys) ? question_keys[0] : question_keys) ?? null,
    })),
  };
}
export type QuizEditorData = NonNullable<Awaited<ReturnType<typeof getQuizEditor>>>;

/* ─── Admin: progress monitoring ─── */

export async function getStudentProgress(studentId: string) {
  const supabase = await createClient();
  const [roadmaps, attempts, completions, audit] = await Promise.all([
    supabase
      .from("roadmaps")
      .select(
        "id, unit_id, is_published, roadmap_nodes(id, kind, title, pos_x, pos_y, topic_id, is_required, completion_rule, min_quizzes, lock_until_prereqs, access_mode, roadmap_node_materials(material_id)), roadmap_edges(source_id, target_id)",
      ),
    supabase
      .from("quiz_attempts")
      .select("id, quiz_id, attempt_no, status, score, max_score, passed, submitted_at")
      .eq("student_id", studentId)
      .order("submitted_at", { ascending: false }),
    supabase.from("node_completions").select("node_id, source, completed_at").eq("student_id", studentId),
    supabase
      .from("progress_audit")
      .select("id, action, node_id, details, reason, created_at, profiles!progress_audit_admin_id_fkey(full_name)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  for (const [what, r] of [["roadmaps", roadmaps], ["attempts", attempts], ["completions", completions], ["audit log", audit]] as const) {
    if (r.error) fail(what, r.error);
  }

  const nodeIds = (roadmaps.data as { roadmap_nodes: { id: string }[] }[]).flatMap((r) => r.roadmap_nodes.map((n) => n.id));
  const quizzes = nodeIds.length ? await supabase.from("quizzes").select(QUIZ_COLUMNS).in("node_id", nodeIds) : { data: [], error: null };
  if (quizzes.error) fail("quizzes", quizzes.error);

  return {
    roadmaps: roadmaps.data as unknown as (Pick<Roadmap, "id" | "unit_id" | "is_published"> & {
      roadmap_nodes: (Pick<RoadmapNode, "id" | "kind" | "title" | "pos_x" | "pos_y" | "topic_id" | "is_required" | "completion_rule" | "min_quizzes" | "lock_until_prereqs" | "access_mode"> & {
        roadmap_node_materials: { material_id: string }[];
      })[];
      roadmap_edges: RoadmapEdge[];
    })[],
    quizzes: (quizzes.data as Record<string, unknown>[]).map(toQuizSummary).sort(byOrder),
    attempts: attempts.data as OwnAttempt[],
    completions: completions.data as { node_id: string; source: string; completed_at: string }[],
    audit: audit.data as unknown as {
      id: string;
      action: string;
      node_id: string | null;
      details: Record<string, unknown>;
      reason: string;
      created_at: string;
      profiles: { full_name: string } | null;
    }[],
  };
}

/** Attempts with answers waiting for a human mark. */
export async function getMarkingQueue() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select(
      "id, attempt_no, submitted_at, score, max_score, student_id, profiles!quiz_attempts_student_id_fkey(full_name, email), quizzes(title, roadmap_nodes(title, roadmaps(units(code, title))))",
    )
    .eq("status", "awaiting_marking")
    .order("submitted_at");
  if (error) fail("marking queue", error);
  return data as unknown as {
    id: string;
    attempt_no: number;
    submitted_at: string;
    score: number;
    max_score: number;
    student_id: string;
    profiles: { full_name: string; email: string } | null;
    quizzes: { title: string; roadmap_nodes: { title: string; roadmaps: { units: { code: string; title: string } } } } | null;
  }[];
}

export async function countAwaitingMarking() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("status", "awaiting_marking");
  if (error) fail("marking queue", error);
  return count ?? 0;
}
