"use client";

import { useId } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-xl border border-orbit-border bg-white px-3.5 py-2.5 text-[15px] text-orbit-text placeholder:text-orbit-text-muted/80 focus:outline-none focus:border-orbit-primary focus:ring-4 focus:ring-orbit-primary/10 aria-invalid:border-orbit-error transition-[border-color,box-shadow] duration-200";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  errors?: string[];
}

export function Field({ label, name, errors, className, ...props }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const invalid = Boolean(errors?.length);
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-orbit-text mb-1.5">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className={inputClass}
        {...props}
      />
      {invalid && (
        <p id={errorId} className="mt-1.5 text-xs text-orbit-error">
          {errors![0]}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-60 disabled:cursor-wait"
    >
      {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function FormMessage({ ok, message }: { ok?: boolean; message?: string }) {
  if (!message) return null;
  const Icon = ok ? CheckCircle2 : AlertCircle;
  return (
    <div
      role={ok ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-xl border p-3 text-sm",
        ok
          ? "border-[#cfe3d6] bg-orbit-success-muted text-orbit-primary-hover"
          : "border-[#f6d3ce] bg-orbit-error-muted text-orbit-error"
      )}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
