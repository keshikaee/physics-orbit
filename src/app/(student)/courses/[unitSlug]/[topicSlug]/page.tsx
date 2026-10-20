import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ChevronRight, Inbox } from "lucide-react";
import { requireStudent } from "@/lib/auth/dal";
import { getTopicWithMaterials } from "@/lib/content/queries";
import { EmptyState } from "@/components/content/empty-state";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";
import { MATERIAL_ICONS } from "@/components/admin/material-icons";

export const metadata: Metadata = {
  title: "Subtopic",
};

const MATERIAL_ACTION = { pdf: "Open PDF", video: "Watch video", link: "Open link", note: "Read note" } as const;

export default function TopicPage({ params }: PageProps<"/courses/[unitSlug]/[topicSlug]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Topic params={params} />
    </Suspense>
  );
}

async function Topic({ params }: { params: Promise<{ unitSlug: string; topicSlug: string }> }) {
  const profile = await requireStudent();
  const { unitSlug, topicSlug } = await params;
  const result = await getTopicWithMaterials(unitSlug, topicSlug, profile.curriculum.id);
  if (!result) notFound(); // missing, unpublished, or not shared with this student (RLS)

  const { unit, topic, materials } = result;
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-5 sm:p-8 animate-rise">
      <Link
        href={`/courses/${unit.slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-orbit-text-secondary transition-colors hover:text-orbit-text"
      >
        <ArrowLeft size={15} aria-hidden="true" /> {unit.code}: {unit.title}
      </Link>

      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-orbit-text">{topic.title}</h1>
        {topic.description && <p className="mt-3 max-w-2xl leading-relaxed text-orbit-text-secondary">{topic.description}</p>}
      </header>

      {materials.length === 0 ? (
        <EmptyState icon={Inbox} title="No materials yet">
          Learning materials will appear here when they are shared with you.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {materials.map((m) => {
            const { icon: Icon, label } = MATERIAL_ICONS[m.kind];
            return (
              <li key={m.id}>
                <Link
                  href={`/courses/${unit.slug}/${topic.slug}/${m.id}`}
                  className="group card-lift flex items-center gap-4 rounded-2xl border border-orbit-border bg-white p-4 sm:p-5"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orbit-panel-hover">
                    <Icon size={20} strokeWidth={1.75} className="text-orbit-primary" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-orbit-primary-text">{label}</p>
                    <h2 className="font-semibold text-orbit-text">{m.title}</h2>
                    {m.description && <p className="mt-0.5 line-clamp-2 text-sm text-orbit-text-secondary">{m.description}</p>}
                  </div>
                  <span className="hidden shrink-0 text-sm font-medium text-orbit-primary-text sm:inline">{MATERIAL_ACTION[m.kind]}</span>
                  <ChevronRight
                    size={18}
                    className="shrink-0 text-orbit-text-muted transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
