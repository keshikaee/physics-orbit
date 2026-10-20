"use client";

import { useActionState } from "react";
import { forgotPasswordAction, resetPasswordAction } from "@/lib/auth/actions";
import { Field, FormMessage, SubmitButton } from "./form-parts";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, undefined);

  if (state?.ok) return <FormMessage ok message={state.message} />;

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state?.message} />
      <Field
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="student@example.com"
        required
        defaultValue={state?.values?.email}
        errors={state?.fieldErrors?.email}
      />
      <SubmitButton pending={pending}>{pending ? "Sending…" : "Send reset link"}</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state?.message} />
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters, with a letter and a number"
        required
        errors={state?.fieldErrors?.password}
      />
      <Field
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={state?.fieldErrors?.confirmPassword}
      />
      <SubmitButton pending={pending}>{pending ? "Saving…" : "Set new password"}</SubmitButton>
    </form>
  );
}
