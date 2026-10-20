"use client";

import { useActionState } from "react";
import { registerAction } from "@/lib/auth/actions";
import { Field, FormMessage, SubmitButton } from "./form-parts";
import { SectionTitle, StudentDetailsFields } from "./student-details-fields";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, undefined);

  if (state?.ok) {
    return <FormMessage ok message={state.message} />;
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state?.message} />

      <SectionTitle>Account information</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label="First name"
          name="firstName"
          autoComplete="given-name"
          placeholder="Alice"
          required
          defaultValue={state?.values?.firstName}
          errors={state?.fieldErrors?.firstName}
        />
        <Field
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          placeholder="Smith"
          required
          defaultValue={state?.values?.lastName}
          errors={state?.fieldErrors?.lastName}
        />
      </div>
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
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters, with a letter and a number"
        required
        errors={state?.fieldErrors?.password}
      />

      <StudentDetailsFields values={state?.values} errors={state?.fieldErrors} />

      <SubmitButton pending={pending}>{pending ? "Creating account…" : "Create Account"}</SubmitButton>

      <p className="text-xs text-orbit-text-muted text-center">
        Teacher accounts are created by the administrator. Students register here with their own email.
      </p>
    </form>
  );
}
