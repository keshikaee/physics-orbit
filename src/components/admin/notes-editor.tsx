"use client";

import { useId, useRef, useState } from "react";
import { Bold, Heading, Italic, Link2, List, ListOrdered } from "lucide-react";
import { inputClass } from "@/components/auth/form-parts";
import { NotesView } from "@/components/content/notes-view";
import { cn } from "@/lib/utils";

const TOOLS = [
  { id: "bold", icon: Bold, label: "Bold" },
  { id: "italic", icon: Italic, label: "Italic" },
  { id: "heading", icon: Heading, label: "Heading" },
  { id: "bullets", icon: List, label: "Bulleted list" },
  { id: "numbers", icon: ListOrdered, label: "Numbered list" },
  { id: "link", icon: Link2, label: "Link" },
] as const;
type ToolId = (typeof TOOLS)[number]["id"];

/**
 * Plain textarea with a small formatting toolbar (Markdown subset) and a preview.
 * The stored value is plain text, so it is safe to render anywhere.
 */
export function NotesEditor({
  name,
  label,
  defaultValue = "",
  errors,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  errors?: string[];
  hint?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const invalid = Boolean(errors?.length);
  const id = useId();

  function wrap(before: string, after = before, placeholder = "text") {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  }

  function prefixLines(prefix: (i: number) => string) {
    const el = ref.current;
    if (!el) return;
    const start = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const end = el.selectionEnd;
    const lines = value.slice(start, end).split("\n");
    const replaced = lines.map((l, i) => prefix(i) + l).join("\n");
    setValue(value.slice(0, start) + replaced + value.slice(end));
    requestAnimationFrame(() => el.focus());
  }

  function apply(tool: ToolId) {
    if (tool === "bold") wrap("**");
    else if (tool === "italic") wrap("*");
    else if (tool === "heading") prefixLines(() => "## ");
    else if (tool === "bullets") prefixLines(() => "- ");
    else if (tool === "numbers") prefixLines((i) => `${i + 1}. `);
    else wrap("[", "](https://)", "link text");
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-medium text-orbit-text">
          {label}
        </label>
        <div className="flex rounded-lg bg-orbit-panel p-0.5 text-xs">
          {["Write", "Preview"].map((tab) => {
            const active = (tab === "Preview") === preview;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setPreview(tab === "Preview")}
                aria-pressed={active}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  active ? "bg-white font-medium text-orbit-text shadow-sm" : "text-orbit-text-muted hover:text-orbit-text"
                )}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* The textarea stays mounted (hidden in preview) so the form always submits the value. */}
      <div className={cn(preview && "hidden")}>
        <div className="flex flex-wrap gap-0.5 rounded-t-xl border border-b-0 border-orbit-border bg-orbit-panel px-1.5 py-1">
          {TOOLS.map(({ id: toolId, icon: Icon, label: toolLabel }) => (
            <button
              key={toolId}
              type="button"
              onClick={() => apply(toolId)}
              aria-label={toolLabel}
              title={toolLabel}
              className="rounded-md p-1.5 text-orbit-text-secondary transition-colors hover:bg-white hover:text-orbit-text"
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
        <textarea
          ref={ref}
          id={id}
          name={name}
          rows={5}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          className={cn(inputClass, "resize-y rounded-t-none font-normal")}
        />
      </div>
      {preview && (
        <div className="min-h-[8.5rem] rounded-xl border border-orbit-border bg-white p-4">
          {value.trim() ? <NotesView source={value} /> : <p className="text-sm text-orbit-text-muted">Nothing to preview.</p>}
        </div>
      )}
      {hint && !invalid && <p className="mt-1.5 text-xs text-orbit-text-muted">{hint}</p>}
      {invalid && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-orbit-error">
          {errors![0]}
        </p>
      )}
    </div>
  );
}
