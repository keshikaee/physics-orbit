/*
 * Pure helpers for student interaction analytics. No database access here,
 * so every number shown on the admin analytics screens is unit-tested.
 *
 * Interactions come from three sources:
 *   - activity_events  (sign-ins, page visits, material/quiz opens)
 *   - quiz_attempts    (submissions, with scores)
 *   - node_completions (roadmap steps completed)
 */

export const ACTIVITY_KINDS = [
  "sign_in",
  "dashboard_view",
  "courses_view",
  "unit_view",
  "topic_view",
  "material_view",
  "quiz_view",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** Pages that log a visit with no target. */
export const UNTARGETED_KINDS = ["dashboard_view", "courses_view"] as const;
/** Pages that log a visit to one item (unit, subtopic, material, quiz). */
export const TARGETED_KINDS = ["unit_view", "topic_view", "material_view", "quiz_view"] as const;

export interface ActivityEvent {
  student_id: string;
  kind: ActivityKind;
  unit_id: string | null;
  topic_id: string | null;
  material_id: string | null;
  quiz_id: string | null;
  title: string;
  created_at: string;
}

export interface AttemptRow {
  id: string;
  student_id: string;
  quiz_id: string;
  attempt_no: number;
  status: "awaiting_marking" | "marked";
  score: number;
  max_score: number;
  passed: boolean | null;
  submitted_at: string;
  quiz_title: string | null;
}

export interface CompletionRow {
  student_id: string;
  node_id: string;
  source: "auto" | "student" | "admin";
  completed_at: string;
  node_title: string | null;
}

/* ─── Time ─── */

/** Day buckets follow the class's local time, not the server's (UTC on Vercel). */
export const ANALYTICS_TIME_ZONE = "Asia/Colombo";

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: ANALYTICS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" of an instant in the class time zone. */
export function dayKey(at: string | Date): string {
  return dayFormat.format(typeof at === "string" ? new Date(at) : at);
}

/** The last `days` day keys, oldest first, ending today. */
export function lastDays(days: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  // Step back from midday of today (in the class zone) so DST-free noon arithmetic never skips a day.
  const [y, m, d] = dayKey(now).split("-").map(Number);
  const noon = Date.UTC(y!, m! - 1, d!, 12);
  for (let i = days - 1; i >= 0; i--) keys.push(new Date(noon - i * 86_400_000).toISOString().slice(0, 10));
  return keys;
}

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];
export function parsePeriod(value: unknown): Period {
  const n = Number(value);
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 30;
}

/** Start instant of a period: midnight (class zone) at the start of its first day. */
export function periodStart(days: number, now: Date = new Date()): Date {
  const first = lastDays(days, now)[0]!;
  // Asia/Colombo is UTC+05:30 all year (no DST).
  return new Date(`${first}T00:00:00+05:30`);
}

/* ─── Aggregation ─── */

export interface DailyPoint {
  day: string;
  interactions: number;
  students: number;
}

/** Interactions and distinct active students per day, for each of `days` days (oldest first). */
export function dailySeries(
  events: Pick<ActivityEvent, "student_id" | "created_at">[],
  attempts: Pick<AttemptRow, "student_id" | "submitted_at">[],
  completions: Pick<CompletionRow, "student_id" | "completed_at">[],
  days: number,
  now: Date = new Date(),
): DailyPoint[] {
  const keys = lastDays(days, now);
  const counts = new Map(keys.map((k) => [k, { n: 0, who: new Set<string>() }]));
  const add = (student: string, at: string) => {
    const slot = counts.get(dayKey(at));
    if (!slot) return;
    slot.n++;
    slot.who.add(student);
  };
  for (const e of events) add(e.student_id, e.created_at);
  for (const a of attempts) add(a.student_id, a.submitted_at);
  for (const c of completions) add(c.student_id, c.completed_at);
  return keys.map((day) => ({ day, interactions: counts.get(day)!.n, students: counts.get(day)!.who.size }));
}

export interface StudentStats {
  lastActive: string | null;
  activeDays: number;
  interactions: number;
  signIns: number;
  materialsOpened: number; // distinct materials
  materialViews: number;
  quizAttempts: number;
  quizzesPassed: number; // distinct quizzes with a passed attempt
  /** Mean percentage over marked attempts with marks available; null when none. */
  averageScore: number | null;
  awaitingMarking: number;
  stepsCompleted: number;
}

const pct = (a: Pick<AttemptRow, "score" | "max_score">) => (Number(a.score) / Number(a.max_score)) * 100;

/** One student's summary. Pass only that student's rows (already limited to the period, if any). */
export function studentStats(events: ActivityEvent[], attempts: AttemptRow[], completions: CompletionRow[]): StudentStats {
  let last: string | null = null;
  const days = new Set<string>();
  const touch = (at: string) => {
    if (!last || at > last) last = at;
    days.add(dayKey(at));
  };
  const materials = new Set<string>();
  let signIns = 0;
  let materialViews = 0;
  for (const e of events) {
    touch(e.created_at);
    if (e.kind === "sign_in") signIns++;
    if (e.kind === "material_view") {
      materialViews++;
      if (e.material_id) materials.add(e.material_id);
    }
  }
  const passed = new Set<string>();
  let scored = 0;
  let total = 0;
  let awaiting = 0;
  for (const a of attempts) {
    touch(a.submitted_at);
    if (a.passed) passed.add(a.quiz_id);
    if (a.status === "awaiting_marking") awaiting++;
    else if (Number(a.max_score) > 0) {
      scored++;
      total += pct(a);
    }
  }
  for (const c of completions) touch(c.completed_at);

  return {
    lastActive: last,
    activeDays: days.size,
    interactions: events.length + attempts.length + completions.length,
    signIns,
    materialsOpened: materials.size,
    materialViews,
    quizAttempts: attempts.length,
    quizzesPassed: passed.size,
    averageScore: scored ? Math.round((total / scored) * 10) / 10 : null,
    awaitingMarking: awaiting,
    stepsCompleted: completions.length,
  };
}

/** Rows grouped by student id. */
export function byStudent<T extends { student_id: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const list = m.get(r.student_id);
    if (list) list.push(r);
    else m.set(r.student_id, [r]);
  }
  return m;
}

export interface TopItem {
  id: string;
  title: string;
  views: number;
  students: number;
}

/** Most-opened materials (by distinct students, then views). Uses the latest title seen. */
export function topMaterials(events: ActivityEvent[], limit = 8): TopItem[] {
  const m = new Map<string, { title: string; at: string; views: number; who: Set<string> }>();
  for (const e of events) {
    if (e.kind !== "material_view" || !e.material_id) continue;
    const item = m.get(e.material_id) ?? { title: e.title, at: e.created_at, views: 0, who: new Set<string>() };
    if (e.created_at >= item.at) {
      item.title = e.title;
      item.at = e.created_at;
    }
    item.views++;
    item.who.add(e.student_id);
    m.set(e.material_id, item);
  }
  return [...m.entries()]
    .map(([id, v]) => ({ id, title: v.title || "Untitled material", views: v.views, students: v.who.size }))
    .sort((a, b) => b.students - a.students || b.views - a.views || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** Interaction counts by type for the period (quiz submissions and step completions included). */
export function kindBreakdown(events: ActivityEvent[], attempts: number, completions: number) {
  const counts = Object.fromEntries(ACTIVITY_KINDS.map((k) => [k, 0])) as Record<ActivityKind, number>;
  for (const e of events) counts[e.kind]++;
  return { ...counts, quiz_submit: attempts, step_complete: completions };
}

/* ─── Timeline ─── */

export type TimelineItem =
  | { type: "event"; at: string; kind: ActivityKind; title: string; unitId: string | null; materialId: string | null; quizId: string | null }
  | { type: "attempt"; at: string; attempt: AttemptRow }
  | { type: "completion"; at: string; completion: CompletionRow };

/** One student's interactions merged into a single newest-first history. */
export function buildTimeline(events: ActivityEvent[], attempts: AttemptRow[], completions: CompletionRow[], limit?: number): TimelineItem[] {
  const items: TimelineItem[] = [
    ...events.map(
      (e): TimelineItem => ({
        type: "event",
        at: e.created_at,
        kind: e.kind,
        title: e.title,
        unitId: e.unit_id,
        materialId: e.material_id,
        quizId: e.quiz_id,
      }),
    ),
    ...attempts.map((a): TimelineItem => ({ type: "attempt", at: a.submitted_at, attempt: a })),
    ...completions.map((c): TimelineItem => ({ type: "completion", at: c.completed_at, completion: c })),
  ];
  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return limit === undefined ? items : items.slice(0, limit);
}

/** Mean percentage over every marked attempt (pooled, not a mean of per-student means); null when none. */
export function averageScore(attempts: Pick<AttemptRow, "status" | "score" | "max_score">[]): number | null {
  const marked = attempts.filter((a) => a.status === "marked" && Number(a.max_score) > 0);
  if (!marked.length) return null;
  return Math.round((marked.reduce((s, a) => s + pct(a), 0) / marked.length) * 10) / 10;
}

/** Percentage helper for display: null-safe, one decimal place. */
export function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}
