"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import type { QuizQuestion } from "@/lib/roadmap/queries";
import { parseNumericAnswer } from "@/lib/roadmap/numeric";
import { submitQuizAction } from "@/lib/roadmap/student-actions";
import { RichText } from "@/components/content/notes-view";
import { inputClass } from "@/components/auth/form-parts";
import { cn } from "@/lib/utils";

/*
 * The student fills in answers; only the answers are sent. Marking, the
 * attempt limit and prerequisites are all enforced on the server.
 */

type Answer = { choices: string[] } | { text: string } | { raw: string; unit: string };

const isAnswered = (q: QuizQuestion, a: Answer | undefined) => {
  if (!a) return false;
  if ("choices" in a) return a.choices.length > 0;
  if ("text" in a) return a.text.trim().length > 0;
  return a.raw.trim().length > 0;
};

export function QuizRunner({ quizId, questions }: { quizId: string; questions: QuizQuestion[] }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmBlank, setConfirmBlank] = useState(false);

  const set = (id: string, a: Answer) => {
    setConfirmBlank(false);
    setAnswers((prev) => ({ ...prev, [id]: a }));
  };
  const unanswered = questions.filter((q) => !isAnswered(q, answers[q.id])).length;
  const unreadable = questions.filter((q) => {
    const a = answers[q.id];
    return q.kind === "numeric" && a && "raw" in a && a.raw.trim() && parseNumericAnswer(a.raw) === null;
  }).length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (unanswered > 0 && !confirmBlank) {
      setConfirmBlank(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitQuizAction(quizId, answers);
      if (!res.ok) {
        setError(res.message);
        setSubmitting(false);
        return;
      }
      router.push(`/quizzes/${quizId}/attempts/${res.attemptId}`);
    } catch {
      setError("Could not submit — check your connection and try again. Your answers are still here.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <ol className="space-y-4">
        {questions.map((q, i) => (
          <li key={q.id} className="rounded-2xl border border-orbit-border bg-white p-5 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-orbit-primary-text">Question {i + 1}</p>
              <p className="text-xs text-orbit-text-muted">
                {Number(q.marks)} {Number(q.marks) === 1 ? "mark" : "marks"}
              </p>
            </div>
            <div className="text-[15px] leading-relaxed text-orbit-text">
              <RichText source={q.prompt} />
            </div>
            {q.image_path && (
              // eslint-disable-next-line @next/next/no-img-element -- private, signed per request
              <img src={`/api/questions/${q.id}/image`} alt={`Diagram for question ${i + 1}`} className="mt-3 max-h-80 rounded-xl border border-orbit-border" />
            )}
            <div className="mt-4">
              <AnswerInput q={q} value={answers[q.id]} onChange={(a) => set(q.id, a)} />
            </div>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-0 z-10 -mx-1 rounded-2xl border border-orbit-border bg-white/95 p-4 shadow-[var(--shadow-lift)] backdrop-blur">
        {error && (
          <p role="alert" className="mb-3 flex items-center gap-1.5 text-sm text-orbit-error">
            <AlertTriangle size={15} aria-hidden="true" /> {error}
          </p>
        )}
        {confirmBlank && (
          <p role="alert" className="mb-3 text-sm text-orbit-warning">
            {unanswered} {unanswered === 1 ? "question is" : "questions are"} unanswered. Submit anyway?
          </p>
        )}
        {unreadable > 0 && !error && (
          <p className="mb-3 text-sm text-orbit-warning">
            {unreadable === 1 ? "One numerical answer isn't" : `${unreadable} numerical answers aren't`} a number we can read — it would score 0.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-orbit-text-secondary">
            {questions.length - unanswered} of {questions.length} answered
          </p>
          <button type="submit" disabled={submitting} className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-60">
            {submitting ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
            {submitting ? "Submitting…" : confirmBlank ? "Submit anyway" : "Submit answers"}
          </button>
        </div>
      </div>
    </form>
  );
}

function AnswerInput({ q, value, onChange }: { q: QuizQuestion; value: Answer | undefined; onChange: (a: Answer) => void }) {
  if (q.kind === "mcq_single" || q.kind === "mcq_multi") {
    const chosen = value && "choices" in value ? value.choices : [];
    const single = q.kind === "mcq_single";
    return (
      <fieldset>
        <legend className="mb-2 text-xs text-orbit-text-muted">{single ? "Choose one answer." : "Choose all that apply."}</legend>
        <div className="space-y-2">
          {q.choices.map((c) => {
            const on = chosen.includes(c.id);
            return (
              <label
                key={c.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-[15px] transition-colors",
                  on ? "border-orbit-primary bg-orbit-panel-hover" : "border-orbit-border bg-white hover:bg-orbit-panel",
                )}
              >
                <input
                  type={single ? "radio" : "checkbox"}
                  name={`q-${q.id}`}
                  checked={on}
                  onChange={() => onChange({ choices: single ? [c.id] : on ? chosen.filter((x) => x !== c.id) : [...chosen, c.id] })}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#166534]"
                />
                <span className="text-orbit-text">
                  <RichText source={c.label} />
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (q.kind === "numeric") {
    const v = value && "raw" in value ? value : { raw: "", unit: "" };
    const parsed = v.raw.trim() ? parseNumericAnswer(v.raw) : null;
    return (
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-orbit-text" htmlFor={`n-${q.id}`}>
            Your answer
          </label>
          <input
            id={`n-${q.id}`}
            inputMode="decimal"
            autoComplete="off"
            className={inputClass}
            value={v.raw}
            placeholder="e.g. 3.0e8 or 3.0 × 10^8"
            onChange={(e) => onChange({ raw: e.target.value, unit: v.unit })}
          />
          <p className={cn("mt-1 text-xs", v.raw.trim() && parsed === null ? "text-orbit-warning" : "text-orbit-text-muted")}>
            {v.raw.trim() ? (parsed === null ? "This doesn't look like a number." : <>Read as <SciNumber value={parsed} /></>) : "Type the number; use e or × 10^ for powers of ten."}
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-orbit-text" htmlFor={`u-${q.id}`}>
            Unit
          </label>
          <input
            id={`u-${q.id}`}
            autoComplete="off"
            className={inputClass}
            value={v.unit}
            placeholder="e.g. m s^-1"
            onChange={(e) => onChange({ raw: v.raw, unit: e.target.value })}
          />
        </div>
      </div>
    );
  }

  const text = value && "text" in value ? value.text : "";
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-orbit-text" htmlFor={`t-${q.id}`}>
        Your answer
      </label>
      <textarea id={`t-${q.id}`} rows={4} maxLength={5000} className={inputClass + " resize-y"} value={text} onChange={(e) => onChange({ text: e.target.value })} />
    </div>
  );
}

/** 3e8 → 3 × 10⁸ (rendered with a real superscript); ordinary sizes stay plain. */
export function SciNumber({ value }: { value: number }) {
  const abs = Math.abs(value);
  if (value === 0 || (abs < 1e5 && abs >= 1e-3)) return <>{String(value)}</>;
  const [m, e] = value.toExponential().split("e");
  return (
    <>
      {m} × 10<sup>{Number(e)}</sup>
    </>
  );
}
