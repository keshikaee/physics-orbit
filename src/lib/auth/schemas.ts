import { z } from "zod";
import { studentDetailsSchema } from "@/lib/curriculum/profile";

/* Form validation — shared by server actions and unit tests. */

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long.")
  .pipe(z.email("Enter a valid email address."));

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.")
  .regex(/[A-Za-z]/, "Password must contain a letter.")
  .regex(/[0-9]/, "Password must contain a number.");

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(60, `${label} must be 60 characters or fewer.`);

export const registerSchema = z.object({
  firstName: name("First name"),
  lastName: name("Last name"),
  email,
  password: passwordSchema,
});

/** Registration = account fields + academic/personal details. */
export const registrationSchema = registerSchema.extend(studentDetailsSchema.shape);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type FieldErrors = Partial<Record<string, string[]>>;

export type FormState =
  | {
      ok?: boolean;
      message?: string;
      fieldErrors?: FieldErrors;
      values?: Record<string, string>;
    }
  | undefined;

/** Reads named string fields from FormData (files are ignored). */
export function formValues(formData: FormData, keys: string[]) {
  return Object.fromEntries(
    keys.map((k) => {
      const v = formData.get(k);
      return [k, typeof v === "string" ? v : ""];
    })
  );
}
