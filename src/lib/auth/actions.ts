"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { homeForRole, isAdminPath, isAdminRole, safeNextPath } from "./routes";
import {
  forgotPasswordSchema,
  formValues,
  loginSchema,
  registrationSchema,
  resetPasswordSchema,
  type FormState,
} from "./schemas";
import type { UserRole } from "@/types";
import { STUDENT_DETAIL_FIELDS } from "@/lib/curriculum/profile";

const NOT_CONFIGURED: FormState = {
  message: "Sign-in is not available yet: Supabase has not been configured for this site.",
};

/** Fixed origin from env — never trust the Host header for email links. */
function appUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const values = formValues(formData, ["firstName", "lastName", "email", "password", ...STUDENT_DETAIL_FIELDS]);
  const parsed = registrationSchema.safeParse(values);
  // Echo back everything except the password.
  const { password: _password, ...safeValues } = values;
  void _password;
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: safeValues };
  }

  const { firstName, lastName, email, password, ...d } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Role is NOT accepted here — the database always creates students.
      // The database validates each detail again before saving it to the profile.
      data: {
        full_name: `${firstName} ${lastName}`,
        curriculum: d.curriculum,
        institute: d.institute,
        district: d.district,
        date_of_birth: d.dateOfBirth,
        gender: d.gender,
        phone: d.phone,
        whatsapp_available: d.whatsapp,
        privacy_consent: d.consent ? "true" : "false",
      },
      emailRedirectTo: appUrl("/auth/callback?next=/dashboard"),
    },
  });

  if (error) {
    return { message: friendlyAuthError(error.message), values: safeValues };
  }

  // Email confirmation disabled in Supabase → session is returned immediately.
  if (data.session) redirect("/dashboard");

  // Same response whether or not the email already exists (no account enumeration).
  return {
    ok: true,
    message: `Check ${email} for a confirmation link to activate your account.`,
  };
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const values = formValues(formData, ["email", "password", "next"]);
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: { email: values.email } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return {
      message: friendlyAuthError(error?.message ?? "Invalid login credentials"),
      values: { email: values.email },
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", data.user.id)
    .single<{ role: UserRole; status: string }>();

  if (!profile) {
    await supabase.auth.signOut();
    return { message: "Your account profile could not be found. Please contact your administrator." };
  }
  if (profile.status !== "active") {
    await supabase.auth.signOut();
    return { message: "Your account has been suspended. Please contact your administrator." };
  }

  const home = homeForRole(profile.role);
  const next = safeNextPath(values.next, home);
  // Don't send a student to an admin page (or vice versa) just because ?next= says so.
  const nextIsForRole = isAdminRole(profile.role) ? isAdminPath(next) : !isAdminPath(next);
  redirect(nextIsForRole ? next : home);
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const values = formValues(formData, ["email"]);
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: appUrl("/auth/callback?next=/reset-password"),
  });

  // Always the same message, whether or not the account exists.
  return {
    ok: true,
    message: "If an account exists for that email, a password reset link is on its way.",
  };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const parsed = resetPasswordSchema.safeParse(
    formValues(formData, ["password", "confirmPassword"])
  );
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { message: "Your reset link has expired. Please request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { message: friendlyAuthError(error.message) };

  redirect("/dashboard");
}

function friendlyAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Incorrect email or password.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email first — check your inbox for the activation link.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("same password") || m.includes("different from the old"))
    return "Choose a password different from your current one.";
  if (m.includes("weak") || m.includes("pwned"))
    return "That password is too easy to guess. Please choose a stronger one.";
  return "Something went wrong. Please try again.";
}
