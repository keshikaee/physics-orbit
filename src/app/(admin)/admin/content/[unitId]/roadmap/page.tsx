import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/dal";
import { idSchema } from "@/lib/content/schemas";
import { getRoadmapEditor } from "@/lib/roadmap/queries";
import { Badge } from "@/components/content/badges";
import { DashboardSkeleton } from "@/components/layout/dashboard-skeleton";
import { RoadmapBuilder } from "@/components/roadmap/builder";
import { CreateRoadmap } from "@/components/roadmap/create-roadmap";
import { UnitTabs } from "@/components/roadmap/unit-tabs";

export const metadata: Metadata = {
  title: "Roadmap",
};

export default function RoadmapPage({ params }: PageProps<"/admin/content/[unitId]/roadmap">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Roadmap params={params} />
    </Suspense>
  );
}

async function Roadmap({ params }: { params: Promise<{ unitId: string }> }) {
  await requireAdmin();
  const { unitId } = await params;
  if (!idSchema.safeParse(unitId).success) notFound();
  const data = await getRoadmapEditor(unitId);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-5 sm:p-8 animate-rise">
      <UnitTabs unit={data.unit} active="roadmap" curriculum={data.curriculum}>
        {data.roadmap && (data.roadmap.is_published ? <Badge tone="success">Roadmap published</Badge> : <Badge>Roadmap draft</Badge>)}
      </UnitTabs>
      {data.roadmap ? (
        <RoadmapBuilder key={data.roadmap.id} data={data} />
      ) : (
        <CreateRoadmap unitId={data.unit.id} topicCount={data.topics.length} />
      )}
    </div>
  );
}
