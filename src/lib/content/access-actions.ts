"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/auth/schemas";
import { accessFromForm, contentKindSchema, idSchema } from "./schemas";

/*
 * Both ways of managing access write the same content_grants rows through
 * the same database functions, so they can never drift apart:
 *   • content-wise  → set_content_access (an item's mode + its student list)
 *   • student-wise  → set_student_access (one student on one item)
 */

/** Content-wise: "All students" or exactly the selected students for one item. */
export async function setContentAccessAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const kind = contentKindSchema.safeParse(formData.get("kind"));
  const id = idSchema.safeParse(formData.get("id"));
  const access = accessFromForm(formData);
  if (!kind.success || !id.success || !access.success) return { message: "Invalid access settings." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_content_access", {
    p_kind: kind.data,
    p_id: id.data,
    p_mode: access.data.accessMode,
    p_students: access.data.studentIds,
  });
  if (error) {
    console.error("[access] set_content_access failed:", error.message);
    return { message: "Could not save access. Please try again." };
  }
  refresh();
  const n = access.data.studentIds.length;
  return {
    ok: true,
    message: access.data.accessMode === "all" ? "Visible to all students." : `Limited to ${n} ${n === 1 ? "student" : "students"}.`,
  };
}

const studentAccessSchema = z.object({
  studentId: idSchema,
  kind: z.enum(["unit", "topic", "material", "node"]), // node = roadmap step
  id: idSchema,
  allow: z.enum(["true", "false"]).transform((v) => v === "true"),
});

/** Student-wise: allow or block one student on one item. */
export async function setStudentAccessAction(formData: FormData) {
  await requireAdmin();
  const { studentId, kind, id, allow } = studentAccessSchema.parse(Object.fromEntries(formData));

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_student_access", {
    p_student: studentId,
    p_kind: kind,
    p_id: id,
    p_allow: allow,
  });
  if (error) {
    console.error("[access] set_student_access failed:", error.message);
    throw new Error("Could not change access.");
  }
  refresh();
}

const statusSchema = z.object({ studentId: idSchema, status: z.enum(["active", "suspended"]) });

/** Activate or deactivate a student account (deactivated students see no content and cannot sign in). */
export async function setStudentStatusAction(formData: FormData) {
  await requireAdmin();
  const { studentId, status } = statusSchema.parse(Object.fromEntries(formData));

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ status }).eq("id", studentId).eq("role", "student");
  if (error) {
    console.error("[access] status change failed:", error.message);
    throw new Error("Could not change the account status.");
  }
  refresh();
}

const nameSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required.").max(120, "Name must be 120 characters or fewer."),
});

/** Settings: the admin's own display name. */
export async function updateOwnNameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireAdmin();
  const parsed = nameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", profile.id);
  if (error) return { message: "Could not save your name. Please try again." };
  refresh();
  return { ok: true, message: "Saved." };
}
