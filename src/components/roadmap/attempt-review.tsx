"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CircleAlert, Clock, Loader2, XCircle } from "lucide-react";
import type { AttemptReview as Review, ReviewResponse } from "@/lib/roadmap/queries";
import { markResponseAction } from "@/lib/roadmap/actions";
import { RichText } from "@/components/content/notes-view";
import { inputClass } from "@/components/auth/form-parts";
import { cn } from "@/lib/utils";
import { SciNumber } from "./quiz-runner";

/*
 * One attempt with the student's answers, marks and — when the quiz's
 * setting allows (always for admins) — the correct answers. Admins also get
 * a marking form on every question.
 */

export function AttemptSummary({ review, staff = false }: { review: Review; staff?: boolean }) {
  const a = review.attempt;
  const pct = Number(a.max_score) > 0 ? Math.round((Number(a.score) / Number(a.max_score)) * 100) : 0;
  const awaiting = a.status === "awaiting_marking";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-2xl border p-5",
        awaiting ? "border-orbit-border bg-white" : a.passed ? "border-orbit-primary/50 bg-orbit-panel-hover" : "border-[#f5dfb3] bg-orbit-warning-muted",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full",
          awaiting ? "bg-orbit-panel text-orbit-text-secondary" : a.passed ? "bg-orbit-primary text-white" : "bg-white text-orbit-warning",
        )}
      >
        {awaiting ? <Clock size={20} aria-hidden="true" /> : a.passed ? <CheckCircle2 size={20} aria-hidden="true" /> : <CircleAlert size={20} aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold text-orbit-text">{awaiting ? "Waiting for marking" : a.passed ? "Passed" : "Not passed yet"}</p>
        <p className="text-sm text-orbit-text-secondary">
          {awaiting
            ? `${Number(a.score)} of ${Number(a.max_score)} marks so far — ${staff ? "mark the remaining answers below" : "some answers are marked by your teacher"}.`
            : `${Number(a.score)} of ${Number(a.max_score)} marks (${pct}%) · pass mark ${review.quiz.pass_percent}%`}
        </p>
      </div>
      <p className="text-xs text-orbit-text-muted">
        Attempt {a.attempt_no} · {new Date(a.submitted_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}

export function AttemptResponses({ review, marking = false }: { review: Review; marking?: boolean }) {
  return (
    <ol className="space-y-4">
      {review.responses.map((r, i) => (
        <ResponseCard key={r.id} r={r} index={i} revealed={review.revealed} marking={marking} />
      ))}
      {!review.revealed && (
        <li className="rounded-xl border border-orbit-border bg-orbit-canvas p-4 text-sm text-orbit-text-secondary">
          {review.quiz.reveal === "after_pass" ? "Correct answers are shown once you pass this quiz." : "Your teacher has chosen not to show the correct answers for this quiz."}
        </li>
      )}
    </ol>
  );
}

function answerText(r: ReviewResponse) {
  if (r.kind === "mcq_single" || r.kind === "mcq_multi") {
    const picked = r.choices.filter((c) => r.answer.choices?.includes(c.id));
    return picked.length ? null : "No answer";
  }
  if (r.kind === "numeric") {
    if (!r.answer.raw) return "No answer";
    return `${r.answer.raw}${r.answer.unit ? ` ${r.answer.unit}` : ""}`;
  }
  return r.answer.text?.trim() ? r.answer.text : "No answer";
}

function ResponseCard({ r, index, revealed, marking }: { r: ReviewResponse; index: number; revealed: boolean; marking: boolean }) {
  const pending = r.awarded_marks === null;
  const full = !pending && Number(r.awarded_marks) >= Number(r.marks_available);
  const zero = !pending && Number(r.awarded_marks) === 0;
  const isChoice = r.kind === "mcq_single" || r.kind === "mcq_multi";
  const key = r.key;
  const text = answerText(r);

  return (
    <li className="rounded-2xl border border-orbit-border bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-orbit-primary-text">Question {index + 1}</p>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
            pending ? "bg-orbit-panel text-orbit-text-secondary" : full ? "bg-orbit-primary-muted text-orbit-primary-hover" : zero ? "bg-orbit-error-muted text-orbit-error" : "bg-orbit-warning-muted text-orbit-warning",
          )}
        >
          {pending ? <Clock size={12} aria-hidden="true" /> : full ? <CheckCircle2 size={12} aria-hidden="true" /> : <XCircle size={12} aria-hidden="true" />}
          {pending ? "Awaiting marking" : `${Number(r.awarded_marks)}/${Number(r.marks_available)}`}
        </span>
      </div>
      <div className="text-[15px] leading-relaxed text-orbit-text">
        <RichText source={r.prompt} />
      </div>
      {r.image && r.question_id && (
        // eslint-disable-next-line @next/next/no-img-element -- private, signed per request
        <img src={`/api/questions/${r.question_id}/image`} alt={`Diagram for question ${index + 1}`} className="mt-3 max-h-72 rounded-xl border border-orbit-border" />
      )}

      <div className="mt-4 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-orbit-text-muted">{marking ? "Student's answer" : "Your answer"}</p>
        {isChoice && r.choices.length > 0 ? (
          <ul className="space-y-1.5">
            {r.choices.map((c) => {
              const picked = r.answer.choices?.includes(c.id);
              const correct = revealed && key?.correct_choice_ids.includes(c.id);
              return (
                <li
                  key={c.id}
                  className={cn(
                    "flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
                    correct ? "border-orbit-primary bg-orbit-panel-hover" : picked ? "border-orbit-text-muted/40 bg-orbit-canvas" : "border-orbit-border-subtle",
                  )}
                >
                  <span className="mt-0.5 w-4 shrink-0 text-center" aria-hidden="true">
                    {picked ? "●" : "○"}
                  </span>
                  <span className="min-w-0 flex-1 text-orbit-text">
                    <RichText source={c.label} />
                  </span>
                  {picked && <span className="text-xs text-orbit-text-muted">{marking ? "chosen" : "your choice"}</span>}
                  {correct && <span className="text-xs font-medium text-orbit-primary-hover">correct</span>}
                </li>
              );
            })}
          </ul>
        ) : null}
        {text && <p className={cn("whitespace-pre-wrap rounded-xl bg-orbit-canvas px-3 py-2 text-sm", text === "No answer" ? "text-orbit-text-muted" : "text-orbit-text")}>{text}</p>}
      </div>

      {revealed && key && (r.kind === "numeric" || (r.kind === "short" && key.accepted_answers.length > 0) || key.model_answer || key.explanation) && (
        <div className="mt-4 space-y-1.5 rounded-xl border border-orbit-border-subtle bg-orbit-panel p-3 text-sm">
          {r.kind === "numeric" && key.numeric_answer !== null && (
            <p className="text-orbit-text">
              <span className="font-medium">Correct answer:</span> <SciNumber value={key.numeric_answer} />
              {key.units.length ? ` ${key.units[0]}` : ""}
              {key.tolerance > 0 && (
                <span className="text-orbit-text-secondary"> (accepted ± {key.tolerance_kind === "percent" ? `${key.tolerance}%` : key.tolerance})</span>
              )}
            </p>
          )}
          {r.kind === "short" && key.accepted_answers.length > 0 && (
            <p className="text-orbit-text">
              <span className="font-medium">Accepted:</span> {key.accepted_answers.join(" / ")}
            </p>
          )}
          {key.model_answer && (
            <div className="text-orbit-text">
              <span className="font-medium">Model answer:</span> <RichText source={key.model_answer} />
            </div>
          )}
          {key.explanation && (
            <div className="text-orbit-text-secondary">
              <span className="font-medium text-orbit-text">Explanation:</span> <RichText source={key.explanation} />
            </div>
          )}
        </div>
      )}

      {r.feedback && !marking && (
        <p className="mt-3 rounded-xl border border-orbit-border px-3 py-2 text-sm text-orbit-text">
          <span className="font-medium">Feedback:</span> {r.feedback}
        </p>
      )}

      {marking && <MarkForm r={r} />}
    </li>
  );
}

function MarkForm({ r }: { r: ReviewResponse }) {
  const [marks, setMarks] = useState(r.awarded_marks === null ? "" : String(Number(r.awarded_marks)));
  const [feedback, setFeedback] = useState(r.feedback);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const max = Number(r.marks_available);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await markResponseAction({ responseId: r.id, marks: Number(marks), feedback });
          setResult({ ok: res.ok, text: res.message ?? "" });
        });
      }}
      className="mt-4 space-y-2 border-t border-orbit-border-subtle pt-4"
    >
      <p className="text-sm font-medium text-orbit-text">
        {r.awarded_marks === null ? "Mark this answer" : "Change the mark"}
        {r.awarded_marks !== null && <span className="font-normal text-orbit-text-muted"> — changes are recorded in the audit log</span>}
      </p>
      <div className="flex flex-wrap items-start gap-2">
        <label className="flex items-center gap-2 text-sm text-orbit-text">
          <input
            type="number"
            min={0}
            max={max}
            step={0.5}
            required
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            className={inputClass + " w-24 py-2"}
            aria-label="Marks awarded"
          />
          / {max}
        </label>
        <input
          value={feedback}
          maxLength={2000}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Feedback for the student (optional)"
          className={inputClass + " min-w-0 flex-1 py-2"}
          aria-label="Feedback"
        />
        <button type="submit" disabled={pending || marks === ""} className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50">
          {pending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Save mark
        </button>
      </div>
      {result && <p className={cn("text-sm", result.ok ? "text-orbit-primary-hover" : "text-orbit-error")}>{result.text}</p>}
    </form>
  );
}
