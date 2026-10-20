import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BookOpen, ChevronRight, ClipboardCheck, KeyRound, Users, type LucideIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { countAwaitingMarking } from "@/lib/roadmap/queries";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AdminDashboard />
    </Suspense>
  );
}

async function AdminDashboard() {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const count = async (table: "units" | "topics" | "materials") =>
    (await supabase.from(table).select("id", { count: "exact", head: true })).count ?? 0;
  const [students, units, topics, materials, toMark] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student").then((r) => r.count ?? 0),
    count("units"),
    count("topics"),
    count("materials"),
    countAwaitingMarking(),
  ]);
  const firstName = profile.full_name.split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-5 sm:p-8 animate-rise">
      <section className="mint-wash flex flex-col gap-6 rounded-3xl border border-[#dcebe1] p-6 sm:flex-row sm:items-end sm:justify-between sm:p-9">
        <div>
          <p className="text-lg text-orbit-primary-hover">Welcome back,</p>
          <h1 className="mt-0.5 text-4xl font-semibold tracking-tight text-orbit-text">{firstName}</h1>
          <p className="mt-3 text-orbit-text-secondary">Create content and decide exactly who can see it.</p>
        </div>
        <Link
          href="/admin/content"
          className="btn-primary group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium"
        >
          Open Units &amp; Content
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </section>

      {toMark > 0 && (
        <Link
          href="/admin/marking"
          className="group card-lift flex items-center gap-4 rounded-2xl border border-[#f5dfb3] bg-orbit-warning-muted p-5"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white">
            <ClipboardCheck size={20} strokeWidth={1.75} className="text-orbit-warning" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-orbit-text">
              {toMark} quiz {toMark === 1 ? "attempt is" : "attempts are"} waiting for marking
            </span>
            <span className="block text-sm text-orbit-text-secondary">Short answers that need your judgement. Students see their result once marked.</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-orbit-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}

      <section aria-label="Overview" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Registered Students" value={students} />
        <Stat label="Units" value={units} />
        <Stat label="Subtopics" value={topics} />
        <Stat label="Materials" value={materials} />
      </section>

      <section aria-label="Shortcuts" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Shortcut href="/admin/content" icon={BookOpen} title="Units & Content" desc="Add units, subtopics, PDFs, videos, links and notes." />
        <Shortcut href="/admin/students" icon={Users} title="Students" desc="View accounts and manage each student's access." />
        <Shortcut href="/admin/access" icon={KeyRound} title="Access Management" desc="See who can see every item at a glance." />
        <Shortcut href="/admin/marking" icon={ClipboardCheck} title="Marking" desc="Mark short answers and review quiz attempts." />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-orbit-border bg-white p-5 shadow-[var(--shadow-card)]">
      <p className="text-3xl font-semibold tracking-tight text-orbit-text">{value}</p>
      <p className="mt-0.5 text-sm text-orbit-text-muted">{label}</p>
    </div>
  );
}

function Shortcut({ href, icon: Icon, title, desc }: { href: string; icon: LucideIcon; title: string; desc: string }) {
  return (
    <Link href={href} className="group card-lift block rounded-2xl border border-orbit-border bg-white p-5">
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-orbit-panel-hover">
        <Icon size={20} strokeWidth={1.75} className="text-orbit-primary" aria-hidden="true" />
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold text-orbit-text">{title}</span>
        <ChevronRight size={16} className="text-orbit-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
      <span className="mt-1 block text-sm text-orbit-text-secondary">{desc}</span>
    </Link>
  );
}
