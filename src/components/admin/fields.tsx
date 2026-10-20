"use client";

import { useId } from "react";
import { inputClass } from "@/components/auth/form-parts";

export function TextArea({
  label,
  name,
  errors,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string; errors?: string[] }) {
  const invalid = Boolean(errors?.length);
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-orbit-text mb-1.5">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={3}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className={inputClass + " resize-y"}
        {...props}
      />
      {invalid && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-orbit-error">
          {errors![0]}
        </p>
      )}
    </div>
  );
}

export function Checkbox({
  label,
  name,
  hint,
  defaultChecked,
}: {
  label: string;
  name: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-orbit-border bg-white px-3 py-2.5 cursor-pointer hover:border-orbit-primary/50 hover:bg-orbit-panel transition-colors">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 accent-[#166534]"
      />
      <span>
        <span className="block text-sm font-medium text-orbit-text">{label}</span>
        {hint && <span className="block text-xs text-orbit-text-muted mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}
