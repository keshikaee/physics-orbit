import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  FlaskConical,
  NotebookPen,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { requireStudent } from "@/lib/auth/dal";
import { getCourseWithUnits, getUnitWithTopics } from "@/lib/content/queries";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";
import { UnitCard } from "@/components/content/unit-card";
import { getUnitProgress } from "@/lib/roadmap/queries";
import { EmptyState } from "@/components/content/empty-state";
import { OrbitIllustration } from "@/components/illustrations/orbit-illustration";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function StudentDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <StudentDashboard />
    </Suspense>
  );
}

async function StudentDashboard() {
  const profile = await requireStudent();
  const firstName = profile.full_name.split(" ")[0];

  // The first unit with real content (Unit 1 initially) is the "current" unit.
  const [course, progress] = await Promise.all([getCourseWithUnits(profile.curriculum.id), getUnitProgress(profile.id)]);
  const units = course?.units ?? [];
  const liveUnit = units.find((u) => !u.is_placeholder) ?? null;
  const unitData = liveUnit ? await getUnitWithTopics(liveUnit.slug, profile.curriculum.id) : null;
  const topics = unitData?.topics ?? [];
  const continueHref = liveUnit ? `/courses/${liveUnit.slug}` : "/courses";

  return (
    <div className="mx-auto max-w-7xl p-5 sm:p-8 animate-rise">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8">
          {/* 1 — What am I learning, and where do I continue? */}
          <section className="mint-wash overflow-hidden rounded-3xl border border-[#dcebe1] p-6 sm:p-9">
            <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
              <div>
                <p className="text-lg text-orbit-primary-hover">Welcome back,</p>
                <h1 className="mt-0.5 text-4xl font-semibold tracking-tight text-orbit-text sm:text-5xl">{firstName}</h1>
                <p className="mt-3 inline-flex flex-wrap items-center gap-x-2 rounded-full bg-white/80 px-3 py-1 text-sm">
                  <span className="font-medium text-orbit-primary-hover">{profile.curriculum.name}</span>
                  {profile.curriculum.description && <span className="text-orbit-text-secondary">{profile.curriculum.description}</span>}
                </p>
                <p className="mt-3 text-orbit-text-secondary">
                  {liveUnit
                    ? "Your current unit is ready whenever you are."
                    : "No learning materials are available for your curriculum yet."}
                </p>
              </div>
              <OrbitIllustration className="pointer-events-none -my-6 hidden lg:block" />
            </div>

            <div>
              <div className="mt-7 flex flex-col gap-4 rounded-2xl bg-white/90 p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orbit-panel-hover">
                    <Target size={20} strokeWidth={1.75} className="text-orbit-primary" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-orbit-text-muted">Currently learning</p>
                    <p className="font-medium text-orbit-text">
                      {liveUnit ? `${liveUnit.code} · ${liveUnit.title}` : "No unit published yet"}
                    </p>
                  </div>
                </div>
                <Link
                  href={continueHref}
                  className="btn-primary group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium"
                >
                  {liveUnit ? "Continue Learning" : "Browse courses"}
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>

          {/* Shortcuts */}
          <section aria-label="Shortcuts" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Tile href="/courses" icon={BookOpen} title="Courses" desc="Units and topics" />
            <Tile icon={FlaskConical} title="Virtual Lab" desc="Explore and experiment" />
            <Tile icon={ClipboardList} title="Assessments" desc="Test your knowledge" />
            <Tile icon={BarChart3} title="My Progress" desc="See your growth" />
          </section>

          {/* 3 — What should I study next? */}
          {liveUnit && (
            <section aria-labelledby="next-heading">
              <SectionHeading id="next-heading" title={`Study next in ${liveUnit.code}`} href={continueHref} />
              {topics.length === 0 ? (
                <EmptyState icon={BookOpen} title="No subtopics yet">
                  Subtopics will appear here when they are shared with you.
                </EmptyState>
              ) : (
                <ol className="divide-y divide-orbit-border-subtle overflow-hidden rounded-2xl border border-orbit-border bg-white shadow-[var(--shadow-card)]">
                  {topics.map((topic, i) => (
                    <li key={topic.id}>
                      <Link
                        href={`/courses/${liveUnit.slug}/${topic.slug}`}
                        className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-orbit-panel sm:px-5"
                      >
                        <span
                          aria-hidden="true"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orbit-panel-hover text-sm font-semibold text-orbit-primary-hover"
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-orbit-text">{topic.title}</p>
                          <p className="text-xs text-orbit-text-muted">
                            {materialsLabel(topic.material_count)}
                          </p>
                        </div>
                        {i === 0 && (
                          <span className="hidden rounded-full bg-orbit-primary-muted px-2.5 py-0.5 text-xs font-medium text-orbit-primary-hover sm:inline">
                            Start here
                          </span>
                        )}
                        <ChevronRight
                          size={18}
                          className="shrink-0 text-orbit-text-muted transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          {/* Courses */}
          <section aria-labelledby="units-heading">
            <SectionHeading id="units-heading" title="Your units" href="/courses" />
            {units.length === 0 ? (
              <EmptyState icon={BookOpen} title="No units yet">
                No learning materials are available for your curriculum yet.
              </EmptyState>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {units.map((unit) => (
                  <UnitCard key={unit.id} unit={unit} progress={progress[unit.id]} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right column */}
        <aside className="space-y-6">
          <Panel icon={CalendarDays} title="Upcoming">
            <EmptyState icon={CalendarDays} title="Nothing scheduled" compact>
              Quizzes and homework set by your teacher will appear here.
            </EmptyState>
          </Panel>

          <Panel icon={Zap} title="Quick access">
            <ul className="space-y-1">
              <SoonRow icon={FlaskConical} label="Virtual Lab" />
              <SoonRow icon={FileText} label="Past Papers" />
              <SoonRow icon={NotebookPen} label="My Notes" />
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function materialsLabel(n: number) {
  return n === 0 ? "Materials coming soon" : `${n} ${n === 1 ? "material" : "materials"}`;
}

function SectionHeading({ id, title, href }: { id: string; title: string; href?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 id={id} className="text-xl font-semibold text-orbit-text">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1 text-sm font-medium text-orbit-primary-text hover:text-orbit-primary-hover"
        >
          View all
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/** Shortcut tile. Without `href` the feature isn't built yet, so it shows "Coming soon" and isn't a link. */
function Tile({ href, icon: Icon, title, desc }: { href?: string; icon: LucideIcon; title: string; desc: string }) {
  const body = (
    <>
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-orbit-panel-hover">
        <Icon size={20} strokeWidth={1.75} className="text-orbit-primary" aria-hidden="true" />
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold text-orbit-text">{title}</span>
        {href && (
          <ChevronRight size={16} className="text-orbit-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        )}
      </span>
      <span className="mt-0.5 block text-xs text-orbit-text-muted">{href ? desc : "Coming soon"}</span>
    </>
  );
  const base = "block rounded-2xl border border-orbit-border bg-white p-4 sm:p-5";
  return href ? (
    <Link href={href} className={`group card-lift ${base}`}>
      {body}
    </Link>
  ) : (
    <div className={base} aria-disabled="true">
      {body}
    </div>
  );
}

function Panel({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-orbit-border bg-white p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 flex items-center gap-2.5 font-semibold text-orbit-text">
        <Icon size={18} strokeWidth={1.75} className="text-orbit-primary" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function SoonRow({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orbit-panel">
        <Icon size={17} strokeWidth={1.75} className="text-orbit-primary" aria-hidden="true" />
      </span>
      <span className="flex-1 text-sm text-orbit-text">{label}</span>
      <span className="rounded-full bg-orbit-panel px-2 py-0.5 text-[11px] font-medium text-orbit-text-muted">Soon</span>
    </li>
  );
}
