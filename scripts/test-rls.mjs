#!/usr/bin/env node
/**
 * Integration test for database + storage security (RLS policies, triggers,
 * access functions).
 *
 *   npm run test:rls
 *
 * Runs against the Supabase project in .env.local. It creates temporary,
 * pre-confirmed users (no emails are sent) and a temporary unit that only
 * those users can see, checks what each user can and cannot do — including
 * direct API and storage calls — then deletes everything it created, even on
 * failure. It never touches existing users or content.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, serviceKey, noSession);
const run = randomUUID().slice(0, 8);
const password = `Rls-${randomUUID()}`;
const createdUsers = [];
const createdUnits = [];
const createdFiles = [];

let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    console.log(`  ✖ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function makeUser(label, { role = "student", metadata = {} } = {}) {
  const email = `rls-${label}-${run}@example.com`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RLS ${label}`, curriculum: "edexcel", ...metadata },
  });
  if (error) throw new Error(`createUser(${label}): ${error.message}`);
  createdUsers.push(data.user.id);
  if (role !== "student") {
    const { error: e } = await service.from("profiles").update({ role }).eq("id", data.user.id);
    if (e) throw new Error(`set role(${label}): ${e.message}`);
  }
  return { id: data.user.id, email };
}

async function signIn(user) {
  const client = createClient(url, anonKey, noSession);
  const { error } = await client.auth.signInWithPassword({ email: user.email, password });
  if (error) throw new Error(`signIn(${user.email}): ${error.message}`);
  return client;
}

const ids = (rows) => (rows ?? []).map((r) => r.id).sort();
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

async function main() {
  console.log(`\nRLS integration test (run ${run})\n`);

  // ── Profiles & roles ──
  console.log("Profiles & roles");
  const A = await makeUser("student-a", { metadata: { role: "admin" } }); // tries to self-assign
  const B = await makeUser("student-b");
  const C = await makeUser("student-c");
  const admin = await makeUser("admin", { role: "admin" });

  const { data: aProfile } = await service.from("profiles").select("role").eq("id", A.id).single();
  check("sign-up metadata cannot choose a role", aProfile?.role === "student", `got ${aProfile?.role}`);

  const { count: teachers } = await service.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher");
  check("no legacy 'teacher' accounts remain (all are admin)", teachers === 0, `found ${teachers}`);

  const anon = createClient(url, anonKey, noSession);
  const { data: anonRows } = await anon.from("profiles").select("id");
  check("anonymous visitors see no profiles", (anonRows ?? []).length === 0);

  const a = await signIn(A);
  const b = await signIn(B);
  const c = await signIn(C);
  const ad = await signIn(admin);

  const { data: aVisible } = await a.from("profiles").select("id");
  check("student sees only their own profile", aVisible?.length === 1 && aVisible[0].id === A.id, `saw ${aVisible?.length}`);

  const { error: roleErr } = await a.from("profiles").update({ role: "admin" }).eq("id", A.id);
  check("student cannot promote themselves", Boolean(roleErr));

  const { error: statusErr } = await a.from("profiles").update({ status: "suspended" }).eq("id", A.id);
  check("student cannot change their account status", Boolean(statusErr));

  const { data: adVisible } = await ad.from("profiles").select("id").in("id", [A.id, B.id, C.id]);
  check("admin can read student profiles", adVisible?.length === 3, `saw ${adVisible?.length}`);

  // ── Build the owner's example as the admin (through RLS, like the app does) ──
  console.log("\nAdmin content management");
  const { data: course } = await ad.from("courses").select("id").eq("slug", "edexcel-ias-physics").single();
  const { data: unit, error: unitErr } = await ad
    .from("units")
    .insert({ course_id: course.id, slug: `rls-unit-${run}`, code: "RLS", title: "RLS Unit", order_index: 999, is_published: true, needs_review: false })
    .select("id")
    .single();
  check("admin can create a unit", !unitErr, unitErr?.message);
  if (unitErr) return;
  createdUnits.push(unit.id);

  // Keep the temporary unit invisible to real students: only A, B, C.
  const { error: unitAccessErr } = await ad.rpc("set_content_access", { p_kind: "unit", p_id: unit.id, p_mode: "selected", p_students: [A.id, B.id, C.id] });
  check("admin can limit a unit to selected students", !unitAccessErr, unitAccessErr?.message);

  const { data: topic, error: topicErr } = await ad
    .from("topics")
    .insert({ unit_id: unit.id, slug: "subtopic-1", title: "Subtopic 1", order_index: 1, is_published: true, needs_review: false })
    .select("id")
    .single();
  check("admin can create a subtopic", !topicErr, topicErr?.message);
  await ad.rpc("set_content_access", { p_kind: "topic", p_id: topic.id, p_mode: "selected", p_students: [A.id, B.id] });

  // Three PDFs, uploaded to private storage by the admin.
  const pdfBytes = new TextEncoder().encode("%PDF-1.4\n%RLS test\n");
  const pdfs = [];
  for (const [n, who] of [
    [1, [A.id, B.id]],
    [2, [A.id]],
    [3, [B.id]],
  ]) {
    const path = `${topic.id}/${randomUUID()}.pdf`;
    const { error: upErr } = await ad.storage.from("materials").upload(path, pdfBytes, { contentType: "application/pdf" });
    if (upErr) throw new Error(`admin upload: ${upErr.message}`);
    createdFiles.push(path);
    const { data: m, error: mErr } = await ad
      .from("materials")
      .insert({ topic_id: topic.id, kind: "pdf", title: `PDF ${n}`, storage_path: path, order_index: n, is_published: true })
      .select("id")
      .single();
    if (mErr) throw new Error(`insert material: ${mErr.message}`);
    await ad.rpc("set_content_access", { p_kind: "material", p_id: m.id, p_mode: "selected", p_students: who });
    pdfs.push({ id: m.id, path });
  }
  check("admin can upload PDFs to private storage", createdFiles.length === 3);

  const { data: open } = await ad
    .from("materials")
    .insert({ topic_id: topic.id, kind: "link", title: "Open link", url: "https://example.com", order_index: 4, is_published: true })
    .select("id")
    .single();
  const { data: draft } = await ad
    .from("materials")
    .insert({ topic_id: topic.id, kind: "note", title: "Draft note", notes: "secret", order_index: 5, is_published: false })
    .select("id")
    .single();

  // ── Per-student visibility ──
  console.log("\nStudent-specific access (A: PDF1+2, B: PDF1+3, C: nothing in Subtopic 1)");
  const seen = async (client) => ids((await client.from("materials").select("id").eq("topic_id", topic.id)).data);
  check("Student A sees PDF 1, PDF 2 and the open link", same(await seen(a), [pdfs[0].id, pdfs[1].id, open.id]));
  check("Student B sees PDF 1, PDF 3 and the open link", same(await seen(b), [pdfs[0].id, pdfs[2].id, open.id]));
  check("Student C sees the unit but not Subtopic 1", (await c.from("units").select("id").eq("id", unit.id)).data?.length === 1 &&
    (await c.from("topics").select("id").eq("id", topic.id)).data?.length === 0);
  check("Student C sees no materials — even the one open to all (parent wins)", (await seen(c)).length === 0);
  check("unpublished materials are hidden from students", !(await seen(a)).includes(draft.id));
  check("admin sees every material, including drafts", (await seen(ad)).length === 5);

  // ── Direct API attacks ──
  console.log("\nUnauthorized access attempts");
  const { data: cById } = await c.from("materials").select("*").eq("id", pdfs[1].id);
  check("guessing a material id returns nothing", (cById ?? []).length === 0);

  const { data: bGrants } = await b.from("content_grants").select("student_id");
  check("students can only read their own grants", (bGrants ?? []).every((g) => g.student_id === B.id));

  const { error: grantErr } = await c.from("content_grants").insert({ student_id: C.id, material_id: pdfs[1].id });
  check("a student cannot grant themselves access", Boolean(grantErr));

  const { error: rpcErr } = await c.rpc("set_content_access", { p_kind: "material", p_id: pdfs[1].id, p_mode: "all", p_students: [] });
  check("a student cannot call set_content_access", Boolean(rpcErr));

  const { error: rpc2Err } = await c.rpc("set_student_access", { p_student: C.id, p_kind: "topic", p_id: topic.id, p_allow: true });
  check("a student cannot call set_student_access", Boolean(rpc2Err));

  const { data: edited } = await a.from("materials").update({ title: "Hacked" }).eq("id", pdfs[0].id).select();
  check("a student cannot edit materials", (edited ?? []).length === 0);

  const { error: insErr } = await a.from("materials").insert({ topic_id: topic.id, kind: "link", title: "x", url: "https://x.com" });
  check("a student cannot create materials", Boolean(insErr));

  const { data: unpub } = await a.from("units").update({ is_published: false }).eq("id", unit.id).select();
  check("a student cannot unpublish content", (unpub ?? []).length === 0);

  // ── Storage ──
  console.log("\nPrivate file storage");
  const signed = async (client, path) => (await client.storage.from("materials").createSignedUrl(path, 60)).data?.signedUrl;
  check("Student A can get a signed URL for PDF 2", Boolean(await signed(a, pdfs[1].path)));
  check("Student B cannot get a signed URL for PDF 2", !(await signed(b, pdfs[1].path)));
  check("Student C cannot download PDF 1 directly", Boolean((await c.storage.from("materials").download(pdfs[0].path)).error));
  check("anonymous users cannot get a signed URL", !(await signed(anon, pdfs[0].path)));
  check("public URLs don't work (bucket is private)", (await fetch(anon.storage.from("materials").getPublicUrl(pdfs[0].path).data.publicUrl)).status >= 400);
  const { error: stuUpErr } = await a.storage.from("materials").upload(`${topic.id}/${randomUUID()}.pdf`, pdfBytes, { contentType: "application/pdf" });
  check("students cannot upload files", Boolean(stuUpErr));

  // ── Student-wise management uses the same permission data ──
  console.log("\nStudent-wise changes (same data as content-wise)");
  await ad.rpc("set_student_access", { p_student: C.id, p_kind: "topic", p_id: topic.id, p_allow: true });
  await ad.rpc("set_student_access", { p_student: C.id, p_kind: "material", p_id: pdfs[2].id, p_allow: true });
  check("granting C the subtopic + PDF 3 student-wise shows exactly those", same(await seen(c), [pdfs[2].id, open.id]));
  const { data: p3Grants } = await ad.from("content_grants").select("student_id").eq("material_id", pdfs[2].id);
  check("…and the content-wise view of PDF 3 now lists B and C", same((p3Grants ?? []).map((g) => g.student_id), [B.id, C.id]));

  await ad.rpc("set_student_access", { p_student: A.id, p_kind: "material", p_id: open.id, p_allow: false });
  const { data: openRow } = await ad.from("materials").select("access_mode").eq("id", open.id).single();
  check("blocking A on an 'all' item switches it to selected", openRow?.access_mode === "selected");
  check("…A loses it, B and C keep it", !(await seen(a)).includes(open.id) && (await seen(b)).includes(open.id) && (await seen(c)).includes(open.id));

  // Publication changes
  await ad.from("topics").update({ is_published: false }).eq("id", topic.id);
  check("unpublishing the subtopic hides all its materials", (await seen(a)).length === 0 && (await seen(b)).length === 0);
  await ad.from("topics").update({ is_published: true }).eq("id", topic.id);

  await ad.rpc("set_student_access", { p_student: B.id, p_kind: "unit", p_id: unit.id, p_allow: false });
  check("removing B from the unit hides everything inside it", (await seen(b)).length === 0);

  // Suspension
  const { error: suspendErr } = await ad.from("profiles").update({ status: "suspended" }).eq("id", A.id);
  check("admin can deactivate a student", !suspendErr, suspendErr?.message);
  check("a deactivated student sees no content", (await a.from("courses").select("id")).data?.length === 0 && (await seen(a)).length === 0);
  check("a deactivated student cannot get file URLs", !(await signed(a, pdfs[1].path)));

  // Deleting cascades grants
  await ad.from("materials").delete().eq("id", pdfs[0].id);
  const { count: leftover } = await service.from("content_grants").select("id", { count: "exact", head: true }).eq("material_id", pdfs[0].id);
  check("deleting a material removes its grants", leftover === 0);
}

async function cleanup() {
  if (createdFiles.length) await service.storage.from("materials").remove(createdFiles);
  for (const id of createdUnits) await service.from("units").delete().eq("id", id);
  for (const id of createdUsers) await service.auth.admin.deleteUser(id);
}

try {
  await main();
} catch (err) {
  failed++;
  console.error(`\n✖ Test aborted: ${err.message}`);
} finally {
  await cleanup();
  console.log(`\n${passed} passed, ${failed} failed. Temporary users, content and files removed.\n`);
  process.exit(failed ? 1 : 0);
}
