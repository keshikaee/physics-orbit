import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStudents } from "@/lib/content/queries";
import type { ActivityEvent, AttemptRow, CompletionRow } from "./analytics";

/*
 * Admin reads for interaction analytics. RLS allows only staff to read
 * activity_events; quiz_attempts and node_completions are the existing
 * tables (read-only here). Callers must still requireAdmin() first.
 */

const EVENT_COLUMNS = "student_id, kind, unit_id, topic_id, material_id, quiz_id, title, created_at";
const ATTEMPT_COLUMNS = "id, student_id, quiz_id, attempt_no, status, score, max_score, passed, submitted_at, quizzes(title)";
const COMPLETION_COLUMNS = "student_id, node_id, source, completed_at, roadmap_nodes(title)";

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
async function fetchAll<T>(page: (from: number, to: number) => Page<T>, max = 50_000) {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; from < max; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(`Could not load activity: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return rows;
}

type RawAttempt = Omit<AttemptRow, "quiz_title"> & { quizzes: { title: string } | null };
type RawCompletion = Omit<CompletionRow, "node_title"> & { roadmap_nodes: { title: string } | null };
const toAttempt = ({ quizzes, ...a }: RawAttempt): AttemptRow => ({
  ...a,
  score: Number(a.score),
  max_score: Number(a.max_score),
  quiz_title: quizzes?.title ?? null,
});
const toCompletion = ({ roadmap_nodes, ...c }: RawCompletion): CompletionRow => ({ ...c, node_title: roadmap_nodes?.title ?? null });

interface Filter {
  studentId?: string;
  since?: Date;
}

async function loadEvents({ studentId, since }: Filter) {
  const supabase = await createClient();
  return fetchAll<ActivityEvent>((from, to) => {
    let q = supabase.from("activity_events").select(EVENT_COLUMNS);
    if (studentId) q = q.eq("student_id", studentId);
    if (since) q = q.gte("created_at", since.toISOString());
    return q.order("created_at", { ascending: false }).order("id").range(from, to) as unknown as Page<ActivityEvent>;
  });
}

async function loadAttempts({ studentId, since }: Filter) {
  const supabase = await createClient();
  const rows = await fetchAll<RawAttempt>((from, to) => {
    let q = supabase.from("quiz_attempts").select(ATTEMPT_COLUMNS);
    if (studentId) q = q.eq("student_id", studentId);
    if (since) q = q.gte("submitted_at", since.toISOString());
    return q.order("submitted_at", { ascending: false }).order("id").range(from, to) as unknown as Page<RawAttempt>;
  });
  return rows.map(toAttempt);
}

async function loadCompletions({ studentId, since }: Filter) {
  const supabase = await createClient();
  const rows = await fetchAll<RawCompletion>((from, to) => {
    let q = supabase.from("node_completions").select(COMPLETION_COLUMNS);
    if (studentId) q = q.eq("student_id", studentId);
    if (since) q = q.gte("completed_at", since.toISOString());
    return q.order("completed_at", { ascending: false }).order("node_id").range(from, to) as unknown as Page<RawCompletion>;
  });
  return rows.map(toCompletion);
}

/** Every recorded interaction of one student (newest first). */
export async function getStudentActivity(studentId: string) {
  const [events, attempts, completions] = await Promise.all([
    loadEvents({ studentId }),
    loadAttempts({ studentId }),
    loadCompletions({ studentId }),
  ]);
  return { events, attempts, completions };
}

export type StudentActivity = Awaited<ReturnType<typeof getStudentActivity>>;

/** Interactions since `since` for all students, or only one curriculum's. */
export async function getActivityAnalytics(since: Date, curriculumId?: string) {
  const [students, events, attempts, completions] = await Promise.all([
    getStudents(curriculumId),
    loadEvents({ since }),
    loadAttempts({ since }),
    loadCompletions({ since }),
  ]);
  // Keep only rows for the students in scope (cheaper than a huge IN list).
  const ids = new Set(students.map((s) => s.id));
  return {
    students,
    events: events.filter((e) => ids.has(e.student_id)),
    attempts: attempts.filter((a) => ids.has(a.student_id)),
    completions: completions.filter((c) => ids.has(c.student_id)),
  };
}
