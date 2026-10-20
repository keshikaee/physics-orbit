import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/dal";
import { getAdminContent, getUnitCurriculum } from "@/lib/content/queries";
import { indexGrants } from "@/lib/content/access";
import { idSchema } from "@/lib/content/schemas";
import { getRoadmapReferences } from "@/lib/roadmap/queries";
import { ContentTree } from "@/components/admin/content-tree";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";
import { UnitTabs } from "@/components/roadmap/unit-tabs";

export const metadata: Metadata = {
  title: "Unit content",
};

export default function UnitContentPage({ params }: PageProps<"/admin/content/[unitId]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <UnitContent params={params} />
    </Suspense>
  );
}

async function UnitContent({ params }: { params: Promise<{ unitId: string }> }) {
  await requireAdmin();
  const { unitId } = await params;
  if (!idSchema.safeParse(unitId).success) notFound();
  const curriculum = await getUnitCurriculum(unitId);
  if (!curriculum) notFound();
  const [{ units, grants, students }, refs] = await Promise.all([getAdminContent(curriculum.id), getRoadmapReferences()]);
  const unit = units.find((u) => u.id === unitId);
  if (!unit) notFound();
  const grantMap = Object.fromEntries([...indexGrants(grants)].map(([k, v]) => [k, [...v]]));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8 animate-rise">
      <UnitTabs unit={unit} active="content" curriculum={curriculum} />
      <ContentTree units={[unit]} grants={grantMap} students={students} refs={refs} curriculum={curriculum} single />
    </div>
  );
}
