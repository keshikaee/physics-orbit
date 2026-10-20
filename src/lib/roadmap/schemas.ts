import { z } from "zod";

/* Validation for roadmap, quiz and answer payloads — shared by server actions and tests. */

const id = z.uuid("Invalid id.");
const title = z.string().trim().min(1, "Title is required.").max(200, "Title must be 200 characters or fewer.");
const coordinate = z.number().finite().min(-100000).max(100000);

export const MAX_STEPS = 300;
export const MAX_CONNECTIONS = 1000;
export const MAX_QUESTIONS = 100;

export const nodeKindSchema = z.enum(["lesson", "resource", "quiz", "milestone", "final"]);
export const completionRuleSchema = z.enum(["all_required", "min_quizzes", "student_mark", "admin_confirm"]);

export const roadmapNodeSchema = z
  .object({
    id,
    kind: nodeKindSchema,
    title,
    description: z.string().trim().max(2000, "Description must be 2000 characters or fewer.").default(""),
    x: coordinate,
    y: coordinate,
    topicId: id.nullable().default(null),
    isRequired: z.boolean().default(true),
    completionRule: completionRuleSchema,
    minQuizzes: z.number().int().min(1).max(100).nullable().default(null),
    lockUntilPrereqs: z.boolean().default(false),
    materialIds: z.array(id).max(100).default([]),
    accessMode: z.enum(["all", "selected"]).default("all"),
    studentIds: z.array(id).max(1000).default([]),
  })
  .transform((n) => ({
    ...n,
    minQuizzes: n.completionRule === "min_quizzes" ? (n.minQuizzes ?? 1) : null,
    materialIds: [...new Set(n.materialIds)],
    studentIds: n.accessMode === "all" ? [] : [...new Set(n.studentIds)],
  }));

export const roadmapEdgeSchema = z
  .object({ source: id, target: id })
  .refine((e) => e.source !== e.target, "A step can't connect to itself.");

export const roadmapSaveSchema = z
  .object({
    roadmapId: id,
    version: z.number().int().min(1),
    nodes: z.array(roadmapNodeSchema).max(MAX_STEPS, `A roadmap can have up to ${MAX_STEPS} steps.`),
    edges: z.array(roadmapEdgeSchema).max(MAX_CONNECTIONS, `A roadmap can have up to ${MAX_CONNECTIONS} connections.`),
    /** Set after the admin confirmed removing steps that students have completed. */
    confirmRemoval: z.boolean().default(false),
  })
  .superRefine((r, ctx) => {
    const ids = new Set<string>();
    for (const n of r.nodes) {
      if (ids.has(n.id)) ctx.addIssue({ code: "custom", message: "Duplicate step id." });
      ids.add(n.id);
    }
    for (const e of r.edges) {
      if (!ids.has(e.source) || !ids.has(e.target)) ctx.addIssue({ code: "custom", message: "A connection points to a missing step." });
    }
  })
  .transform((r) => {
    // Drop duplicate connections.
    const seen = new Set<string>();
    const edges = r.edges.filter((e) => {
      const k = `${e.source}>${e.target}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { ...r, edges };
  });
export type RoadmapSave = z.output<typeof roadmapSaveSchema>;
export type RoadmapNodeInput = z.input<typeof roadmapNodeSchema>;

/* ─── Quizzes ─── */

const choiceSchema = z.object({
  id,
  label: z.string().trim().min(1, "Choices can't be empty.").max(1000),
});

const keySchema = z.object({
  correctChoiceIds: z.array(id).default([]),
  numericAnswer: z.number().finite().nullable().default(null),
  tolerance: z.number().finite().min(0, "Tolerance can't be negative.").default(0),
  toleranceKind: z.enum(["absolute", "percent"]).default("absolute"),
  units: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  autoExact: z.boolean().default(false),
  acceptedAnswers: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  caseSensitive: z.boolean().default(false),
  modelAnswer: z.string().trim().max(5000).default(""),
  explanation: z.string().trim().max(5000).default(""),
});

export const questionSchema = z
  .object({
    id,
    kind: z.enum(["mcq_single", "mcq_multi", "short", "numeric"]),
    prompt: z.string().trim().min(1, "Every question needs text.").max(5000),
    imagePath: z.string().max(500).nullable().default(null),
    marks: z.number().positive("Marks must be more than 0.").max(1000),
    choices: z.array(choiceSchema).max(20, "Up to 20 choices per question.").default([]),
    key: keySchema,
  })
  .superRefine((q, ctx) => {
    if (q.kind === "mcq_single" || q.kind === "mcq_multi") {
      if (q.choices.length < 2) ctx.addIssue({ code: "custom", message: "Multiple choice needs at least two choices." });
      const choiceIds = new Set(q.choices.map((c) => c.id));
      const correct = q.key.correctChoiceIds.filter((c) => choiceIds.has(c));
      if (q.kind === "mcq_single" && correct.length !== 1)
        ctx.addIssue({ code: "custom", message: "Mark exactly one correct choice." });
      if (q.kind === "mcq_multi" && correct.length < 1) ctx.addIssue({ code: "custom", message: "Mark at least one correct choice." });
    }
    if (q.kind === "numeric" && q.key.numericAnswer === null)
      ctx.addIssue({ code: "custom", message: "Numerical questions need a correct answer." });
    if (q.kind === "short" && q.key.autoExact && q.key.acceptedAnswers.length === 0)
      ctx.addIssue({ code: "custom", message: "Add at least one accepted answer for exact-match marking." });
    if (q.imagePath !== null && !/^quiz\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp|gif)$/.test(q.imagePath))
      ctx.addIssue({ code: "custom", message: "Invalid image." });
  })
  .transform((q) => ({
    ...q,
    choices: q.kind === "mcq_single" || q.kind === "mcq_multi" ? q.choices : [],
    key: {
      ...q.key,
      correctChoiceIds: q.key.correctChoiceIds.filter((c) => q.choices.some((ch) => ch.id === c)),
    },
  }));

export const quizSaveSchema = z
  .object({
    id,
    nodeId: id,
    title,
    description: z.string().trim().max(2000).default(""),
    passPercent: z.number().int().min(0).max(100),
    maxAttempts: z.number().int().min(1).max(100).nullable(),
    reveal: z.enum(["never", "after_submit", "after_pass"]),
    requirePass: z.boolean(),
    isRequired: z.boolean(),
    isPublished: z.boolean(),
    questions: z.array(questionSchema).max(MAX_QUESTIONS, `Up to ${MAX_QUESTIONS} questions per quiz.`),
  })
  .superRefine((q, ctx) => {
    if (q.isPublished && q.questions.length === 0)
      ctx.addIssue({ code: "custom", message: "Add at least one question before publishing." });
    const qids = new Set<string>();
    const cids = new Set<string>();
    for (const question of q.questions) {
      if (qids.has(question.id)) ctx.addIssue({ code: "custom", message: "Duplicate question id." });
      qids.add(question.id);
      for (const c of question.choices) {
        if (cids.has(c.id)) ctx.addIssue({ code: "custom", message: "Duplicate choice id." });
        cids.add(c.id);
      }
    }
  });
export type QuizSave = z.output<typeof quizSaveSchema>;
export type QuizInput = z.input<typeof quizSaveSchema>;

/* ─── Student answers ─── */

export const answerSchema = z.union([
  z.object({ choices: z.array(id).max(20) }),
  z.object({ text: z.string().max(5000) }),
  z.object({ value: z.number().finite().nullable(), unit: z.string().max(50), raw: z.string().max(100) }),
]);
export const answersSchema = z.record(id, answerSchema).refine((a) => Object.keys(a).length <= MAX_QUESTIONS);
export type Answers = z.infer<typeof answersSchema>;

export const reasonSchema = z.string().trim().min(3, "Give a short reason (at least 3 characters).").max(1000);
