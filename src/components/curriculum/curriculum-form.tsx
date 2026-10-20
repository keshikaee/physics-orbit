"use client";

import { useActionState, useState } from "react";
import { setStudentCurriculumAction } from "@/lib/curriculum/actions";
import { FormMessage, inputClass } from "@/components/auth/form-parts";
import { cn } from "@/lib/utils";

/* Admin: set or correct a student's curriculum, with a confirmation step. */
export function CurriculumForm({
  studentId,
  current,
  curricula,
}: {
  studentId: string;
  current: string | null;
  curricula: { slug: string; name: string }[];
}) {
  const [choice, setChoice] = useState(current ?? "");
  const [state, action, pending] = useActionState(setStudentCurriculumAction, undefined);
  const changing = Boolean(current) && choice !== current;
  const fromName = curricula.find((c) => c.slug === current)?.name;
  const toName = curricula.find((c) => c.slug === choice)?.name;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 block text-sm font-medium text-orbit-text">{current ? "Change curriculum" : "Set curriculum"}</span>
          <select name="curriculum" value={choice} onChange={(e) => setChoice(e.target.value)} className={cn(inputClass, "appearance-auto")} required>
            <option value="" disabled>
              Choose a curriculum
            </option>
            {curricula.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending || !choice || choice === current}
          className={cn(
            "rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50",
            changing ? "bg-orbit-error text-white hover:opacity-90" : "btn-primary",
          )}
        >
          {pending ? "Saving…" : changing ? `Move to ${toName}` : "Save"}
        </button>
      </div>
      {changing && (
        <p className="rounded-xl border border-[#f5dfb3] bg-orbit-warning-muted p-3 text-xs text-orbit-warning">
          The student will stop seeing all {fromName} content and see {toName} content instead. Their individual access on {fromName} items is
          removed; their {fromName} quiz attempts and progress are kept but hidden. The change is recorded.
        </p>
      )}
      <FormMessage ok={state?.ok} message={state?.message} />
    </form>
  );
}
