import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { buildTimeline, dailySeries, periodStart, studentStats } from "@/lib/activity/analytics";
import { formatDateTime, formatScore, timeAgo } from "@/lib/activity/format";
import { getStudentActivity } from "@/lib/activity/queries";
import { ActivityTimeline } from "./activity-timeline";
import { DailyChart } from "./daily-chart";
import { StatGrid, TrackingNote } from "./stat-grid";

const RECENT = 15;

/** Interaction summary + recent history for one student (admin student page). */
export async function StudentActivitySection({ studentId }: { studentId: string }) {
  // A failure here must never take down the rest of the student page.
  let activity: Awaited<ReturnType<typeof getStudentActivity>>;
  try {
    activity = await getStudentActivity(studentId);
  } catch (e) {
    console.error("[activity] student history failed:", e instanceof Error ? e.message : e);
    return (
      <p className="rounded-xl border border-[#f5dfb3] bg-orbit-warning-muted p-4 text-sm text-orbit-warning">
        Interaction history couldn&apos;t be loaded right now. Everything else on this page is unaffected.
      </p>
    );
  }
  const { events, attempts, completions } = activity;
  const all = studentStats(events, attempts, completions);
  const since = periodStart(30).toISOString();
  const recent = studentStats(
    events.filter((e) => e.created_at >= since),
    attempts.filter((a) => a.submitted_at >= since),
    completions.filter((c) => c.completed_at >= since),
  );
  const series = dailySeries(events, attempts, completions, 30);
  const timeline = buildTimeline(events, attempts, completions);

  return (
    <section aria-labelledby="activity-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="activity-heading" className="text-lg font-semibold text-orbit-text">
            Interaction history
          </h2>
          <p className="text-sm text-orbit-text-secondary">
            {all.lastActive ? (
              <>
                Last active {timeAgo(all.lastActive)} <span className="text-orbit-text-muted">({formatDateTime(all.lastActive)})</span>
              </>
            ) : (
              "No interactions recorded yet."
            )}
          </p>
        </div>
        <Link
          href="/admin/students/analytics"
          className="inline-flex items-center gap-1 text-sm font-medium text-orbit-primary-text hover:underline"
        >
          All students&apos; analytics <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <StatGrid
        stats={[
          { label: "Active days (30 days)", value: recent.activeDays },
          { label: "Interactions (30 days)", value: recent.interactions },
          { label: "Sign-ins (all time)", value: all.signIns },
          { label: "Materials opened", value: all.materialsOpened, hint: `${all.materialViews} opens in total` },
          { label: "Quiz attempts", value: all.quizAttempts, hint: all.awaitingMarking ? `${all.awaitingMarking} awaiting marking` : undefined },
          { label: "Average quiz score", value: formatScore(all.averageScore), hint: `${all.quizzesPassed} ${all.quizzesPassed === 1 ? "quiz" : "quizzes"} passed` },
          { label: "Steps completed", value: all.stepsCompleted },
        ]}
      />

      <DailyChart points={series} measure="interactions" title="Interactions per day" description="Last 30 days" />

      <div className="overflow-hidden rounded-2xl border border-orbit-border bg-white shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-3 border-b border-orbit-border-subtle px-5 py-4">
          <h3 className="font-semibold text-orbit-text">Recent activity</h3>
          {timeline.length > RECENT && (
            <Link
              href={`/admin/students/${studentId}/activity`}
              className="inline-flex items-center gap-1 text-sm font-medium text-orbit-primary-text hover:underline"
            >
              Full history ({timeline.length}) <ChevronRight size={15} aria-hidden="true" />
            </Link>
          )}
        </div>
        <ActivityTimeline items={timeline.slice(0, RECENT)} studentId={studentId} />
        <TrackingNote />
      </div>
    </section>
  );
}
