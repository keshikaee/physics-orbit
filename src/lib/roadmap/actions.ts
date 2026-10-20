"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/content/schemas";
import { quizSaveSchema, reasonSchema, roadmapNodeSchema, roadmapSaveSchema, type QuizInput, type RoadmapNodeInput } from "./schemas";

/*
 * Admin roadmap, quiz and progress mutations. Server Actions are public
 * endpoints, so each re-checks the role; the database functions check it
 * again (is_staff) and RLS blocks everyone else.
 */

const BUCKET = "materials";
type Supabase = Awaited<ReturnType<typeof createClient>>;
export type ActionResult<T = object> = ({ ok: true; message?: string } & T) | { ok: false; message: string };

function failure(action: string, message: string): { ok: false; message: string } {
  console.error(`[roadmap] ${action} failed:`, message);
  return { ok: false, message: `Could not ${action}. Please try again.` };
}

/** First validation problem, prefixed with the question number when relevant. */
function firstIssue(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Please check the form.";
  const qi = issue.path[0] === "questions" && typeof issue.path[1] === "number" ? `Question ${issue.path[1] + 1}: ` : "";
  return qi + issue.message;
}

async function removeFiles(supabase: Supabase, paths: (string | null)[]) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (!list.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(list);
  if (error) console.error("[roadmap] could not remove files:", error.message);
}

/* ─── Roadmaps ─── */

/** Create a unit's roadmap — empty, or as a simple path through its subtopics. */
export async function createRoadmapAction(unitId: string, fromSubtopics: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(unitId).success) return { ok: false, message: "Invalid unit." };
  const supabase = await createClient();

  const { data: roadmap, error } = await supabase.from("roadmaps").insert({ unit_id: unitId }).select("id, version").single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "This unit already has a roadmap." };
    return failure("create the roadmap", error.message);
  }

  if (fromSubtopics) {
    const { data: topics, error: tError } = await supabase
      .from("topics")
      .select("id, title, order_index")
      .eq("unit_id", unitId)
      .order("order_index");
    if (tError) return failure("create the roadmap", tError.message);
    const step = (over: Partial<RoadmapNodeInput>): RoadmapNodeInput => ({
      id: randomUUID(),
      kind: "lesson",
      title: "Step",
      x: 0,
      y: 0,
      completionRule: "student_mark",
      ...over,
    });
    const list = topics ?? [];
    const nodes = [
      ...list.map((t, i) => step({ title: t.title, topicId: t.id, x: i * 280 })),
      step({ kind: "final", title: "Unit assessment", x: list.length * 280, completionRule: "all_required" }),
    ];
    const edges = nodes.slice(1).map((n, i) => ({ source: nodes[i]!.id, target: n.id }));
    const { error: saveError } = await supabase.rpc("save_roadmap", {
      p_roadmap: roadmap.id,
      p_version: roadmap.version,
      p_nodes: nodes.map((n) => roadmapNodeSchema.parse(n)),
      p_edges: edges,
    });
    if (saveError) return failure("create the roadmap", saveError.message);
  }
  refresh();
  return { ok: true, message: "Roadmap created." };
}

export async function saveRoadmapAction(
  input: unknown,
): Promise<ActionResult<{ version: number }> | { ok: false; needsConfirm: { title: string; students: number }[]; message: string }> {
  await requireAdmin();
  const parsed = roadmapSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const { roadmapId, version, nodes, edges, confirmRemoval } = parsed.data;
  const supabase = await createClient();

  // Steps being removed: warn when students have completed them; collect quiz images to clean up.
  const { data: existing, error: exError } = await supabase.from("roadmap_nodes").select("id, title").eq("roadmap_id", roadmapId);
  if (exError) return failure("save the roadmap", exError.message);
  const keep = new Set(nodes.map((n) => n.id));
  const removed = (existing ?? []).filter((n) => !keep.has(n.id));

  let images: (string | null)[] = [];
  if (removed.length) {
    const removedIds = removed.map((n) => n.id);
    const [{ data: done }, { data: qs }] = await Promise.all([
      supabase.from("node_completions").select("node_id").in("node_id", removedIds),
      supabase.from("questions").select("image_path, quizzes!inner(node_id)").in("quizzes.node_id", removedIds).not("image_path", "is", null),
    ]);
    if (!confirmRemoval && done?.length) {
      const counts = new Map<string, number>();
      for (const d of done) counts.set(d.node_id, (counts.get(d.node_id) ?? 0) + 1);
      return {
        ok: false,
        message: "Some removed steps have student progress.",
        needsConfirm: removed.filter((n) => counts.has(n.id)).map((n) => ({ title: n.title, students: counts.get(n.id)! })),
      };
    }
    images = (qs ?? []).map((q) => q.image_path);
  }

  const { data: newVersion, error } = await supabase.rpc("save_roadmap", {
    p_roadmap: roadmapId,
    p_version: version,
    p_nodes: nodes,
    p_edges: edges,
  });
  if (error) {
    if (error.message.includes("roadmap_conflict"))
      return { ok: false, message: "This roadmap was changed in another tab or by another admin. Reload to get the latest version — your unsaved edits will be lost." };
    if (/must belong to this unit/.test(error.message)) return { ok: false, message: "A step links content from a different unit." };
    return failure("save the roadmap", error.message);
  }
  await removeFiles(supabase, images);
  refresh();
  return { ok: true, version: newVersion as number, message: "Roadmap saved." };
}

const settingsSchema = z.object({
  roadmapId: idSchema,
  isPublished: z.boolean().optional(),
  restrictedDisplay: z.enum(["hide", "lock"]).optional(),
});

export async function setRoadmapSettingsAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid settings." };
  const { roadmapId, isPublished, restrictedDisplay } = parsed.data;
  const patch: Record<string, unknown> = {};
  if (isPublished !== undefined) patch.is_published = isPublished;
  if (restrictedDisplay !== undefined) patch.restricted_display = restrictedDisplay;
  const supabase = await createClient();
  const { error } = await supabase.from("roadmaps").update(patch).eq("id", roadmapId);
  if (error) return failure("update the roadmap", error.message);
  refresh();
  return {
    ok: true,
    message:
      isPublished === undefined
        ? restrictedDisplay === "lock"
          ? "Restricted steps now show as locked."
          : "Restricted steps are now hidden."
        : isPublished
          ? "Roadmap published."
          : "Roadmap hidden from students.",
  };
}

/* ─── Quizzes ─── */

export async function createQuizAction(nodeId: string): Promise<ActionResult<{ quizId: string }>> {
  await requireAdmin();
  if (!idSchema.safeParse(nodeId).success) return { ok: false, message: "Save the roadmap before adding quizzes to a new step." };
  const supabase = await createClient();
  const { data: step } = await supabase.from("roadmap_nodes").select("id").eq("id", nodeId).maybeSingle();
  if (!step) return { ok: false, message: "Save the roadmap before adding quizzes to a new step." };

  const quiz: QuizInput = {
    id: randomUUID(),
    nodeId,
    title: "New quiz",
    description: "",
    passPercent: 60,
    maxAttempts: null,
    reveal: "after_submit",
    requirePass: true,
    isRequired: true,
    isPublished: false,
    questions: [],
  };
  const { data, error } = await supabase.rpc("save_quiz", { p_quiz: quizSaveSchema.parse(quiz) });
  if (error) return failure("create the quiz", error.message);
  refresh();
  return { ok: true, quizId: data as string };
}

export async function saveQuizAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = quizSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const quiz = parsed.data;
  const supabase = await createClient();

  // Images uploaded for this quiz must sit in its own folder.
  for (const q of quiz.questions) {
    if (q.imagePath && !q.imagePath.startsWith(`quiz/${quiz.id}/`)) return { ok: false, message: "Invalid image." };
  }
  const { data: before } = await supabase.from("questions").select("image_path").eq("quiz_id", quiz.id).not("image_path", "is", null);

  const { error } = await supabase.rpc("save_quiz", { p_quiz: quiz });
  if (error) {
    const known = /(needs|must|exactly one|at least one|cannot move)/.test(error.message);
    return known ? { ok: false, message: error.message.charAt(0).toUpperCase() + error.message.slice(1) + "." } : failure("save the quiz", error.message);
  }
  const kept = new Set(quiz.questions.map((q) => q.imagePath));
  await removeFiles(supabase, (before ?? []).map((b) => b.image_path).filter((p) => !kept.has(p)));
  refresh();
  return { ok: true, message: quiz.isPublished ? "Quiz saved and published." : "Quiz saved as a draft." };
}

export async function deleteQuizAction(quizId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(quizId).success) return { ok: false, message: "Invalid quiz." };
  const supabase = await createClient();
  const { data: imgs } = await supabase.from("questions").select("image_path").eq("quiz_id", quizId).not("image_path", "is", null);
  const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
  if (error) return failure("delete the quiz", error.message);
  await removeFiles(supabase, (imgs ?? []).map((i) => i.image_path));
  refresh();
  return { ok: true, message: "Quiz deleted." };
}

const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** A one-time signed upload URL for a question image, at a server-chosen path. */
export async function requestQuestionImageUploadAction(input: {
  quizId: string;
  mimeType: string;
  fileSize: number;
}): Promise<{ ok: true; path: string; token: string } | { ok: false; message: string }> {
  await requireAdmin();
  if (!idSchema.safeParse(input.quizId).success) return { ok: false, message: "Invalid quiz." };
  const ext = IMAGE_TYPES[input.mimeType];
  if (!ext) return { ok: false, message: "Use a PNG, JPG, WebP or GIF image." };
  if (!(input.fileSize > 0 && input.fileSize <= MAX_IMAGE_BYTES)) return { ok: false, message: "Images must be 5 MB or smaller." };
  const supabase = await createClient();
  const path = `quiz/${input.quizId}/${randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return failure("prepare the upload", error?.message ?? "no url");
  return { ok: true, path: data.path, token: data.token };
}

/* ─── Progress: marking and overrides (audited in the database) ─── */

const markSchema = z.object({
  responseId: idSchema,
  marks: z.number().finite().min(0),
  feedback: z.string().trim().max(2000).default(""),
});

export async function markResponseAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a mark of 0 or more." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_response", {
    p_response: parsed.data.responseId,
    p_marks: parsed.data.marks,
    p_feedback: parsed.data.feedback,
  });
  if (error) {
    if (/marks must be between/.test(error.message)) return { ok: false, message: error.message.replace("marks", "Marks") + "." };
    return failure("save the mark", error.message);
  }
  refresh();
  return { ok: true, message: "Mark saved." };
}

const overrideSchema = z.object({
  studentId: idSchema,
  nodeId: idSchema,
  action: z.enum(["complete", "incomplete", "reset"]),
  reason: reasonSchema,
});

export async function progressOverrideAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const { studentId, nodeId, action, reason } = parsed.data;
  const supabase = await createClient();
  const { error } =
    action === "reset"
      ? await supabase.rpc("admin_reset_node", { p_student: studentId, p_node: nodeId, p_reason: reason })
      : await supabase.rpc("admin_set_completion", {
          p_student: studentId,
          p_node: nodeId,
          p_completed: action === "complete",
          p_reason: reason,
        });
  if (error) return failure("update progress", error.message);
  refresh();
  return {
    ok: true,
    message: action === "reset" ? "Step progress reset." : action === "complete" ? "Marked as complete." : "Marked as not complete.",
  };
}
