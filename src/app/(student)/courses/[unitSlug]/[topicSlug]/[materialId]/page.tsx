import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { requireStudent } from "@/lib/auth/dal";
import { getMaterial } from "@/lib/content/queries";
import { idSchema } from "@/lib/content/schemas";
import { parseVideoUrl } from "@/lib/content/video";
import { NotesView } from "@/components/content/notes-view";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";
import { MATERIAL_ICONS } from "@/components/admin/material-icons";
import type { Material } from "@/types";

export const metadata: Metadata = {
  title: "Material",
};

export default function MaterialPage({ params }: PageProps<"/courses/[unitSlug]/[topicSlug]/[materialId]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <MaterialView params={params} />
    </Suspense>
  );
}

async function MaterialView({ params }: { params: Promise<{ unitSlug: string; topicSlug: string; materialId: string }> }) {
  await requireStudent();
  const { unitSlug, topicSlug, materialId } = await params;
  if (!idSchema.safeParse(materialId).success) notFound();

  // RLS returns nothing unless the material, its subtopic and its unit are all published and shared with this student.
  const result = await getMaterial(materialId);
  if (!result || result.unit.slug !== unitSlug || result.topic.slug !== topicSlug) notFound();
  const { material, topic, unit } = result;
  const { icon: Icon, label } = MATERIAL_ICONS[material.kind];
  const showNotes = material.kind !== "note" && material.notes.trim();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8 animate-rise">
      <Link
        href={`/courses/${unit.slug}/${topic.slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-orbit-text-secondary transition-colors hover:text-orbit-text"
      >
        <ArrowLeft size={15} aria-hidden="true" /> {topic.title}
      </Link>

      <header className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orbit-panel-hover">
          <Icon size={22} strokeWidth={1.75} className="text-orbit-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-orbit-primary-text">{label}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-orbit-text sm:text-3xl">{material.title}</h1>
          {material.description && <p className="mt-2 max-w-3xl leading-relaxed text-orbit-text-secondary">{material.description}</p>}
        </div>
      </header>

      <Viewer material={material} />

      {showNotes && (
        <section aria-labelledby="notes-heading" className="rounded-2xl border border-orbit-border bg-white p-5 shadow-[var(--shadow-card)] sm:p-7">
          <h2 id="notes-heading" className="mb-3 font-semibold text-orbit-text">
            Notes
          </h2>
          <NotesView source={material.notes} />
        </section>
      )}
    </div>
  );
}

function Viewer({ material }: { material: Material }) {
  const fileUrl = `/api/materials/${material.id}/file`;

  if (material.kind === "note") {
    return (
      <article className="rounded-2xl border border-orbit-border bg-white p-5 shadow-[var(--shadow-card)] sm:p-8">
        <NotesView source={material.notes} className="text-base" />
      </article>
    );
  }

  if (material.kind === "pdf") {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl border border-orbit-border bg-white shadow-[var(--shadow-card)]">
          <iframe src={fileUrl} title={material.title} className="h-[75vh] min-h-[28rem] w-full" />
        </div>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener"
          className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
        >
          <Download size={16} aria-hidden="true" /> Open PDF in a new tab
        </a>
      </div>
    );
  }

  if (material.kind === "video") {
    const source = material.storage_path ? null : material.url ? parseVideoUrl(material.url) : null;
    return (
      <div className="overflow-hidden rounded-2xl border border-orbit-border bg-black shadow-[var(--shadow-card)]">
        {material.storage_path || source?.provider === "file" ? (
          <video
            controls
            preload="metadata"
            controlsList="nodownload"
            src={material.storage_path ? fileUrl : source?.provider === "file" ? source.src : undefined}
            className="aspect-video w-full"
          >
            Your browser can&apos;t play this video.
          </video>
        ) : source ? (
          <iframe
            src={source.embedUrl}
            title={material.title}
            className="aspect-video w-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <p className="p-8 text-center text-sm text-white">This video can&apos;t be played.</p>
        )}
      </div>
    );
  }

  // Link
  let host = "";
  try {
    host = new URL(material.url ?? "").hostname.replace(/^www\./, "");
  } catch {}
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-orbit-border bg-white p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:p-6">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-orbit-text-muted">This opens an external website{host && ":"}</p>
        {host && <p className="truncate font-medium text-orbit-text">{host}</p>}
      </div>
      <a
        href={material.url ?? "#"}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium"
      >
        Open link <ExternalLink size={16} aria-hidden="true" />
      </a>
    </div>
  );
}
