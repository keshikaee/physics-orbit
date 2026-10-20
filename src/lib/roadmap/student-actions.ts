"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/content/schemas";
import { parseNumericAnswer } from "./numeric";
import { answersSchema, type Answers } from "./schemas";

/*
 * Student progress actions. The student sends only their answers; the
 * database checks access and prerequisites, grades, enforces the attempt
 * limit, and records completion. Nothing here trusts a score from the client.
 */

const rawAnswerSchema = z.record(
  idSchema,
  z.union([
    z.object({ choices: z.array(idSchema).max(20) }),
    z.object({ text: z.string().max(5000) }),
    z.object({ raw: z.string().max(100), unit: z.string().max(50).default("") }),
  ]),
);

const FRIENDLY: [RegExp, string][] = [
  [/no attempts left/, "You have used all your attempts for this quiz."],
  [/earlier steps/, "Finish the earlier steps on the roadmap first."],
  [/not available/, "This quiz isn't available to you."],
  [/no questions/, "This quiz has no questions yet."],
  [/only active students/, "Only active student accounts can submit quizzes."],
  [/completed by its tasks/, "This step is completed by its quizzes."],
];
function friendly(message: string, fallback: string) {
  return FRIENDLY.find(([re]) => re.test(message))?.[1] ?? fallback;
}

export async function submitQuizAction(
  quizId: string,
  input: unknown,
): Promise<{ ok: true; attemptId: string } | { ok: false; message: string }> {
  await requireStudent();
  if (!idSchema.safeParse(quizId).success) return { ok: false, message: "Invalid quiz." };
  const raw = rawAnswerSchema.safeParse(input ?? {});
  if (!raw.success) return { ok: false, message: "Some answers couldn't be read. Please check them and try again." };

  // Convert typed numbers ("3.0 × 10^8") to values; the server compares them.
  const answers: Answers = {};
  for (const [qid, a] of Object.entries(raw.data)) {
    answers[qid] = "raw" in a ? { value: parseNumericAnswer(a.raw), unit: a.unit.trim(), raw: a.raw.trim() } : a;
  }
  const checked = answersSchema.safeParse(answers);
  if (!checked.success) return { ok: false, message: "Some answers couldn't be read." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz", { p_quiz: quizId, p_answers: checked.data });
  if (error) {
    console.error("[quiz] submit failed:", error.message);
    return { ok: false, message: friendly(error.message, "Could not submit your answers. Please try again.") };
  }
  refresh();
  return { ok: true, attemptId: data as string };
}

export async function setStepDoneAction(nodeId: string, done: boolean): Promise<{ ok: boolean; message?: string }> {
  await requireStudent();
  if (!idSchema.safeParse(nodeId).success) return { ok: false, message: "Invalid step." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_own_node_done", { p_node: nodeId, p_done: done });
  if (error) {
    console.error("[roadmap] set_own_node_done failed:", error.message);
    return { ok: false, message: friendly(error.message, "Could not update this step. Please try again.") };
  }
  refresh();
  return { ok: true };
}
