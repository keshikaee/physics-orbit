"use client";

import { useState, useTransition } from "react";
import { GitBranch, Loader2, Route } from "lucide-react";
import { createRoadmapAction } from "@/lib/roadmap/actions";

/* Shown when a unit has no roadmap yet. */
export function CreateRoadmap({ unitId, topicCount }: { unitId: string; topicCount: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const create = (fromSubtopics: boolean) =>
    start(async () => {
      const res = await createRoadmapAction(unitId, fromSubtopics);
      if (!res.ok) setError(res.message);
    });

  return (
    <div className="rounded-2xl border border-orbit-border bg-white p-6 text-center shadow-[var(--shadow-card)] sm:p-10">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orbit-panel-hover">
        <Route size={22} className="text-orbit-primary" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-orbit-text">No roadmap yet</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-orbit-text-secondary">
        A roadmap shows students how this unit&apos;s lessons, activities and assessments connect. It stays a draft until you publish it.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {topicCount > 0 && (
          <button type="button" disabled={pending} onClick={() => create(true)} className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-60">
            {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <GitBranch size={16} aria-hidden="true" />}
            Start from the {topicCount} {topicCount === 1 ? "subtopic" : "subtopics"}
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => create(false)} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-60">
          Start with an empty roadmap
        </button>
      </div>
      {topicCount > 0 && (
        <p className="mt-3 text-xs text-orbit-text-muted">Starting from subtopics makes one linked step per subtopic in order, plus a unit assessment step.</p>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-orbit-error">{error}</p>}
    </div>
  );
}
