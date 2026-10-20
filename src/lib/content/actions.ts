"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/auth/schemas";
import type { ContentKind, MaterialKind } from "@/types";
import { nextOrderIndex, planMove } from "./ordering";
import { slugify, uniqueSlug } from "./slug";
import {
  ALLOWED_UPLOAD_TYPES,
  accessFromForm,
  contentKindSchema,
  formObject,
  idSchema,
  materialCreateSchema,
  materialUpdateSchema,
  moveSchema,
  topicCreateSchema,
  topicUpdateSchema,
  unitCreateSchema,
  unitUpdateSchema,
  uploadRequestSchema,
} from "./schemas";

/*
 * Admin content mutations. Server Actions are public HTTP endpoints, so each
 * one re-checks the role with requireAdmin(); RLS enforces it again in Postgres.
 */

const BUCKET = "materials";
const TABLE: Record<ContentKind, "units" | "topics" | "materials"> = {
  unit: "units",
  topic: "topics",
  material: "materials",
};

function invalid(error: z.ZodError): FormState {
  return { message: "Please fix the highlighted fields.", fieldErrors: z.flattenError(error).fieldErrors };
}

function dbError(action: string, message: string): FormState {
  console.error(`[content] ${action} failed:`, message);
  return { message: `Could not ${action}. Please try again.` };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function applyAccess(supabase: Supabase, kind: ContentKind, id: string, formData: FormData) {
  const access = accessFromForm(formData);
  if (!access.success) return "Invalid student selection.";
  if (access.data.accessMode === "all") return null; // new rows default to 'all'
  const { error } = await supabase.rpc("set_content_access", {
    p_kind: kind,
    p_id: id,
    p_mode: access.data.accessMode,
    p_students: access.data.studentIds,
  });
  return error ? error.message : null;
}

/* ─── Units ─── */

export async function createUnitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = unitCreateSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const curriculumId = idSchema.safeParse(formData.get("curriculumId"));
  if (!curriculumId.success) return { message: "Choose a curriculum first." };
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id").eq("curriculum_id", curriculumId.data).maybeSingle();
  if (!course) return { message: "This curriculum has no course yet." };

  const { data: siblings, error: readError } = await supabase
    .from("units")
    .select("id, slug, order_index")
    .eq("course_id", course.id);
  if (readError) return dbError("add the unit", readError.message);

  const { title, description, isPublished } = parsed.data;
  const orderIndex = nextOrderIndex(siblings);
  const { data: unit, error } = await supabase
    .from("units")
    .insert({
      course_id: course.id,
      code: parsed.data.code || `Unit ${siblings.length + 1}`,
      title,
      description,
      slug: uniqueSlug(slugify(title), siblings.map((s) => s.slug)),
      order_index: orderIndex,
      is_published: isPublished,
      needs_review: false, // written by the admin
    })
    .select("id")
    .single();
  if (error) return dbError("add the unit", error.message);

  const accessError = await applyAccess(supabase, "unit", unit.id, formData);
  refresh();
  if (accessError) return dbError("save who can see the unit", accessError);
  return { ok: true, message: `Added “${title}”${isPublished ? "" : " as a draft"}.` };
}

export async function updateUnitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = unitUpdateSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { unitId, code, title, description, isPublished, isPlaceholder, reviewed } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("units")
    .update({
      code,
      title,
      description,
      is_published: isPublished,
      is_placeholder: isPlaceholder,
      needs_review: !reviewed,
    })
    .eq("id", unitId);

  if (error) return dbError("save the unit", error.message);
  refresh();
  return { ok: true, message: "Unit saved." };
}

/* ─── Subtopics (topics table) ─── */

export async function createTopicAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = topicCreateSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { unitId, title, description, isPublished } = parsed.data;
  const supabase = await createClient();
  const { data: siblings, error: readError } = await supabase
    .from("topics")
    .select("id, slug, order_index")
    .eq("unit_id", unitId);
  if (readError) return dbError("add the subtopic", readError.message);

  const { data: topic, error } = await supabase
    .from("topics")
    .insert({
      unit_id: unitId,
      title,
      description,
      slug: uniqueSlug(slugify(title), siblings.map((s) => s.slug)),
      order_index: nextOrderIndex(siblings),
      is_published: isPublished,
      needs_review: false,
    })
    .select("id")
    .single();
  if (error) return dbError("add the subtopic", error.message);

  const accessError = await applyAccess(supabase, "topic", topic.id, formData);
  refresh();
  if (accessError) return dbError("save who can see the subtopic", accessError);
  return { ok: true, message: `Added “${title}”${isPublished ? "" : " as a draft"}.` };
}

export async function updateTopicAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = topicUpdateSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { topicId, title, description, isPublished, reviewed } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("topics")
    .update({ title, description, is_published: isPublished, needs_review: !reviewed })
    .eq("id", topicId);

  if (error) return dbError("save the subtopic", error.message);
  refresh();
  return { ok: true, message: "Subtopic saved." };
}

/* ─── Materials ─── */

/**
 * Step 1 of a file upload: the admin's browser asks for a one-time signed
 * upload URL, then sends the file straight to private storage (so large files
 * never pass through this server). The path is chosen here, not by the client.
 */
export async function requestUploadAction(input: z.input<typeof uploadRequestSchema>) {
  await requireAdmin();
  const parsed = uploadRequestSchema.safeParse(input);
  if (!parsed.success) return { error: z.flattenError(parsed.error).formErrors[0] ?? "Invalid file." };

  const { topicId, kind, fileName, mimeType } = parsed.data;
  if (!(ALLOWED_UPLOAD_TYPES[kind] as readonly string[]).includes(mimeType)) {
    return { error: kind === "pdf" ? "Only PDF files can be uploaded." : "Upload an MP4, WebM or MOV video." };
  }

  const supabase = await createClient();
  const { data: topic } = await supabase.from("topics").select("id").eq("id", topicId).maybeSingle();
  if (!topic) return { error: "Subtopic not found." };

  const ext = kind === "pdf" ? "pdf" : (fileName.split(".").pop() ?? "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${topicId}/${randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) {
    console.error("[content] signed upload failed:", error.message);
    return { error: "Could not start the upload. Please try again." };
  }
  return { path: data.path, token: data.token };
}

const PATH_PATTERN = /^([0-9a-f-]{36})\/[0-9a-f-]{36}\.[a-z0-9]{1,8}$/;

/** Verify an uploaded object really exists under the expected folder; read its true size/type. */
async function verifyUpload(supabase: Supabase, path: string, topicId: string, kind: MaterialKind) {
  const m = path.match(PATH_PATTERN);
  if (!m || m[1] !== topicId) return { error: "Upload not recognised. Please upload the file again." };
  const { data, error } = await supabase.storage.from(BUCKET).info(path);
  if (error || !data) return { error: "Upload not found. Please upload the file again." };
  const mime = data.contentType ?? "";
  const allowed = kind === "pdf" ? ALLOWED_UPLOAD_TYPES.pdf : ALLOWED_UPLOAD_TYPES.video;
  if (!(allowed as readonly string[]).includes(mime)) return { error: "That file type isn't allowed here." };
  return { size: data.size ?? null, mime };
}

async function removeFiles(supabase: Supabase, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (!list.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(list);
  if (error) console.error("[content] could not remove files:", error.message);
}

export async function createMaterialAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = materialCreateSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const m = parsed.data;

  const supabase = await createClient();
  let fileFields = {};
  if (m.storagePath && (m.kind === "pdf" || m.kind === "video")) {
    const check = await verifyUpload(supabase, m.storagePath, m.topicId, m.kind);
    if ("error" in check) return { message: check.error, fieldErrors: { file: [check.error!] } };
    fileFields = { storage_path: m.storagePath, file_name: m.fileName ?? null, file_size: check.size, mime_type: check.mime };
  }

  const { data: siblings, error: readError } = await supabase
    .from("materials")
    .select("id, order_index")
    .eq("topic_id", m.topicId);
  if (readError) return dbError("add the material", readError.message);

  const { data: material, error } = await supabase
    .from("materials")
    .insert({
      topic_id: m.topicId,
      kind: m.kind,
      title: m.title,
      description: m.description,
      notes: m.notes,
      url: m.kind === "link" || m.kind === "video" ? (m.url ?? null) : null,
      ...fileFields,
      order_index: nextOrderIndex(siblings),
      is_published: m.isPublished,
    })
    .select("id")
    .single();
  if (error) {
    await removeFiles(supabase, [m.storagePath]); // don't leave an orphaned upload
    return dbError("add the material", error.message);
  }

  const accessError = await applyAccess(supabase, "material", material.id, formData);
  refresh();
  if (accessError) return dbError("save who can see the material", accessError);
  return { ok: true, message: `Added “${m.title}”${m.isPublished ? "" : " as a draft"}.` };
}

export async function updateMaterialAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = materialUpdateSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const m = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("materials")
    .select("topic_id, kind, storage_path")
    .eq("id", m.materialId)
    .maybeSingle();
  if (!existing) return { message: "Material not found." };
  if (existing.kind !== m.kind) return { message: "A material's type can't be changed. Add a new one instead." };

  // A new storagePath means the file was replaced; otherwise keep the current file.
  let fileFields: Record<string, unknown> = {};
  let replacedPath: string | null = null;
  if (m.storagePath && m.storagePath !== existing.storage_path && (m.kind === "pdf" || m.kind === "video")) {
    const check = await verifyUpload(supabase, m.storagePath, existing.topic_id, m.kind);
    if ("error" in check) return { message: check.error, fieldErrors: { file: [check.error!] } };
    fileFields = { storage_path: m.storagePath, file_name: m.fileName ?? null, file_size: check.size, mime_type: check.mime };
    replacedPath = existing.storage_path;
  } else if (m.kind === "video" && m.url) {
    fileFields = { storage_path: null, file_name: null, file_size: null, mime_type: null }; // switched to a link
    replacedPath = existing.storage_path;
  }

  const { error } = await supabase
    .from("materials")
    .update({
      title: m.title,
      description: m.description,
      notes: m.notes,
      url: m.kind === "link" || m.kind === "video" ? (m.url ?? null) : null,
      is_published: m.isPublished,
      ...fileFields,
    })
    .eq("id", m.materialId);
  if (error) return dbError("save the material", error.message);

  await removeFiles(supabase, [replacedPath]);
  refresh();
  return { ok: true, message: "Material saved." };
}

/* ─── Shared: publish, reorder, delete ─── */

export async function setPublishedAction(formData: FormData) {
  await requireAdmin();
  const kind = contentKindSchema.parse(formData.get("kind"));
  const id = idSchema.parse(formData.get("id"));
  const publish = formData.get("publish") === "true";

  const supabase = await createClient();
  const { error } = await supabase.from(TABLE[kind]).update({ is_published: publish }).eq("id", id);
  if (error) throw new Error("Could not change publish state.");
  refresh();
}

export async function moveAction(formData: FormData) {
  await requireAdmin();
  const { kind, id, direction } = moveSchema.parse(formObject(formData));
  const parentColumn = { unit: "course_id", topic: "unit_id", material: "topic_id" }[kind];

  const supabase = await createClient();
  const { data: row } = await supabase.from(TABLE[kind]).select(parentColumn).eq("id", id).single();
  const parentId = (row as Record<string, string> | null)?.[parentColumn];
  if (!parentId) throw new Error("Item not found.");

  const { data: siblings, error } = await supabase
    .from(TABLE[kind])
    .select("id, order_index")
    .eq(parentColumn, parentId);
  if (error) throw new Error("Could not reorder.");

  for (const change of planMove(siblings, id, direction)) {
    const { error: updateError } = await supabase
      .from(TABLE[kind])
      .update({ order_index: change.order_index })
      .eq("id", change.id);
    if (updateError) throw new Error("Could not reorder.");
  }
  refresh();
}

/** Deletes an item and everything inside it (the UI confirms first), plus any stored files. */
export async function deleteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const kind = contentKindSchema.safeParse(formData.get("kind"));
  const id = idSchema.safeParse(formData.get("id"));
  if (!kind.success || !id.success) return { message: "Invalid item." };

  const supabase = await createClient();
  // Collect files first; the rows that point at them disappear with the cascade.
  let filesQuery = supabase.from("materials").select("storage_path, topics!inner(unit_id)").not("storage_path", "is", null);
  if (kind.data === "unit") filesQuery = filesQuery.eq("topics.unit_id", id.data);
  else if (kind.data === "topic") filesQuery = filesQuery.eq("topic_id", id.data);
  else filesQuery = filesQuery.eq("id", id.data);
  const { data: files, error: filesError } = await filesQuery;
  if (filesError) return dbError("delete this item", filesError.message);

  const { error } = await supabase.from(TABLE[kind.data]).delete().eq("id", id.data);
  if (error) return dbError("delete this item", error.message);

  await removeFiles(supabase, (files ?? []).map((f) => f.storage_path));
  refresh();
  return { ok: true, message: "Deleted." };
}
