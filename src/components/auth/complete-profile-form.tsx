"use client";

import { useActionState } from "react";
import { completeProfileAction } from "@/lib/curriculum/actions";
import { FormMessage, SubmitButton } from "./form-parts";
import { StudentDetailsFields } from "./student-details-fields";

export function CompleteProfileForm() {
  const [state, action, pending] = useActionState(completeProfileAction, undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state?.message} />
      <StudentDetailsFields values={state?.values} errors={state?.fieldErrors} />
      <p className="text-xs text-orbit-text-muted">You can choose your curriculum once. After that, ask your teacher if it needs to change.</p>
      <SubmitButton pending={pending}>{pending ? "Saving…" : "Continue"}</SubmitButton>
    </form>
  );
}
