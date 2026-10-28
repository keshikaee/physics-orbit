"use server";

import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/content/schemas";
import { TARGETED_KINDS, UNTARGETED_KINDS } from "./analytics";

/*
 * Records a student page visit. Fire-and-forget: it never throws or
 * redirects, so tracking can't break a page. The database decides what is
 * stored (active students only, content they can see, repeats ignored).
 */

const visitSchema = z.union([
  z.object({ kind: z.enum(UNTARGETED_KINDS), target: z.null().optional() }),
  z.object({ kind: z.enum(TARGETED_KINDS), target: idSchema }),
]);

export async function recordVisitAction(input: unknown): Promise<void> {
  const parsed = visitSchema.safeParse(input);
  if (!parsed.success) return;
  try {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "student" || profile.status !== "active") return;
    const supabase = await createClient();
    const { error } = await supabase.rpc("log_activity", { p_kind: parsed.data.kind, p_target: parsed.data.target ?? null });
    if (error) console.error("[activity] log failed:", error.message);
  } catch (e) {
    console.error("[activity] log failed:", e instanceof Error ? e.message : e);
  }
}
