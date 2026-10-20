"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStudentAccount } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formValues, type FormState } from "@/lib/auth/schemas";
import { idSchema } from "@/lib/content/schemas";
import { CURRICULUM_SLUGS, STUDENT_DETAIL_FIELDS, studentDetailsSchema } from "./profile";

/*
 * Curriculum changes. A student may choose their curriculum once (when it
 * is empty); after that only an admin can change it. The database enforces
 * the same rule (guard_profile_update) and, on a change, removes the
 * student's grants on other curricula's content and records it.
 */

/** One-time profile completion for students who registered before curricula existed. */
export async function completeProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireStudentAccount();
  if (profile.curriculum) redirect("/dashboard");

  const values = formValues(formData, [...STUDENT_DETAIL_FIELDS]);
  const parsed = studentDetailsSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: curriculum } = await supabase.from("curricula").select("id").eq("slug", d.curriculum).eq("status", "active").single();
  if (!curriculum) return { message: "That curriculum isn't available.", values };

  const { error } = await supabase
    .from("profiles")
    .update({
      curriculum_id: curriculum.id,
      institute: d.institute,
      district: d.district,
      date_of_birth: d.dateOfBirth,
      gender: d.gender,
      phone: d.phone,
      whatsapp_available: d.whatsapp,
      privacy_consent_at: new Date().toISOString(),
    })
    .eq("id", profile.id);
  if (error) {
    console.error("[profile] completion failed:", error.message);
    return { message: "Could not save your details. Please try again.", values };
  }
  redirect("/dashboard");
}

const changeSchema = z.object({
  studentId: idSchema,
  curriculum: z.enum(CURRICULUM_SLUGS),
});

/** Admin: set or correct a student's curriculum. */
export async function setStudentCurriculumAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = changeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "Choose a curriculum." };

  const supabase = await createClient();
  const { data: curriculum } = await supabase.from("curricula").select("id, name").eq("slug", parsed.data.curriculum).single();
  if (!curriculum) return { message: "That curriculum doesn't exist." };
  const { error } = await supabase
    .from("profiles")
    .update({ curriculum_id: curriculum.id })
    .eq("id", parsed.data.studentId)
    .eq("role", "student");
  if (error) {
    console.error("[profile] curriculum change failed:", error.message);
    return { message: "Could not change the curriculum. Please try again." };
  }
  refresh();
  return { ok: true, message: `Curriculum set to ${curriculum.name}.` };
}
