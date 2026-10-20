"use client";

import { useActionState } from "react";
import { updateOwnNameAction } from "@/lib/content/access-actions";
import { Field, FormMessage, SubmitButton } from "@/components/auth/form-parts";

export function NameForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(updateOwnNameAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormMessage ok={state?.ok} message={state?.message} />
      <Field label="Display name" name="fullName" defaultValue={defaultName} required errors={state?.fieldErrors?.fullName} />
      <div className="w-36">
        <SubmitButton pending={pending}>{pending ? "Saving…" : "Save"}</SubmitButton>
      </div>
    </form>
  );
}
