import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/dal";
import { getAdminContent, getCurricula } from "@/lib/content/queries";
import { CurriculumPicker, pickCurriculum } from "@/components/curriculum/curriculum-picker";
import { indexGrants } from "@/lib/content/access";
import { getRoadmapIndex, getRoadmapReferences } from "@/lib/roadmap/queries";
import { ContentTree } from "@/components/admin/content-tree";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";

export const metadata: Metadata = {
  title: "Units & Content",
};

export default function ContentPage({ searchParams }: PageProps<"/admin/content">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const [curricula, params] = await Promise.all([getCurricula(), searchParams]);
  const curriculum = pickCurriculum(curricula, params.curriculum);
  if (!curriculum) return <p className="p-8 text-sm text-orbit-text-muted">No curricula found — run the database migrations first.</p>;
  const [{ course, units, grants, students }, refs, roadmaps] = await Promise.all([
    getAdminContent(curriculum.id),
    getRoadmapReferences(),
    getRoadmapIndex(),
  ]);
  const grantMap = Object.fromEntries([...indexGrants(grants)].map(([k, v]) => [k, [...v]]));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8 animate-rise">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-orbit-text">Units &amp; Content</h1>
        <p className="mt-1 text-sm text-orbit-text-secondary">Choose a curriculum to manage its units, content and roadmaps.</p>
      </header>
      <CurriculumPicker curricula={curricula} selected={curriculum.slug} basePath="/admin/content" />
      <div>
        <h2 className="text-xl font-semibold text-orbit-text">{curriculum.name}</h2>
        <p className="text-sm text-orbit-text-secondary">{course ? course.title : "This curriculum has no course yet."}</p>
      </div>
      {course && (
        <ContentTree
          key={curriculum.id}
          units={units}
          grants={grantMap}
          students={students}
          refs={refs}
          roadmaps={Object.fromEntries(roadmaps)}
          curriculum={{ id: curriculum.id, name: curriculum.name }}
        />
      )}
    </div>
  );
}
