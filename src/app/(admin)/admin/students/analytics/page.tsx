import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { getCurricula } from "@/lib/content/queries";
import { getActivityAnalytics } from "@/lib/activity/queries";
import {
  averageScore,
  byStudent,
  dailySeries,
  kindBreakdown,
  parsePeriod,
  percentOf,
  periodStart,
  PERIODS,
  studentStats,
  topMaterials,
  type Period,
} from "@/lib/activity/analytics";
import { formatDate, formatScore, KIND_LABELS, timeAgo } from "@/lib/activity/format";
import { DailyChart } from "@/components/activity/daily-chart";
import { StatGrid, TRACKING_STARTED } from "@/components/activity/stat-grid";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Interaction analytics",
};

export default function AnalyticsPage({ searchParams }: PageProps<"/admin/students/analytics">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Analytics searchParams={searchParams} />
    </Suspense>
  );
}

const href = (curriculum: string | null, days: Period) => {
  const p = new URLSearchParams();
  if (curriculum) p.set("curriculum", curriculum);
  if (days !== 30) p.set("days", String(days));
  const q = p.toString();
  return `/admin/students/analytics${q ? `?${q}` : ""}`;
};

async function Analytics({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const [params, curricula] = await Promise.all([searchParams, getCurricula()]);
  const days = parsePeriod(params.days);
  const curriculum = curricula.find((c) => c.slug === params.curriculum) ?? null;
  const data = await getActivityAnalytics(periodStart(days), curriculum?.id);
  const { students, events, attempts, completions } = data;

  const ev = byStudent(events);
  const at = byStudent(attempts);
  const co = byStudent(completions);
  const rows = students.map((s) => ({
    student: s,
    stats: studentStats(ev.get(s.id) ?? [], at.get(s.id) ?? [], co.get(s.id) ?? []),
  }));
  const active = rows.filter((r) => r.stats.interactions > 0);
  const inactive = rows.filter((r) => r.stats.interactions === 0);
  rows.sort(
    (a, b) =>
      b.stats.interactions - a.stats.interactions ||
      (b.stats.lastActive ?? "").localeCompare(a.stats.lastActive ?? "") ||
      a.student.full_name.localeCompare(b.student.full_name),
  );

  const series = dailySeries(events, attempts, completions, days);
  const kinds = kindBreakdown(events, attempts.length, completions.length);
  const kindRows = (Object.keys(kinds) as (keyof typeof kinds)[]).map((k) => ({ k, n: kinds[k] }));
  const kindMax = Math.max(...kindRows.map((r) => r.n), 1);
  const top = topMaterials(events);
  const materialStudents = new Set(events.filter((e) => e.kind === "material_view").map((e) => e.student_id)).size;
  const curriculumName = new Map(curricula.map((c) => [c.id, c.name]));

  // Curriculum comparison (only when looking at everyone).
  const groups = curriculum
    ? []
    : [...curricula.map((c) => ({ id: c.id as string | null, name: c.name, slug: c.slug as string | null })), { id: null, name: "No curriculum", slug: null }]
        .map((g) => {
          const members = rows.filter((r) => r.student.curriculum_id === g.id);
          const ids = new Set(members.map((r) => r.student.id));
          const groupAttempts = attempts.filter((a) => ids.has(a.student_id));
          return {
            ...g,
            students: members.length,
            active: members.filter((r) => r.stats.interactions > 0).length,
            interactions: members.reduce((s, r) => s + r.stats.interactions, 0),
            attempts: groupAttempts.length,
            score: averageScore(groupAttempts),
          };
        })
        .filter((g) => g.students > 0 || g.id !== null);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8 animate-rise">
      <Link href="/admin/students" className="inline-flex items-center gap-1.5 text-sm text-orbit-text-secondary hover:text-orbit-text">
        <ArrowLeft size={15} aria-hidden="true" /> All students
      </Link>

      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-orbit-text">Interaction analytics</h1>
        <p className="mt-1 text-sm text-orbit-text-secondary">
          How students are using Physics Orbit{curriculum ? ` in ${curriculum.name}` : " across all curricula"}, over the last {days} days.
        </p>
      </header>

      {/* Filters: one row, above everything they affect. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Curriculum" className="flex flex-wrap gap-2">
          {[{ slug: null as string | null, name: "All curricula" }, ...curricula.map((c) => ({ slug: c.slug as string | null, name: c.name }))].map((c) => {
            const on = (curriculum?.slug ?? null) === c.slug;
            return (
              <Link
                key={c.slug ?? "all"}
                href={href(c.slug, days)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  on ? "border-orbit-primary bg-orbit-primary text-white" : "border-orbit-border bg-white text-orbit-text-secondary hover:bg-orbit-panel",
                )}
              >
                {c.name}
              </Link>
            );
          })}
        </nav>
        <nav aria-label="Period" className="inline-flex shrink-0 rounded-xl border border-orbit-border bg-white p-1">
          {PERIODS.map((d) => (
            <Link
              key={d}
              href={href(curriculum?.slug ?? null, d)}
              aria-current={d === days ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                d === days ? "bg-orbit-panel-hover text-orbit-primary-hover" : "text-orbit-text-secondary hover:text-orbit-text",
              )}
            >
              {d} days
            </Link>
          ))}
        </nav>
      </div>

      <StatGrid
        stats={[
          { label: "Students", value: students.length },
          {
            label: "Active students",
            value: active.length,
            hint: students.length ? `${percentOf(active.length, students.length)}% of students` : undefined,
          },
          { label: "Interactions", value: events.length + attempts.length + completions.length },
          { label: "Sign-ins", value: kinds.sign_in },
          { label: "Material opens", value: kinds.material_view, hint: `by ${materialStudents} ${materialStudents === 1 ? "student" : "students"}` },
          { label: "Quiz submissions", value: attempts.length },
          { label: "Average quiz score", value: formatScore(averageScore(attempts)), hint: "over marked attempts" },
          { label: "Steps completed", value: completions.length },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <DailyChart points={series} measure="students" title="Active students per day" description="Students with at least one interaction" />
        <DailyChart points={series} measure="interactions" title="Interactions per day" description="Visits, sign-ins, quiz submissions and completed steps" />
      </div>

      {!curriculum && groups.length > 0 && (
        <Panel title="By curriculum" description="Open a curriculum to see its students only.">
          <Table
            head={["Curriculum", "Students", "Active", "Interactions", "Quiz submissions", "Avg. score"]}
            rows={groups.map((g) => [
              g.slug ? (
                <Link key="n" href={href(g.slug, days)} className="font-medium text-orbit-text hover:underline">
                  {g.name}
                </Link>
              ) : (
                <span key="n" className="font-medium text-orbit-warning">{g.name}</span>
              ),
              g.students,
              g.students ? `${g.active} (${percentOf(g.active, g.students)}%)` : "0",
              g.interactions,
              g.attempts,
              formatScore(g.score),
            ])}
          />
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Interactions by type">
          <ul className="space-y-2.5 p-5">
            {kindRows.map(({ k, n }) => (
              <li key={k} className="grid grid-cols-[9.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
                <span className="text-orbit-text-secondary">{KIND_LABELS[k]}</span>
                <span className="h-2.5 rounded-full bg-orbit-panel" aria-hidden="true">
                  <span className="block h-full rounded-full bg-orbit-primary" style={{ width: n ? `max(${(n / kindMax) * 100}%, 4px)` : 0 }} />
                </span>
                <span className="text-right tabular-nums text-orbit-text">{n}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Most-opened materials" description="Ranked by how many students opened them">
          {top.length === 0 ? (
            <p className="p-6 text-center text-sm text-orbit-text-muted">No materials opened in this period.</p>
          ) : (
            <Table
              head={["Material", "Students", "Opens"]}
              rows={top.map((m) => [<span key="t" className="text-orbit-text">{m.title}</span>, m.students, m.views])}
            />
          )}
        </Panel>
      </div>

      <Panel
        title="Student engagement"
        description={
          inactive.length
            ? `${inactive.length} ${inactive.length === 1 ? "student has" : "students have"} no recorded activity in the last ${days} days.`
            : `Every student was active in the last ${days} days.`
        }
      >
        {students.length === 0 ? (
          <p className="p-6 text-center text-sm text-orbit-text-muted">No students in this view.</p>
        ) : (
          <Table
            head={[
              "Student",
              ...(curriculum ? [] : ["Curriculum"]),
              "Last active",
              "Active days",
              "Interactions",
              "Materials",
              "Quizzes",
              "Avg. score",
              "Steps",
            ]}
            rows={rows.map(({ student: s, stats }) => [
              <Link key="n" href={`/admin/students/${s.id}`} className="group inline-flex items-center gap-1 font-medium text-orbit-text hover:underline">
                {s.full_name}
                <ChevronRight size={14} className="text-orbit-text-muted" aria-hidden="true" />
              </Link>,
              ...(curriculum ? [] : [s.curriculum_id ? (curriculumName.get(s.curriculum_id) ?? "—") : "Not set"]),
              stats.lastActive ? (
                <span key="l" title={formatDate(stats.lastActive)}>
                  {timeAgo(stats.lastActive)}
                </span>
              ) : (
                <span key="l" className="rounded-full bg-orbit-warning-muted px-2 py-0.5 text-xs font-medium text-orbit-warning">
                  No activity
                </span>
              ),
              stats.activeDays,
              stats.interactions,
              stats.materialsOpened,
              stats.quizAttempts,
              formatScore(stats.averageScore),
              stats.stepsCompleted,
            ])}
          />
        )}
      </Panel>

      <p className="text-xs text-orbit-text-muted">
        Sign-ins and page visits are recorded from {TRACKING_STARTED}; repeat visits to the same page within 10 minutes count once. Quiz
        submissions and completed steps include earlier history. Days follow Sri Lanka time. Students are grouped by their current curriculum.
      </p>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-orbit-border bg-white shadow-[var(--shadow-card)]">
      <div className="border-b border-orbit-border-subtle px-5 py-4">
        <h2 className="font-semibold text-orbit-text">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-orbit-text-secondary">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-orbit-border-subtle text-left text-xs font-medium uppercase tracking-wide text-orbit-text-muted">
            {head.map((h, i) => (
              <th key={h} scope="col" className={cn("whitespace-nowrap px-5 py-2.5 font-medium", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-orbit-border-subtle">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-orbit-panel">
              {r.map((cell, j) => (
                <td key={j} className={cn("whitespace-nowrap px-5 py-2.5 text-orbit-text-secondary", j > 0 && "text-right tabular-nums")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
