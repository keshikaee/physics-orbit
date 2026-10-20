import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/content/schemas";

/*
 * Authorized file delivery for PDFs and uploaded videos.
 *
 * The material row is read with the caller's own session, so RLS decides
 * whether they may see it (published, allowed for them, parents visible).
 * Only then do we mint a short-lived signed URL — also created with the
 * caller's session, so storage RLS checks it a second time. The bucket is
 * private; there are no permanent public links.
 */

const NO_STORE = { "Cache-Control": "private, no-store" };
const PDF_TTL = 5 * 60; // seconds
const VIDEO_TTL = 2 * 60 * 60; // long enough to finish watching (range requests reuse the URL)

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/materials/[id]/file">) {
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) return new NextResponse("Not found", { status: 404, headers: NO_STORE });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Sign in required", { status: 401, headers: NO_STORE });

  const { data: material } = await supabase
    .from("materials")
    .select("storage_path, kind")
    .eq("id", id)
    .maybeSingle();
  if (!material?.storage_path) return new NextResponse("Not found", { status: 404, headers: NO_STORE });

  const { data, error } = await supabase.storage
    .from("materials")
    .createSignedUrl(material.storage_path, material.kind === "video" ? VIDEO_TTL : PDF_TTL);
  if (error || !data) return new NextResponse("Not found", { status: 404, headers: NO_STORE });

  return NextResponse.redirect(data.signedUrl, { status: 302, headers: NO_STORE });
}
