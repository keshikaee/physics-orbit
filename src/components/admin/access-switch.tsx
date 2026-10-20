"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import type { GrantKind } from "@/lib/content/access";

function SwitchButton({ allowed, title }: { allowed: boolean; title: string }) {
  const { pending } = useFormStatus();
  const on = pending ? !allowed : allowed; // optimistic while saving
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={allowed}
      aria-label={`${allowed ? "Remove" : "Give"} access to ${title}`}
      disabled={pending}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-70",
        on ? "bg-orbit-primary" : "bg-[#d5ddd8]"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
          on ? "translate-x-[1.375rem]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

/** One student × one item toggle. Posts to setStudentAccessAction. */
export function AccessSwitch({
  action,
  studentId,
  kind,
  id,
  allowed,
  title,
}: {
  action: (fd: FormData) => Promise<void>;
  studentId: string;
  kind: GrantKind;
  id: string;
  allowed: boolean;
  title: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="allow" value={String(!allowed)} />
      <SwitchButton allowed={allowed} title={title} />
    </form>
  );
}
