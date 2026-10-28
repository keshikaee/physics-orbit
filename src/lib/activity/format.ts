import { ANALYTICS_TIME_ZONE, type ActivityKind, type AttemptRow, type CompletionRow } from "./analytics";

/* Display text for interaction analytics (shared by admin pages). */

export const KIND_LABELS: Record<ActivityKind | "quiz_submit" | "step_complete", string> = {
  sign_in: "Sign-ins",
  dashboard_view: "Dashboard visits",
  courses_view: "Course list visits",
  unit_view: "Unit visits",
  topic_view: "Subtopic visits",
  material_view: "Material opens",
  quiz_view: "Quiz opens",
  quiz_submit: "Quiz submissions",
  step_complete: "Steps completed",
};

export const EVENT_SENTENCES: Record<ActivityKind, string> = {
  sign_in: "Signed in",
  dashboard_view: "Opened the dashboard",
  courses_view: "Browsed the course list",
  unit_view: "Opened unit",
  topic_view: "Opened subtopic",
  material_view: "Opened material",
  quiz_view: "Opened quiz",
};

const tz = { timeZone: ANALYTICS_TIME_ZONE } as const;

export const formatTime = (at: string) =>
  new Date(at).toLocaleTimeString("en-GB", { ...tz, hour: "2-digit", minute: "2-digit" });

export const formatDate = (at: string) =>
  new Date(at).toLocaleDateString("en-GB", { ...tz, day: "numeric", month: "short", year: "numeric" });

export const formatDateTime = (at: string) => `${formatDate(at)}, ${formatTime(at)}`;

/** A "YYYY-MM-DD" day key as "Mon 28 Oct". */
export const formatDay = (day: string, withWeekday = true) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    ...(withWeekday ? { weekday: "short" } : {}),
    day: "numeric",
    month: "short",
  });

/** "3 hours ago", "2 days ago"… for last-active labels. */
export function timeAgo(at: string, now: Date = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(at).getTime()) / 1000);
  if (s < 60) return "just now";
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, "year"],
    [60 * 60 * 24 * 30, "month"],
    [60 * 60 * 24 * 7, "week"],
    [60 * 60 * 24, "day"],
    [60 * 60, "hour"],
    [60, "minute"],
  ];
  for (const [size, name] of units) {
    const n = Math.floor(s / size);
    if (n >= 1) return `${n} ${name}${n === 1 ? "" : "s"} ago`;
  }
  return "just now";
}

export const formatScore = (n: number | null) => (n === null ? "—" : `${n % 1 === 0 ? n : n.toFixed(1)}%`);

export function attemptResult(a: AttemptRow): string {
  if (a.status === "awaiting_marking") return "awaiting marking";
  const p = Number(a.max_score) > 0 ? Math.round((Number(a.score) / Number(a.max_score)) * 100) : null;
  return `${Number(a.score)}/${Number(a.max_score)}${p === null ? "" : ` (${p}%)`} · ${a.passed ? "passed" : "not passed"}`;
}

export const COMPLETION_SOURCE: Record<CompletionRow["source"], string> = {
  auto: "completed by its tasks",
  student: "marked done by the student",
  admin: "marked complete by an admin",
};
