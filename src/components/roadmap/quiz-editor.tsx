"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  ImagePlus,
  Info,
  ListChecks,
  Loader2,
  Plus,
  Save,
  Sigma,
  SquareCheck,
  TextCursorInput,
  Trash2,
  X,
} from "lucide-react";
import type { AnswerReveal, QuestionKind, ToleranceKind } from "@/types";
import type { QuizEditorData } from "@/lib/roadmap/queries";
import { deleteQuizAction, requestQuestionImageUploadAction, saveQuizAction } from "@/lib/roadmap/actions";
import { parseNumericAnswer } from "@/lib/roadmap/numeric";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { inputClass } from "@/components/auth/form-parts";
import { RichText } from "@/components/content/notes-view";
import { cn } from "@/lib/utils";

/* ─── Local editing state ─── */

type EditChoice = { id: string; label: string };
type EditQuestion = {
  id: string;
  kind: QuestionKind;
  prompt: string;
  marks: string;
  imagePath: string | null;
  imagePreview: string | null;
  choices: EditChoice[];
  correct: string[];
  numericRaw: string;
  tolerance: string;
  toleranceKind: ToleranceKind;
  unitsRaw: string;
  autoExact: boolean;
  acceptedRaw: string;
  caseSensitive: boolean;
  modelAnswer: string;
  explanation: string;
};
type Settings = {
  title: string;
  description: string;
  passPercent: string;
  limited: boolean;
  maxAttempts: string;
  reveal: AnswerReveal;
  requirePass: boolean;
  isRequired: boolean;
  isPublished: boolean;
};

export const QUESTION_KINDS: { kind: QuestionKind; label: string; icon: typeof ListChecks; hint: string }[] = [
  { kind: "mcq_single", label: "Multiple choice", icon: ListChecks, hint: "One correct answer" },
  { kind: "mcq_multi", label: "Multiple answers", icon: SquareCheck, hint: "Several correct answers; all must be chosen" },
  { kind: "numeric", label: "Numerical", icon: Sigma, hint: "A number with tolerance and an optional unit" },
  { kind: "short", label: "Short answer", icon: TextCursorInput, hint: "Marked by you, or by exact match" },
];

const uuid = () => crypto.randomUUID();

function blankQuestion(kind: QuestionKind): EditQuestion {
  const choices = kind === "mcq_single" || kind === "mcq_multi" ? [{ id: uuid(), label: "" }, { id: uuid(), label: "" }] : [];
  return {
    id: uuid(),
    kind,
    prompt: "",
    marks: "1",
    imagePath: null,
    imagePreview: null,
    choices,
    correct: [],
    numericRaw: "",
    tolerance: "0",
    toleranceKind: "percent",
    unitsRaw: "",
    autoExact: false,
    acceptedRaw: "",
    caseSensitive: false,
    modelAnswer: "",
    explanation: "",
  };
}

function fromData(data: QuizEditorData): { settings: Settings; questions: EditQuestion[] } {
  const q = data.quiz;
  return {
    settings: {
      title: q.title,
      description: q.description,
      passPercent: String(q.pass_percent),
      limited: q.max_attempts !== null,
      maxAttempts: String(q.max_attempts ?? 2),
      reveal: q.reveal,
      requirePass: q.require_pass,
      isRequired: q.is_required,
      isPublished: q.is_published,
    },
    questions: data.questions.map((qq) => ({
      id: qq.id,
      kind: qq.kind,
      prompt: qq.prompt,
      marks: String(Number(qq.marks)),
      imagePath: qq.image_path,
      imagePreview: qq.image_path ? `/api/questions/${qq.id}/image` : null,
      choices: qq.choices.map((c) => ({ id: c.id, label: c.label })),
      correct: qq.key?.correct_choice_ids ?? [],
      numericRaw: qq.key?.numeric_answer != null ? String(qq.key.numeric_answer) : "",
      tolerance: String(qq.key?.tolerance ?? 0),
      toleranceKind: qq.key?.tolerance_kind ?? "percent",
      unitsRaw: (qq.key?.units ?? []).join(", "),
      autoExact: qq.key?.auto_exact ?? false,
      acceptedRaw: (qq.key?.accepted_answers ?? []).join("\n"),
      caseSensitive: qq.key?.case_sensitive ?? false,
      modelAnswer: qq.key?.model_answer ?? "",
      explanation: qq.key?.explanation ?? "",
    })),
  };
}

function buildPayload(quizId: string, nodeId: string, s: Settings, questions: EditQuestion[]) {
  const errors: string[] = [];
  const out = questions.map((q, i) => {
    const marks = Number(q.marks);
    if (!(marks > 0)) errors.push(`Question ${i + 1}: marks must be more than 0.`);
    const numeric = q.kind === "numeric" ? parseNumericAnswer(q.numericRaw) : null;
    if (q.kind === "numeric" && numeric === null) errors.push(`Question ${i + 1}: enter the correct answer as a number (e.g. 3.0e8).`);
    const tolerance = Number(q.tolerance || "0");
    if (q.kind === "numeric" && !(tolerance >= 0)) errors.push(`Question ${i + 1}: tolerance must be 0 or more.`);
    return {
      id: q.id,
      kind: q.kind,
      prompt: q.prompt,
      imagePath: q.imagePath,
      marks: Number.isFinite(marks) ? marks : 0,
      choices: q.kind === "mcq_single" || q.kind === "mcq_multi" ? q.choices.map((c) => ({ id: c.id, label: c.label })) : [],
      key: {
        correctChoiceIds: q.correct,
        numericAnswer: numeric,
        tolerance: Number.isFinite(tolerance) ? tolerance : 0,
        toleranceKind: q.toleranceKind,
        units: q.unitsRaw.split(",").map((u) => u.trim()).filter(Boolean),
        autoExact: q.kind === "short" && q.autoExact,
        acceptedAnswers: q.acceptedRaw.split("\n").map((a) => a.trim()).filter(Boolean),
        caseSensitive: q.caseSensitive,
        modelAnswer: q.modelAnswer,
        explanation: q.explanation,
      },
    };
  });
  return {
    errors,
    payload: {
      id: quizId,
      nodeId,
      title: s.title,
      description: s.description,
      passPercent: Math.round(Number(s.passPercent)),
      maxAttempts: s.limited ? Math.round(Number(s.maxAttempts)) : null,
      reveal: s.reveal,
      requirePass: s.requirePass,
      isRequired: s.isRequired,
      isPublished: s.isPublished,
      questions: out,
    },
  };
}

const keyOf = (s: Settings, qs: EditQuestion[]) => JSON.stringify([s, qs.map((q) => ({ ...q, imagePreview: null }))]);

/* ─── Editor ─── */

export function QuizEditor({ data, roadmapHref }: { data: QuizEditorData; roadmapHref: string }) {
  const router = useRouter();
  const [initial] = useState(() => fromData(data));
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [questions, setQuestions] = useState<EditQuestion[]>(initial.questions);
  const [savedKey, setSavedKey] = useState(() => keyOf(initial.settings, initial.questions));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currentKey = keyOf(settings, questions);
  const dirty = currentKey !== savedKey;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  const update = (id: string, patch: Partial<EditQuestion>) => setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const move = (i: number, d: -1 | 1) =>
    setQuestions((qs) => {
      const next = [...qs];
      const j = i + d;
      if (j < 0 || j >= next.length) return qs;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const totalMarks = questions.reduce((n, q) => n + (Number(q.marks) || 0), 0);
  const manual = questions.filter((q) => q.kind === "short" && !q.autoExact).length;

  const save = async () => {
    setNotice(null);
    const { errors, payload } = buildPayload(data.quiz.id, data.quiz.node_id, settings, questions);
    if (errors.length) {
      setNotice({ ok: false, text: errors[0]! });
      return;
    }
    setSaving(true);
    const key = currentKey;
    try {
      const res = await saveQuizAction(payload);
      setNotice({ ok: res.ok, text: res.message ?? "" });
      if (res.ok) setSavedKey(key);
    } catch {
      setNotice({ ok: false, text: "Could not save — check your connection and try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {data.attempts > 0 && (
        <p className="flex gap-2 rounded-xl border border-[#f5dfb3] bg-orbit-warning-muted p-3.5 text-sm text-orbit-warning">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Students have made {data.attempts} {data.attempts === 1 ? "attempt" : "attempts"} on this quiz. Changes apply to new attempts; past attempts keep the marks they were given.
        </p>
      )}

      {/* Settings */}
      <section className="space-y-4 rounded-2xl border border-orbit-border bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-semibold text-orbit-text">Quiz settings</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <Labeled label="Title">
            <input className={inputClass} value={settings.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} />
          </Labeled>
          <Labeled label="Pass mark (%)">
            <input className={inputClass} type="number" min={0} max={100} value={settings.passPercent} onChange={(e) => set({ passPercent: e.target.value })} />
          </Labeled>
        </div>
        <Labeled label="Instructions (optional)">
          <textarea className={inputClass + " resize-y"} rows={2} maxLength={2000} value={settings.description} onChange={(e) => set({ description: e.target.value })} />
        </Labeled>
        <div className="grid gap-3 md:grid-cols-2">
          <fieldset className="rounded-xl border border-orbit-border p-3">
            <legend className="px-1 text-sm font-medium text-orbit-text">Attempts</legend>
            <label className="mt-1 flex items-center gap-2 text-sm text-orbit-text">
              <input type="radio" className="h-4 w-4 accent-[#166534]" checked={!settings.limited} onChange={() => set({ limited: false })} /> Unlimited — students can retry
            </label>
            <label className="mt-2 flex flex-wrap items-center gap-2 text-sm text-orbit-text">
              <input type="radio" className="h-4 w-4 accent-[#166534]" checked={settings.limited} onChange={() => set({ limited: true })} /> Limit to
              <input
                type="number"
                min={1}
                max={100}
                className={inputClass + " w-20 py-1.5"}
                value={settings.maxAttempts}
                onChange={(e) => set({ maxAttempts: e.target.value, limited: true })}
                aria-label="Maximum attempts"
              />
              {settings.limited && Number(settings.maxAttempts) === 1 ? "(no retries)" : "attempts"}
            </label>
          </fieldset>
          <Labeled label="Show correct answers">
            <select className={inputClass} value={settings.reveal} onChange={(e) => set({ reveal: e.target.value as AnswerReveal })}>
              <option value="after_submit">After each submission</option>
              <option value="after_pass">Only after passing</option>
              <option value="never">Never (students see their marks only)</option>
            </select>
          </Labeled>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <CheckRow
            label="Required for the step"
            hint="Counts towards completing the roadmap step."
            checked={settings.isRequired}
            onChange={(v) => set({ isRequired: v })}
          />
          <CheckRow
            label="Completion requires passing"
            hint="Off: any submitted attempt counts as done."
            checked={settings.requirePass}
            onChange={(v) => set({ requirePass: v })}
          />
        </div>
        <p className="text-xs text-orbit-text-muted">
          {questions.length} {questions.length === 1 ? "question" : "questions"} · {totalMarks} marks ·{" "}
          {manual ? `${manual} short ${manual === 1 ? "answer needs" : "answers need"} marking by hand — attempts wait for you before they can pass` : "fully auto-marked"}
        </p>
      </section>

      {/* Questions */}
      <ol className="space-y-4">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            q={q}
            index={i}
            count={questions.length}
            quizId={data.quiz.id}
            onChange={(patch) => update(q.id, patch)}
            onMove={(d) => move(i, d)}
            onDuplicate={() =>
              setQuestions((qs) => {
                const choices = q.choices.map((c) => ({ ...c, id: uuid() }));
                const map = new Map(q.choices.map((c, k) => [c.id, choices[k]!.id]));
                const copy = { ...q, id: uuid(), choices, correct: q.correct.map((c) => map.get(c)!).filter(Boolean), imagePath: null, imagePreview: null };
                return [...qs.slice(0, i + 1), copy, ...qs.slice(i + 1)];
              })
            }
            onRemove={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}
          />
        ))}
      </ol>

      <div className="rounded-2xl border border-dashed border-orbit-border bg-white p-4">
        <p className="mb-2 text-sm font-medium text-orbit-text">Add a question</p>
        <div className="flex flex-wrap gap-2">
          {QUESTION_KINDS.map(({ kind, label, icon: Icon, hint }) => (
            <button
              key={kind}
              type="button"
              title={hint}
              onClick={() => setQuestions((qs) => [...qs, blankQuestion(kind)])}
              className="inline-flex items-center gap-1.5 rounded-xl border border-orbit-border bg-white px-3 py-2 text-sm font-medium text-orbit-text hover:border-orbit-primary/40 hover:bg-orbit-panel"
            >
              <Icon size={15} className="text-orbit-primary" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-orbit-border bg-white p-4">
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-orbit-error">
              Delete this quiz{data.attempts ? ` and ${data.attempts} student ${data.attempts === 1 ? "attempt" : "attempts"}` : ""}? This can&apos;t be undone.
            </p>
            <button
              type="button"
              onClick={async () => {
                const r = await deleteQuizAction(data.quiz.id);
                if (r.ok) router.push(roadmapHref);
                else setNotice({ ok: false, text: r.message });
              }}
              className="rounded-lg bg-orbit-error px-3 py-2 text-xs font-medium text-white hover:opacity-90"
            >
              Delete quiz
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary rounded-lg px-3 py-2 text-xs font-medium">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-orbit-text-secondary hover:text-orbit-error">
            <Trash2 size={15} aria-hidden="true" /> Delete quiz
          </button>
        )}
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-[env(safe-area-inset-bottom,0px)] z-20 rounded-2xl border border-orbit-border bg-white/95 p-3.5 shadow-[var(--shadow-lift)] backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-orbit-text">
            <input type="checkbox" className="h-4 w-4 accent-[#166534]" checked={settings.isPublished} onChange={(e) => set({ isPublished: e.target.checked })} />
            Published
          </label>
          <div role="status" aria-live="polite" className="min-w-0 flex-1 text-sm">
            {notice ? (
              <span className={cn("inline-flex items-center gap-1.5", notice.ok ? "text-orbit-primary-hover" : "text-orbit-error")}>
                {notice.ok ? <CheckCircle2 size={15} aria-hidden="true" /> : <AlertTriangle size={15} aria-hidden="true" />} {notice.text}
              </span>
            ) : dirty ? (
              <span className="text-orbit-warning">Unsaved changes</span>
            ) : (
              <span className="text-orbit-text-muted">{settings.isPublished ? "Published — students with access can take it." : "Draft — hidden from students."}</span>
            )}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
            {saving ? "Saving…" : dirty ? "Save quiz" : "Saved"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── One question ─── */

function QuestionCard({
  q,
  index,
  count,
  quizId,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  q: EditQuestion;
  index: number;
  count: number;
  quizId: string;
  onChange: (patch: Partial<EditQuestion>) => void;
  onMove: (d: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const isChoice = q.kind === "mcq_single" || q.kind === "mcq_multi";
  const numericValue = useMemo(() => (q.kind === "numeric" && q.numericRaw ? parseNumericAnswer(q.numericRaw) : null), [q.kind, q.numericRaw]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const changeKind = (kind: QuestionKind) => {
    const toChoice = kind === "mcq_single" || kind === "mcq_multi";
    onChange({
      kind,
      choices: toChoice ? (q.choices.length >= 2 ? q.choices : [{ id: uuid(), label: "" }, { id: uuid(), label: "" }]) : q.choices,
      correct: kind === "mcq_single" ? q.correct.slice(0, 1) : q.correct,
    });
  };

  const upload = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const ticket = await requestQuestionImageUploadAction({ quizId, mimeType: file.type, fileSize: file.size });
      if (!ticket.ok) {
        setUploadError(ticket.message);
        return;
      }
      const { error } = await createBrowserSupabase().storage.from("materials").uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
      if (error) {
        setUploadError("Upload failed. Please try again.");
        return;
      }
      onChange({ imagePath: ticket.path, imagePreview: URL.createObjectURL(file) });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <li className="rounded-2xl border border-orbit-border bg-white shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-orbit-border-subtle px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orbit-panel-hover text-sm font-semibold text-orbit-primary-hover">{index + 1}</span>
        <select
          value={q.kind}
          onChange={(e) => changeKind(e.target.value as QuestionKind)}
          aria-label={`Question ${index + 1} type`}
          className="rounded-lg border border-orbit-border bg-white px-2 py-1.5 text-sm text-orbit-text"
        >
          {QUESTION_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-orbit-text-secondary">
          Marks
          <input
            type="number"
            min={0.5}
            step={0.5}
            max={1000}
            value={q.marks}
            onChange={(e) => onChange({ marks: e.target.value })}
            className="w-20 rounded-lg border border-orbit-border px-2 py-1.5 text-sm text-orbit-text"
          />
        </label>
        <div className="ml-auto flex items-center gap-1">
          <IconBtn label="Move up" disabled={index === 0} onClick={() => onMove(-1)} icon={ArrowUp} />
          <IconBtn label="Move down" disabled={index === count - 1} onClick={() => onMove(1)} icon={ArrowDown} />
          <IconBtn label="Duplicate" onClick={onDuplicate} icon={Copy} />
          <IconBtn label="Remove question" onClick={onRemove} icon={Trash2} danger />
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-orbit-text" htmlFor={`prompt-${q.id}`}>
            Question
          </label>
          <textarea
            id={`prompt-${q.id}`}
            className={inputClass + " resize-y"}
            rows={3}
            maxLength={5000}
            value={q.prompt}
            placeholder="e.g. A car accelerates from rest at $2.0\,\text{m s}^{-2}$. Find its speed after $5.0\,\text{s}$."
            onChange={(e) => onChange({ prompt: e.target.value })}
          />
          <p className="mt-1 text-xs text-orbit-text-muted">
            Maths: <code>$...$</code> inline, <code>$$...$$</code> on its own line — e.g. <code>$F = ma$</code>, <code>{"$3.0\\times10^{8}$"}</code>,{" "}
            <code>{"$\\text{m s}^{-1}$"}</code>, <code>{"$\\Delta v$"}</code>, <code>$v_x$</code>. Also **bold** and *italic*.
          </p>
          {q.prompt.trim() && (
            <div className="mt-2 rounded-xl border border-orbit-border-subtle bg-orbit-canvas px-3 py-2.5 text-[15px] text-orbit-text">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-orbit-text-muted">Preview</p>
              <RichText source={q.prompt} />
            </div>
          )}
        </div>

        <div>
          {q.imagePreview ? (
            <div className="flex flex-wrap items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- private signed image */}
              <img src={q.imagePreview} alt="Question diagram" className="max-h-48 rounded-xl border border-orbit-border" />
              <button type="button" onClick={() => onChange({ imagePath: null, imagePreview: null })} className="inline-flex items-center gap-1 text-sm text-orbit-text-secondary hover:text-orbit-error">
                <X size={14} aria-hidden="true" /> Remove image
              </button>
            </div>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-orbit-border px-3 py-2 text-sm text-orbit-text-secondary hover:bg-orbit-panel">
              {uploading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={15} aria-hidden="true" />}
              {uploading ? "Uploading…" : "Add image or diagram"}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
            </label>
          )}
          {uploadError && <p className="mt-1 text-xs text-orbit-error">{uploadError}</p>}
        </div>

        {isChoice && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-orbit-text">
              Choices <span className="font-normal text-orbit-text-muted">— {q.kind === "mcq_single" ? "select the correct one" : "tick every correct one"}</span>
            </legend>
            <ul className="space-y-2">
              {q.choices.map((c, ci) => {
                const correct = q.correct.includes(c.id);
                return (
                  <li key={c.id} className={cn("flex items-start gap-2 rounded-xl border p-2", correct ? "border-orbit-primary bg-orbit-panel" : "border-orbit-border")}>
                    <input
                      type={q.kind === "mcq_single" ? "radio" : "checkbox"}
                      name={`correct-${q.id}`}
                      checked={correct}
                      onChange={() =>
                        onChange({
                          correct: q.kind === "mcq_single" ? [c.id] : correct ? q.correct.filter((x) => x !== c.id) : [...q.correct, c.id],
                        })
                      }
                      aria-label={`Choice ${ci + 1} is correct`}
                      className="mt-2.5 h-4 w-4 accent-[#166534]"
                    />
                    <div className="min-w-0 flex-1">
                      <input
                        value={c.label}
                        maxLength={1000}
                        placeholder={`Choice ${ci + 1}`}
                        onChange={(e) => onChange({ choices: q.choices.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)) })}
                        className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-orbit-text focus:border-orbit-border focus:bg-white focus:outline-none"
                        aria-label={`Choice ${ci + 1}`}
                      />
                      {c.label.includes("$") && (
                        <p className="px-2 text-sm text-orbit-text">
                          <RichText source={c.label} />
                        </p>
                      )}
                    </div>
                    <IconBtn
                      label={`Remove choice ${ci + 1}`}
                      disabled={q.choices.length <= 2}
                      onClick={() => onChange({ choices: q.choices.filter((x) => x.id !== c.id), correct: q.correct.filter((x) => x !== c.id) })}
                      icon={X}
                    />
                  </li>
                );
              })}
            </ul>
            {q.choices.length < 20 && (
              <button
                type="button"
                onClick={() => onChange({ choices: [...q.choices, { id: uuid(), label: "" }] })}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-orbit-primary-text hover:text-orbit-primary-hover"
              >
                <Plus size={14} aria-hidden="true" /> Add choice
              </button>
            )}
          </fieldset>
        )}

        {q.kind === "numeric" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="Correct answer">
              <input className={inputClass} value={q.numericRaw} placeholder="e.g. 3.0e8 or 3.0 × 10^8" onChange={(e) => onChange({ numericRaw: e.target.value })} />
              <p className={cn("mt-1 text-xs", q.numericRaw && numericValue === null ? "text-orbit-error" : "text-orbit-text-muted")}>
                {q.numericRaw ? (numericValue === null ? "Not a number this can read." : `Reads as ${numericValue.toExponential()}`) : "Students may type 3.0e8, 3.0 × 10^8 or 300000000."}
              </p>
            </Labeled>
            <Labeled label="Accepted tolerance">
              <div className="flex gap-2">
                <input className={inputClass} type="number" min={0} step="any" value={q.tolerance} onChange={(e) => onChange({ tolerance: e.target.value })} aria-label="Tolerance" />
                <select
                  className="rounded-xl border border-orbit-border bg-white px-2 text-sm"
                  value={q.toleranceKind}
                  onChange={(e) => onChange({ toleranceKind: e.target.value as ToleranceKind })}
                  aria-label="Tolerance type"
                >
                  <option value="percent">± %</option>
                  <option value="absolute">± absolute</option>
                </select>
              </div>
            </Labeled>
            <Labeled label="Required unit (optional)">
              <input className={inputClass} value={q.unitsRaw} placeholder="e.g. m/s, m s^-1, ms^-1" onChange={(e) => onChange({ unitsRaw: e.target.value })} />
              <p className="mt-1 text-xs text-orbit-text-muted">Separate accepted spellings with commas. Spaces, · and ^ are ignored; capitals matter (mm ≠ Mm). Leave empty for no unit.</p>
            </Labeled>
          </div>
        )}

        {q.kind === "short" && (
          <div className="space-y-3">
            <Labeled label="Model answer / marking guidance">
              <textarea className={inputClass + " resize-y"} rows={2} maxLength={5000} value={q.modelAnswer} onChange={(e) => onChange({ modelAnswer: e.target.value })} />
            </Labeled>
            <CheckRow
              label="Mark automatically by exact match"
              hint="Only for one-word or fixed answers. Otherwise you mark it by hand."
              checked={q.autoExact}
              onChange={(v) => onChange({ autoExact: v })}
            />
            {q.autoExact && (
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Labeled label="Accepted answers (one per line)">
                  <textarea className={inputClass + " resize-y"} rows={3} value={q.acceptedRaw} onChange={(e) => onChange({ acceptedRaw: e.target.value })} />
                </Labeled>
                <div className="sm:pt-7">
                  <CheckRow label="Case-sensitive" hint="" checked={q.caseSensitive} onChange={(v) => onChange({ caseSensitive: v })} />
                </div>
              </div>
            )}
          </div>
        )}

        <Labeled label="Explanation (optional, shown with the answers)">
          <textarea className={inputClass + " resize-y"} rows={2} maxLength={5000} value={q.explanation} onChange={(e) => onChange({ explanation: e.target.value })} />
        </Labeled>
      </div>
    </li>
  );
}

function IconBtn({ label, onClick, disabled, icon: Icon, danger }: { label: string; onClick: () => void; disabled?: boolean; icon: typeof X; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-orbit-text-secondary hover:bg-orbit-panel hover:text-orbit-text disabled:pointer-events-none disabled:opacity-30",
        danger && "hover:bg-orbit-error-muted hover:text-orbit-error",
      )}
    >
      <Icon size={15} />
    </button>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-orbit-text">{label}</p>
      {children}
    </div>
  );
}

function CheckRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-orbit-border px-3 py-2.5 hover:bg-orbit-panel">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#166534]" />
      <span>
        <span className="block text-sm font-medium text-orbit-text">{label}</span>
        {hint && <span className="block text-xs text-orbit-text-muted">{hint}</span>}
      </span>
    </label>
  );
}
