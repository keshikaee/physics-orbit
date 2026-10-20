import { z } from "zod";
import { parseVideoUrl } from "./video";

/* Validation for admin content edits — shared by server actions and tests. */

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

const title = z.string().trim().min(1, "Title is required.").max(200, "Title must be 200 characters or fewer.");
const description = z.string().trim().max(2000, "Description must be 2000 characters or fewer.").default("");
const notes = z.string().trim().max(20000, "Notes must be 20,000 characters or fewer.").default("");

export const idSchema = z.uuid("Invalid id.");
export const contentKindSchema = z.enum(["unit", "topic", "material"]);
export const accessModeSchema = z.enum(["all", "selected"]);

/** Access fields posted by <AccessPicker>: a mode plus repeated studentIds. */
export const accessSchema = z
  .object({
    accessMode: accessModeSchema.default("all"),
    studentIds: z.array(idSchema).max(1000).default([]),
  })
  .transform((a) => ({ ...a, studentIds: a.accessMode === "all" ? [] : [...new Set(a.studentIds)] }));

export const unitCreateSchema = z.object({
  code: z.string().trim().max(40, "Label must be 40 characters or fewer.").default(""),
  title,
  description,
  isPublished: checkbox,
});

export const unitUpdateSchema = z.object({
  unitId: idSchema,
  code: z.string().trim().min(1, "Label is required.").max(40),
  title,
  description,
  isPublished: checkbox,
  isPlaceholder: checkbox,
  reviewed: checkbox,
});

export const topicCreateSchema = z.object({
  unitId: idSchema,
  title,
  description,
  isPublished: checkbox,
});

export const topicUpdateSchema = z.object({
  topicId: idSchema,
  title,
  description,
  isPublished: checkbox,
  reviewed: checkbox,
});

export const moveSchema = z.object({
  kind: contentKindSchema,
  id: idSchema,
  direction: z.enum(["up", "down"]),
});

const httpUrl = z
  .string()
  .trim()
  .max(2000, "URL is too long.")
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Enter a full web address starting with https://");

/** Uploaded file reference: produced by the signed-upload flow, re-checked on the server. */
const uploadedFile = z.object({
  storagePath: z.string().min(1).max(500),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.coerce.number().int().min(0),
  mimeType: z.string().max(100),
});

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === undefined ? undefined : v), schema.optional());

/** Fields common to create and update; `kind` decides which source is required. */
export const materialFieldsSchema = z
  .object({
    kind: z.enum(["pdf", "video", "link", "note"]),
    title,
    description,
    notes,
    url: optional(httpUrl),
    storagePath: optional(uploadedFile.shape.storagePath),
    fileName: optional(uploadedFile.shape.fileName),
    fileSize: optional(uploadedFile.shape.fileSize),
    mimeType: optional(uploadedFile.shape.mimeType),
    isPublished: checkbox,
  })
  .superRefine((m, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (m.kind === "pdf" && !m.storagePath) issue("file", "Choose a PDF to upload.");
    if (m.kind === "pdf" && m.mimeType && m.mimeType !== "application/pdf") issue("file", "Only PDF files can be uploaded here.");
    if (m.kind === "link" && !m.url) issue("url", "Enter the link address.");
    if (m.kind === "note" && !m.notes) issue("notes", "Write the note.");
    if (m.kind === "video") {
      if (!m.url && !m.storagePath) issue("url", "Paste a video link or upload a video file.");
      if (m.url && m.storagePath) issue("url", "Use either a link or an uploaded file, not both.");
      if (m.url && !parseVideoUrl(m.url)) {
        issue("url", "Use a YouTube or Vimeo link, or a direct https link to an .mp4/.webm file.");
      }
    }
  });

export const materialCreateSchema = z.intersection(z.object({ topicId: idSchema }), materialFieldsSchema);
export const materialUpdateSchema = z.intersection(z.object({ materialId: idSchema }), materialFieldsSchema);

export const uploadRequestSchema = z.object({
  topicId: idSchema,
  kind: z.enum(["pdf", "video"]),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().min(1).max(50 * 1024 * 1024, "Files must be 50 MB or smaller."),
  mimeType: z.string(),
});

export const ALLOWED_UPLOAD_TYPES = {
  pdf: ["application/pdf"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
} as const;

/** FormData → plain object; unchecked checkboxes are simply absent (→ false). Repeated keys keep the last value. */
export function formObject(formData: FormData) {
  const out: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") out[key] = value;
  });
  return out;
}

/** Access fields from a form (studentIds may repeat). */
export function accessFromForm(formData: FormData) {
  return accessSchema.safeParse({
    accessMode: formData.get("accessMode") ?? undefined,
    studentIds: formData.getAll("studentIds").filter((v): v is string => typeof v === "string"),
  });
}
