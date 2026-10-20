import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { CurriculumSummary } from "@/lib/content/queries";
import { cn } from "@/lib/utils";

/** The selected curriculum from ?curriculum=…, defaulting to the first active one. */
export function pickCurriculum(curricula: CurriculumSummary[], slug: string | string[] | undefined) {
  const wanted = typeof slug === "string" ? slug : undefined;
  return curricula.find((c) => c.slug === wanted) ?? curricula.find((c) => c.status === "active") ?? curricula[0] ?? null;
}

/* One card per curriculum; choosing one filters the page below it. */
export function CurriculumPicker({
  curricula,
  selected,
  basePath,
  label = "Curriculum",
}: {
  curricula: CurriculumSummary[];
  selected: string;
  basePath: string;
  label?: string;
}) {
  return (
    <nav aria-label={label} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {curricula.map((c) => {
        const active = c.slug === selected;
        return (
          <Link
            key={c.id}
            href={`${basePath}?curriculum=${c.slug}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-2xl border bg-white p-4 transition-colors",
              active ? "border-orbit-primary shadow-[var(--shadow-card)] ring-4 ring-orbit-primary/10" : "border-orbit-border hover:border-orbit-primary/40 hover:bg-orbit-panel",
            )}
          >
            {active && <CheckCircle2 size={16} className="absolute right-3 top-3 text-orbit-primary" aria-hidden="true" />}
            <p className="font-semibold text-orbit-text">{c.name}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-orbit-text-secondary">{c.description}</p>
            <p className="mt-3 text-xs font-medium text-orbit-text-muted">
              {c.unitCount} {c.unitCount === 1 ? "unit" : "units"}
            </p>
          </Link>
        );
      })}
    </nav>
  );
}
