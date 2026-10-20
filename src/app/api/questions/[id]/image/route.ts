import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/content/schemas";

/*
 * Authorized delivery of question images. The question row is read with the
 * caller's session, so RLS only returns it when the student may open its
 * quiz (published, step and every parent permitted). The signed URL is also
 * created with that session, so storage RLS checks again.
 */

const NO_STORE = { "Cache-Control": "private, no-store" };
const TTL = 10 * 60; // seconds

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/questions/[id]/image">) {
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) return new NextResponse("Not found", { status: 404, headers: NO_STORE });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Sign in required", { status: 401, headers: NO_STORE });

  const { data: question } = await supabase.from("questions").select("image_path").eq("id", id).maybeSingle();
  if (!question?.image_path) return new NextResponse("Not found", { status: 404, headers: NO_STORE });

  const { data, error } = await supabase.storage.from("materials").createSignedUrl(question.image_path, TTL);
  if (error || !data) return new NextResponse("Not found", { status: 404, headers: NO_STORE });
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: NO_STORE });
}
