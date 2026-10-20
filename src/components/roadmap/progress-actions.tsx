"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { progressOverrideAction } from "@/lib/roadmap/actions";
import { inputClass } from "@/components/auth/form-parts";
import { cn } from "@/lib/utils";

type Action = "complete" | "incomplete" | "reset";

const COPY: Record<Action, { button: string; confirm: string; danger?: boolean }> = {
  complete: { button: "Mark complete", confirm: "Mark this step complete for this student?" },
  incomplete: { button: "Mark not complete", confirm: "Remove this student's completion of this step? Their quiz attempts are kept." },
  reset: { button: "Reset step", confirm: "Delete this student's quiz attempts and completion for this step? This can't be undone.", danger: true },
};

/* Audited overrides: every change needs a confirmation and a reason. */
export function ProgressActions({ studentId, nodeId, completed, hasAttempts }: { studentId: string; nodeId: string; completed: boolean; hasAttempts: boolean }) {
  const [open, setOpen] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const actions: Action[] = [completed ? "incomplete" : "complete", ...(hasAttempts || completed ? (["reset"] as const) : [])];

  return (
    <div className="mt-2">
      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await progressOverrideAction({ studentId, nodeId, action: open, reason });
              setResult({ ok: r.ok, text: r.message ?? "" });
              if (r.ok) {
                setOpen(null);
                setReason("");
              }
            });
          }}
          className={cn("space-y-2 rounded-lg border p-2.5", COPY[open].danger ? "border-[#f6d3ce] bg-orbit-error-muted" : "border-orbit-border bg-orbit-canvas")}
        >
          <p className={cn("text-sm", COPY[open].danger ? "text-orbit-error" : "text-orbit-text")}>{COPY[open].confirm}</p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
            maxLength={1000}
            placeholder="Reason (kept in the audit log)"
            aria-label="Reason"
            className={inputClass + " py-2 text-sm"}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || reason.trim().length < 3}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white disabled:opacity-50",
                COPY[open].danger ? "bg-orbit-error" : "bg-orbit-primary",
              )}
            >
              {pending && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Confirm
            </button>
            <button type="button" onClick={() => setOpen(null)} className="btn-secondary rounded-lg px-3 py-2 text-xs font-medium">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3 text-xs">
          {actions.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setResult(null);
                setOpen(a);
              }}
              className={cn("font-medium hover:underline", COPY[a].danger ? "text-orbit-text-secondary hover:text-orbit-error" : "text-orbit-primary-text")}
            >
              {COPY[a].button}
            </button>
          ))}
        </div>
      )}
      {result && <p className={cn("mt-1 text-xs", result.ok ? "text-orbit-primary-hover" : "text-orbit-error")}>{result.text}</p>}
    </div>
  );
}
