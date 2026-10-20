import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { UnitArt } from "@/components/illustrations/unit-art";
import type { UnitSummary } from "@/lib/content/queries";

/**
 * Course card for one unit. Shows only real data: code, title, description,
 * the number of published topics and — when the unit has a roadmap — the
 * student's completed required steps.
 */
export function UnitCard({ unit, progress }: { unit: UnitSummary; progress?: { done: number; total: number } }) {
  if (unit.is_placeholder) {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border border-orbit-border bg-white">
        <UnitArt position={unit.order_index} muted className="h-32" />
        <div className="flex flex-1 flex-col p-5">
          <p className="text-xs font-medium text-orbit-text-muted">{unit.code}</p>
          <h3 className="mt-1 font-semibold text-orbit-text-secondary">{unit.title}</h3>
          <p className="mt-auto flex items-center gap-1.5 pt-4 text-xs text-orbit-text-muted">
            <Lock size={12} aria-hidden="true" /> Content coming soon
          </p>
        </div>
      </div>
    );
  }

  const topics = `${unit.topic_count} ${unit.topic_count === 1 ? "subtopic" : "subtopics"}`;
  return (
    <Link
      href={`/courses/${unit.slug}`}
      className="group card-lift flex flex-col overflow-hidden rounded-2xl border border-orbit-border bg-white hover:border-[#cfe3d6]"
    >
      <UnitArt position={unit.order_index} className="h-32" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-orbit-primary-text">{unit.code}</p>
          <span className="rounded-full bg-orbit-primary-muted px-2 py-0.5 text-[11px] font-medium text-orbit-primary-hover">
            Available
          </span>
        </div>
        <h3 className="mt-1 font-semibold text-orbit-text">{unit.title}</h3>
        {unit.description && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-orbit-text-secondary">{unit.description}</p>
        )}
        {progress && (
          <div className="mt-4">
            <p className="text-xs text-orbit-text-secondary">
              {progress.done} of {progress.total} roadmap {progress.total === 1 ? "step" : "steps"} complete
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-orbit-panel-hover" aria-hidden="true">
              <div className="h-full rounded-full bg-orbit-primary" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-xs text-orbit-text-muted">{topics}</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-orbit-border text-orbit-text-secondary transition-colors group-hover:border-orbit-primary group-hover:bg-orbit-primary group-hover:text-white">
            <ArrowRight size={15} aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
