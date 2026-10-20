"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/lib/auth/actions";
import { Field, FormMessage, SubmitButton } from "./form-parts";

const URL_ERRORS: Record<string, string> = {
  suspended: "Your account has been suspended. Please contact your teacher.",
  link: "That email link is invalid or has expired. Please try again.",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const [state, action, pending] = useActionState(loginAction, undefined);
  const urlError = URL_ERRORS[searchParams.get("error") ?? ""];

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage ok={state?.ok} message={state?.message ?? urlError} />
      <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />

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
      <div>
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          errors={state?.fieldErrors?.password}
        />
        <div className="mt-1.5 text-right">
          <Link
            href="/forgot-password"
            className="text-xs text-orbit-primary-text hover:text-orbit-primary-hover transition-colors"
          >
            Forgot your password?
          </Link>
        </div>
      </div>

      <SubmitButton pending={pending}>{pending ? "Signing in…" : "Sign In"}</SubmitButton>
    </form>
  );
}
