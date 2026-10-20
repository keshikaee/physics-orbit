"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { setContentAccessAction } from "@/lib/content/access-actions";
import { FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { cn } from "@/lib/utils";
import type { AccessMode, ContentKind } from "@/types";

export type PickerStudent = { id: string; full_name: string; email: string; status: string };

/**
 * "All students" or "Selected students" with a searchable checklist.
 * Submits as form fields: accessMode, and one studentIds entry per selection.
 */
export function AccessPicker({
  students,
  defaultMode = "all",
  defaultSelected = [],
  intro,
  onChange,
  groupName,
}: {
  /** Curriculum name, e.g. "Edexcel" → "All Edexcel students". */
  groupName?: string;
  students: PickerStudent[];
  defaultMode?: AccessMode;
  defaultSelected?: string[];
  intro?: string;
  /** Called on every change (for pickers that aren't inside a form). */
  onChange?: (mode: AccessMode, studentIds: string[]) => void;
}) {
  const [mode, setModeState] = useState<AccessMode>(defaultMode);
  const [selected, setSelectedState] = useState<Set<string>>(() => new Set(defaultSelected));
  const setMode = (next: AccessMode) => {
    setModeState(next);
    onChange?.(next, [...selected]);
  };
  const setSelected = (update: (prev: Set<string>) => Set<string>) => {
    const next = update(selected);
    setSelectedState(next);
    onChange?.(mode, [...next]);
  };
  const [query, setQuery] = useState("");
  const radioName = useId();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? students.filter((s) => s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)) : students;
  }, [students, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const chosen = [...selected].map((id) => byId.get(id)).filter((s): s is PickerStudent => Boolean(s));

  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-medium text-orbit-text">Who can see this?</legend>
      {intro && <p className="-mt-1 text-xs text-orbit-text-muted">{intro}</p>}
      <input type="hidden" name="accessMode" value={mode} />
      {mode === "selected" && chosen.map((s) => <input key={s.id} type="hidden" name="studentIds" value={s.id} />)}

      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
        {(
          [
            [
              "all",
              groupName ? `All ${groupName} students` : "All students",
              groupName ? "Everyone in this curriculum, including students who join later." : "Everyone, including students who join later.",
            ],
            ["selected", "Selected students", "Only the students you tick below."],
          ] as const
        ).map(([value, label, hint]) => (
          <label
            key={value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
              mode === value ? "border-orbit-primary bg-orbit-panel-hover" : "border-orbit-border bg-white hover:bg-orbit-panel"
            )}
          >
            <input
              type="radio"
              name={radioName}
              checked={mode === value}
              onChange={() => setMode(value)}
              className="mt-0.5 h-4 w-4 accent-[#166534]"
            />
            <span>
              <span className="block text-sm font-medium text-orbit-text">{label}</span>
              <span className="block text-xs text-orbit-text-secondary">{hint}</span>
            </span>
          </label>
        ))}
      </div>

      {mode === "selected" && (
        <div className="rounded-xl border border-orbit-border bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-orbit-border-subtle p-2.5">
            <div className="relative min-w-0 flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-orbit-text-muted" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email"
                aria-label="Search students"
                className="w-full rounded-lg border border-orbit-border bg-orbit-panel py-2 pl-9 pr-3 text-sm text-orbit-text placeholder:text-orbit-text-muted focus:border-orbit-primary focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setSelected((prev) => new Set([...prev, ...visible.map((s) => s.id)]))}
              className="rounded-lg px-2.5 py-2 text-xs font-medium text-orbit-primary-text hover:bg-orbit-panel"
            >
              Select all{query ? " shown" : ""}
            </button>
            <button
              type="button"
              onClick={() => setSelected(() => new Set())}
              className="rounded-lg px-2.5 py-2 text-xs font-medium text-orbit-text-secondary hover:bg-orbit-panel"
            >
              Clear
            </button>
          </div>

          {students.length === 0 ? (
            <p className="p-4 text-sm text-orbit-text-muted">No {groupName ? `${groupName} ` : ""}students have registered yet.</p>
          ) : visible.length === 0 ? (
            <p className="p-4 text-sm text-orbit-text-muted">No students match “{query}”.</p>
          ) : (
            <ul className="max-h-60 overflow-y-auto p-1.5">
              {visible.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-orbit-panel">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      className="h-4 w-4 accent-[#166534]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-orbit-text">{s.full_name}</span>
                      <span className="block truncate text-xs text-orbit-text-muted">{s.email}</span>
                    </span>
                    {s.status !== "active" && (
                      <span className="rounded-full bg-orbit-panel px-2 py-0.5 text-[11px] text-orbit-text-muted">Inactive</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-1.5 border-t border-orbit-border-subtle p-2.5 text-xs">
            <Users size={14} className="text-orbit-primary" aria-hidden="true" />
            {chosen.length === 0 ? (
              <span className="text-orbit-text-muted">No students selected — nobody will see this.</span>
            ) : (
              <>
                <span className="font-medium text-orbit-text">{chosen.length} selected:</span>
                {chosen.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-orbit-panel-hover py-0.5 pl-2 pr-1 text-orbit-primary-hover">
                    {s.full_name}
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      aria-label={`Remove ${s.full_name}`}
                      className="rounded-full p-0.5 hover:bg-white"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </fieldset>
  );
}

/** Content-wise access editor for an existing unit, subtopic or material. */
export function AccessEditor({
  kind,
  id,
  mode,
  granted,
  students,
  parentNote,
  onDone,
  groupName,
}: {
  groupName?: string;
  kind: ContentKind;
  id: string;
  mode: AccessMode;
  granted: string[];
  students: PickerStudent[];
  parentNote?: string;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(setContentAccessAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <AccessPicker students={students} defaultMode={mode} defaultSelected={granted} intro={parentNote} groupName={groupName} />
      <FormMessage ok={state?.ok} message={state?.message} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-40">
          <SubmitButton pending={pending}>{pending ? "Saving…" : "Save access"}</SubmitButton>
        </div>
        {onDone && (
          <button type="button" onClick={onDone} className="btn-secondary rounded-xl px-4 py-3 text-sm font-medium">
            Close
          </button>
        )}
      </div>
    </form>
  );
}
