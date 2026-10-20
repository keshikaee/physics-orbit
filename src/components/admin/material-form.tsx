"use client";

import { useActionState, useId, useState } from "react";
import { createMaterialAction, requestUploadAction, updateMaterialAction } from "@/lib/content/actions";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/auth/form-parts";
import { Checkbox, TextArea } from "./fields";
import { createBrowserSupabase } from "@/lib/supabase/client";
import type { FormState } from "@/lib/auth/schemas";
import type { Material, MaterialKind } from "@/types";
import { AccessPicker, type PickerStudent } from "./access-picker";
import { NotesEditor } from "./notes-editor";
import { MATERIAL_ICONS } from "./material-icons";
import { cn } from "@/lib/utils";

export const MATERIAL_KINDS = (Object.keys(MATERIAL_ICONS) as MaterialKind[]).map((kind) => ({ kind, ...MATERIAL_ICONS[kind] }));

function formatBytes(n: number | null) {
  if (!n) return "";
  return n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Upload the chosen file (if any) straight to private storage via a signed URL,
 * then hand the stored path to the server action in place of the file itself.
 */
async function withUpload(topicId: string, kind: MaterialKind, fd: FormData): Promise<FormState | null> {
  const file = fd.get("file");
  fd.delete("file");
  if (!(file instanceof File) || file.size === 0 || (kind !== "pdf" && kind !== "video")) return null;

  const ticket = await requestUploadAction({
    topicId,
    kind,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  });
  if ("error" in ticket) return { message: ticket.error, fieldErrors: { file: [ticket.error ?? "Upload failed."] } };

  const { error } = await createBrowserSupabase().storage.from("materials").uploadToSignedUrl(ticket.path, ticket.token, file, {
    contentType: file.type,
  });
  if (error) return { message: "The upload failed. Check your connection and try again.", fieldErrors: { file: ["Upload failed."] } };

  fd.set("storagePath", ticket.path);
  fd.set("fileName", file.name);
  fd.set("fileSize", String(file.size));
  fd.set("mimeType", file.type);
  if (kind === "video") fd.delete("url"); // an upload replaces a link
  return null;
}

export function MaterialForm({
  topicId,
  material,
  students,
  onDone,
  groupName,
}: {
  groupName?: string;
  topicId: string;
  /** Present when editing. */
  material?: Material;
  /** Needed when creating (access is chosen up front). */
  students?: PickerStudent[];
  onDone?: () => void;
}) {
  const editing = Boolean(material);
  const [kind, setKind] = useState<MaterialKind>(material?.kind ?? "pdf");
  const [videoSource, setVideoSource] = useState<"url" | "upload">(material?.kind === "video" && material.storage_path ? "upload" : "url");
  const [formKey, setFormKey] = useState(0);

  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const uploadError = await withUpload(topicId, kind, fd);
    if (uploadError) return uploadError;
    const result = editing ? await updateMaterialAction(prev, fd) : await createMaterialAction(prev, fd);
    if (result?.ok) {
      if (editing) onDone?.();
      else setFormKey((k) => k + 1); // clear for the next one
    }
    return result;
  }, undefined);
  const errors = state?.fieldErrors;

  const keepFile = material?.storage_path && (kind === "pdf" || (kind === "video" && videoSource === "upload"));

  return (
    <form key={formKey} action={action} className="space-y-4">
      {editing ? (
        <input type="hidden" name="materialId" value={material!.id} />
      ) : (
        <input type="hidden" name="topicId" value={topicId} />
      )}
      <input type="hidden" name="kind" value={kind} />
      {keepFile && <input type="hidden" name="storagePath" value={material!.storage_path!} />}

      {!editing && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-orbit-text">Type</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Material type">
            {MATERIAL_KINDS.map(({ kind: k, label, icon: Icon }) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                  kind === k
                    ? "border-orbit-primary bg-orbit-panel-hover font-medium text-orbit-primary-hover"
                    : "border-orbit-border bg-white text-orbit-text-secondary hover:bg-orbit-panel"
                )}
              >
                <Icon size={16} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <FormMessage ok={state?.ok} message={state?.message} />

      <Field label="Title" name="title" defaultValue={material?.title} required errors={errors?.title} placeholder={kind === "pdf" ? "e.g. Kinematics notes" : undefined} />
      <TextArea label="Description (optional)" name="description" rows={2} defaultValue={material?.description} errors={errors?.description} />

      {kind === "pdf" && (
        <FileInput
          accept="application/pdf"
          label={editing ? "Replace PDF (optional)" : "PDF file"}
          current={material?.storage_path ? `${material.file_name ?? "Current file"} · ${formatBytes(material.file_size)}` : undefined}
          previewHref={material?.storage_path ? `/api/materials/${material.id}/file` : undefined}
          errors={errors?.file}
          required={!editing}
        />
      )}

      {kind === "video" && (
        <div className="space-y-3">
          <div className="flex gap-1 rounded-lg bg-orbit-panel p-0.5 text-sm sm:w-fit">
            {(["url", "upload"] as const).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setVideoSource(src)}
                aria-pressed={videoSource === src}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 transition-colors",
                  videoSource === src ? "bg-white font-medium text-orbit-text shadow-sm" : "text-orbit-text-muted hover:text-orbit-text"
                )}
              >
                {src === "url" ? "Video link" : "Upload file"}
              </button>
            ))}
          </div>
          {videoSource === "url" ? (
            <Field
              label="Video link"
              name="url"
              type="url"
              defaultValue={material?.url ?? ""}
              placeholder="https://www.youtube.com/watch?v=…"
              errors={errors?.url}
            />
          ) : (
            <FileInput
              accept="video/mp4,video/webm,video/quicktime"
              label={material?.storage_path ? "Replace video (optional)" : "Video file (MP4, WebM or MOV, up to 50 MB)"}
              current={material?.storage_path ? `${material.file_name ?? "Current file"} · ${formatBytes(material.file_size)}` : undefined}
              errors={errors?.file ?? errors?.url}
              required={!material?.storage_path}
            />
          )}
        </div>
      )}

      {kind === "link" && (
        <Field label="Link address" name="url" type="url" defaultValue={material?.url ?? ""} placeholder="https://" required errors={errors?.url} />
      )}

      <NotesEditor
        name="notes"
        label={kind === "note" ? "Note" : "Notes (optional)"}
        defaultValue={material?.notes}
        errors={errors?.notes}
        hint={kind === "note" ? undefined : "Add key points, instructions or exam tips — or leave blank."}
      />

      <Checkbox name="isPublished" label="Published" hint="Visible to students who have access." defaultChecked={material?.is_published ?? false} />

      {!editing && students && <AccessPicker students={students} groupName={groupName} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-44">
          <SubmitButton pending={pending}>{pending ? "Saving…" : editing ? "Save material" : "Add material"}</SubmitButton>
        </div>
        {onDone && (
          <button type="button" onClick={onDone} className="btn-secondary rounded-xl px-4 py-3 text-sm font-medium">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function FileInput({
  accept,
  label,
  current,
  previewHref,
  errors,
  required,
}: {
  accept: string;
  label: string;
  current?: string;
  previewHref?: string;
  errors?: string[];
  required?: boolean;
}) {
  const invalid = Boolean(errors?.length);
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-orbit-text">
        {label}
      </label>
      {current && (
        <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-orbit-text-secondary">
          Current: {current}
          {previewHref && (
            <a href={previewHref} target="_blank" rel="noopener" className="font-medium text-orbit-primary-text hover:underline">
              Preview
            </a>
          )}
        </p>
      )}
      <input
        id={id}
        name="file"
        type="file"
        accept={accept}
        required={required}
        aria-invalid={invalid || undefined}
        className={cn(
          inputClass,
          "py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-orbit-panel-hover file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-orbit-primary-hover"
        )}
      />
      {invalid && <p className="mt-1.5 text-xs text-orbit-error">{errors![0]}</p>}
    </div>
  );
}
